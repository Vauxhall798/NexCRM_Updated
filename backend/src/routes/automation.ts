import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { prisma } from '../lib/prisma.ts';
import {
  generateFollowupDraft,
  executeFollowupEmail,
  runAutomatedFollowupBatch,
} from '../lib/followup-engine.ts';
import type { FollowupTemplateType } from '../lib/followup-engine.ts';
import { sendCrmEmail } from '../lib/mailer.ts';

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

function syncEnvFiles(updates: Array<{ key: string; value: string }>) {
  try {
    const cwd = process.cwd();
    const envPaths = [
      path.resolve(cwd, '.env'),
      path.resolve(cwd, 'backend/.env'),
      path.resolve(cwd, '../.env'),
    ];
    for (const p of envPaths) {
      if (!fs.existsSync(p)) continue;
      let content = fs.readFileSync(p, 'utf8');
      for (const { key, value } of updates) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const formatted = `${key}="${value}"`;
        if (regex.test(content)) {
          content = content.replace(regex, formatted);
        } else {
          content += `\n${formatted}`;
        }
      }
      fs.writeFileSync(p, content, 'utf8');
    }
  } catch (e) {
    console.warn('Notice: Could not sync .env file to disk:', e);
  }
}

// GET /api/automation/settings — Get current email provider & automation status
automationRouter.get('/settings', async (_req: AuthRequest, res: Response) => {
  try {
    const dbSettings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of dbSettings) {
      map[s.key] = s.value;
    }

    const resendKey = map['RESEND_API_KEY'] ?? process.env.RESEND_API_KEY ?? '';
    const brevoKey = map['BREVO_API_KEY'] ?? process.env.BREVO_API_KEY ?? '';
    const smtpHost = map['SMTP_HOST'] ?? process.env.SMTP_HOST ?? '';
    const smtpPort = Number(map['SMTP_PORT'] ?? process.env.SMTP_PORT ?? 587);
    const smtpUser = map['SMTP_USER'] ?? process.env.SMTP_USER ?? '';
    const smtpPass = map['SMTP_PASS'] ?? process.env.SMTP_PASS ?? '';
    const mailFrom = map['MAIL_FROM'] ?? process.env.MAIL_FROM ?? 'info@nexintai.com';
    const fromName = map['MAIL_FROM_NAME'] ?? process.env.MAIL_FROM_NAME ?? 'NexInt AI CRM';
    const defaultInterval = Number(map['DEFAULT_FOLLOWUP_DAYS'] ?? 4);
    const autoAdvance = (map['AUTO_ADVANCE_SCHEDULE'] ?? 'true') !== 'false';
    const autoLogNote = (map['AUTO_LOG_NOTE'] ?? 'true') !== 'false';
    const noteAuthor = map['NOTE_AUTHOR_NAME'] ?? 'login 1';
    const selectedProvider =
      map['PREFERRED_PROVIDER'] ??
      (resendKey ? 'resend' : brevoKey ? 'brevo' : smtpHost ? 'smtp' : 'simulated');

    let activeProviderDisplay = 'CRM Local / Simulated (Ready)';
    if (selectedProvider === 'resend' || (!selectedProvider && resendKey)) {
      activeProviderDisplay = 'Resend Cloud API';
    } else if (selectedProvider === 'brevo' || (!selectedProvider && brevoKey)) {
      activeProviderDisplay = 'Brevo Cloud API';
    } else if (selectedProvider === 'smtp' || (!selectedProvider && smtpHost)) {
      activeProviderDisplay = `SMTP Server (${smtpHost || 'Custom'})`;
    }

    const geminiKey = process.env.GEMINI_ARGON_API_KEY || process.env.GEMINI_API_KEY ? 'Configured (Active)' : '';

    res.json({
      settings: {
        preferred_provider: selectedProvider,
        active_provider: activeProviderDisplay,
        resend_api_key: resendKey,
        brevo_api_key: brevoKey,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        mail_from: mailFrom,
        from_name: fromName,
        default_followup_interval_days: defaultInterval,
        auto_advance_status: autoAdvance,
        auto_log_note: autoLogNote,
        note_author_name: noteAuthor,
        ai_generator_status: geminiKey || 'Built-in Template Synthesizer (Active)',
        smtp_configured: Boolean(smtpHost),
        resend_configured: Boolean(resendKey),
      },
    });
  } catch (err) {
    console.error('Error fetching automation settings:', err);
    res.status(500).json({ error: 'Failed to fetch automation settings' });
  }
});

// POST /api/automation/settings — Update email provider credentials & automation options
automationRouter.post('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, any>;
    const updates: Array<{ key: string; value: string }> = [];

    const keysToSave = [
      'preferred_provider',
      'resend_api_key',
      'brevo_api_key',
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_pass',
      'mail_from',
      'from_name',
      'default_followup_interval_days',
      'auto_advance_status',
      'auto_log_note',
      'note_author_name',
    ];

    const mapping: Record<string, string> = {
      preferred_provider: 'PREFERRED_PROVIDER',
      resend_api_key: 'RESEND_API_KEY',
      brevo_api_key: 'BREVO_API_KEY',
      smtp_host: 'SMTP_HOST',
      smtp_port: 'SMTP_PORT',
      smtp_user: 'SMTP_USER',
      smtp_pass: 'SMTP_PASS',
      mail_from: 'MAIL_FROM',
      from_name: 'MAIL_FROM_NAME',
      default_followup_interval_days: 'DEFAULT_FOLLOWUP_DAYS',
      auto_advance_status: 'AUTO_ADVANCE_SCHEDULE',
      auto_log_note: 'AUTO_LOG_NOTE',
      note_author_name: 'NOTE_AUTHOR_NAME',
    };

    for (const key of keysToSave) {
      if (body[key] !== undefined) {
        const envKey = mapping[key];
        const val = String(body[key]).trim();
        updates.push({ key: envKey, value: val });
        process.env[envKey] = val;
      }
    }

    for (const item of updates) {
      await prisma.systemSetting.upsert({
        where: { key: item.key },
        create: { key: item.key, value: item.value },
        update: { value: item.value },
      });
    }

    syncEnvFiles(updates);

    res.json({ success: true, message: 'Auto Email configuration updated successfully' });
  } catch (err) {
    console.error('Error saving email settings:', err);
    res.status(500).json({ error: 'Failed to save email settings' });
  }
});

// POST /api/automation/test-email — Dispatch a live diagnostic test email
automationRouter.post('/test-email', async (req: AuthRequest, res: Response) => {
  try {
    const { recipient } = req.body as { recipient?: string };
    if (!recipient || !recipient.includes('@')) {
      res.status(400).json({ error: 'Valid recipient email address is required' });
      return;
    }

    const start = Date.now();
    const result = await sendCrmEmail({
      to: recipient.trim(),
      toName: 'NexCRM Admin',
      subject: `NexCRM Auto Email Verification — ${new Date().toLocaleTimeString('en-US')}`,
      text: `Hello,\n\nThis is a verification test from your NexCRM Auto Email Configuration panel.\n\n` +
            `Timestamp: ${new Date().toISOString()}\n` +
            `Sender: ${process.env.MAIL_FROM || 'info@nexintai.com'}\n` +
            `Active Transport: Resend / SMTP / CRM Mailer\n\n` +
            `If you received this message, your CRM email pipeline is completely configured and ready for automated lead check-ins!\n\n` +
            `Warm regards,\nNexInt AI Automation Engine`,
    });
    const latencyMs = Date.now() - start;

    res.json({
      success: result.success,
      status: result.status,
      provider: result.provider,
      messageId: result.messageId,
      error: result.error,
      latencyMs,
      mailtoUrl: result.mailtoUrl,
    });
  } catch (err: any) {
    console.error('Error sending test email:', err);
    res.status(500).json({ error: err?.message || 'Failed to dispatch test email' });
  }
});
