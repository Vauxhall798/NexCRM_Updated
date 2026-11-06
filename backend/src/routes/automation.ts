import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { prisma } from '../lib/prisma.ts';
import {
  generateFollowupDraft,
  executeFollowupEmail,
  runAutomatedFollowupBatch,
} from '../lib/followup-engine.ts';
import type { FollowupTemplateType } from '../lib/followup-engine.ts';

export const automationRouter = Router();
automationRouter.use(requireAuth);

// GET /api/automation/due — List all leads due for follow-up today or overdue
automationRouter.get('/due', async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const leads = await prisma.lead.findMany({
      include: {
        owner: { select: { id: true, name: true, role: true, email: true } },
        lead_notes: { take: 2, orderBy: { created_at: 'desc' } },
      },
      orderBy: { next_followup: 'asc' },
    });

    const dueLeads = leads
      .filter((l) => {
        if (l.status === 'Converted' || l.status === 'Lost') return false;
        if (!l.next_followup) return true;
        return new Date(l.next_followup) <= now;
      })
      .map((l) => {
        const isOverdue = Boolean(l.next_followup && new Date(l.next_followup) < now);
        let recommendedTemplate: FollowupTemplateType = 'gentle_nudge';
        if (l.status === 'Proposal sent') recommendedTemplate = 'proposal_checkin';
        else if (l.status === 'Meeting scheduled') recommendedTemplate = 'meeting_reminder';
        else if (l.status === 'Negotiation') recommendedTemplate = 'negotiation_close';
        else if (l.status === 'New') recommendedTemplate = 'initial_inquiry';

        return {
          ...l,
          is_overdue: isOverdue,
          recommended_template: recommendedTemplate,
        };
      });

    res.json({
      total_due: dueLeads.length,
      due_leads: dueLeads,
    });
  } catch (err) {
    console.error('Error fetching due follow-ups:', err);
    res.status(500).json({ error: 'Failed to fetch due follow-ups' });
  }
});

// POST /api/automation/generate-draft — Generate AI follow-up email draft
automationRouter.post('/generate-draft', async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, template_type = 'proposal_checkin', custom_notes = '' } = req.body || {};

    if (!lead_id) {
      res.status(400).json({ error: 'lead_id is required' });
      return;
    }

    const draft = await generateFollowupDraft({
      leadId: String(lead_id),
      templateType: template_type as FollowupTemplateType,
      customNotes: String(custom_notes || ''),
      senderName: req.user?.name,
      senderRole: req.user?.role,
    });

    res.json({ draft });
  } catch (err) {
    console.error('Error generating follow-up draft:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate draft' });
  }
});

// POST /api/automation/send-email — Send a follow-up email directly from the CRM
automationRouter.post('/send-email', async (req: AuthRequest, res: Response) => {
  try {
    const {
      lead_id,
      recipient_email,
      recipient_name,
      subject,
      body,
      next_followup_date,
      template_type,
    } = req.body || {};

    if (!lead_id || !recipient_email || !subject || !body) {
      res.status(400).json({ error: 'lead_id, recipient_email, subject, and body are required' });
      return;
    }

    const outcome = await executeFollowupEmail({
      leadId: String(lead_id),
      recipientEmail: String(recipient_email).trim(),
      recipientName: String(recipient_name || 'Client').trim(),
      subject: String(subject).trim(),
      body: String(body).trim(),
      nextFollowupDate: next_followup_date,
      sentByUserId: req.user?.id,
      sentByUserName: req.user?.name,
      templateType,
    });

    res.json({
      message: `Follow-up email dispatched successfully (${outcome.emailResult.status})!`,
      email_log: outcome.emailLog,
      email_result: outcome.emailResult,
      next_followup: outcome.nextFollowup,
    });
  } catch (err) {
    console.error('Error sending follow-up email:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send follow-up email' });
  }
});

// POST /api/automation/run-batch — 1-click batch execution across all due leads
automationRouter.post('/run-batch', async (req: AuthRequest, res: Response) => {
  try {
    const batchResult = await runAutomatedFollowupBatch(req.user?.id, req.user?.name);
    res.json({
      message: `Processed ${batchResult.processed_count} automated follow-up emails!`,
      batch: batchResult,
    });
  } catch (err) {
    console.error('Error running automated follow-up batch:', err);
    res.status(500).json({ error: 'Failed to run automated follow-up batch' });
  }
});

// GET /api/automation/logs — Get history of sent follow-up emails
automationRouter.get('/logs', async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.emailLog.findMany({
      orderBy: { sent_at: 'desc' },
      take: 50,
    });

    res.json({ logs });
  } catch (err) {
    console.error('Error fetching email logs:', err);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

// GET /api/automation/settings — Get current email provider & automation status
automationRouter.get('/settings', async (_req: AuthRequest, res: Response) => {
  try {
    const smtpHost = process.env.SMTP_HOST || '';
    const resendKey = process.env.RESEND_API_KEY ? 'Configured (Active)' : '';
    const brevoKey = process.env.BREVO_API_KEY ? 'Configured (Active)' : '';
    const geminiKey = process.env.GEMINI_ARGON_API_KEY || process.env.GEMINI_API_KEY ? 'Configured (Active)' : '';

    let activeProvider = 'CRM Local / Simulated (Ready)';
    if (resendKey) activeProvider = 'Resend Cloud API';
    else if (brevoKey) activeProvider = 'Brevo Cloud API';
    else if (smtpHost) activeProvider = `SMTP Server (${smtpHost})`;

    res.json({
      settings: {
        active_provider: activeProvider,
        ai_generator_status: geminiKey || 'Built-in Template Synthesizer (Active)',
        smtp_configured: Boolean(smtpHost),
        resend_configured: Boolean(process.env.RESEND_API_KEY),
        default_followup_interval_days: 4,
        auto_advance_status: true,
      },
    });
  } catch (err) {
    console.error('Error fetching automation settings:', err);
    res.status(500).json({ error: 'Failed to fetch automation settings' });
  }
});
