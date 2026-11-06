import { prisma } from './prisma.ts';
import { sendCrmEmail } from './mailer.ts';

export type FollowupTemplateType =
  | 'proposal_checkin'
  | 'initial_inquiry'
  | 'meeting_reminder'
  | 'gentle_nudge'
  | 'reengagement'
  | 'negotiation_close';

export interface FollowupDraftRequest {
  leadId: string;
  templateType: FollowupTemplateType;
  customNotes?: string;
  senderName?: string;
  senderRole?: string;
}

export interface FollowupDraftResponse {
  subject: string;
  body: string;
  recipient_email: string;
  recipient_name: string;
  company: string;
  lead_status: string;
  suggested_next_followup: string;
}

/**
 * Generate a personalized, context-aware follow-up email draft using Gemini or rich templates
 */
export async function generateFollowupDraft(req: FollowupDraftRequest): Promise<FollowupDraftResponse> {
  const lead = await prisma.lead.findUnique({
    where: { id: req.leadId },
    include: {
      lead_notes: {
        orderBy: { created_at: 'desc' },
        take: 3,
        include: { author: { select: { name: true, role: true } } },
      },
      owner: { select: { name: true, role: true, email: true } },
    },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  const senderName = req.senderName || lead.followup_resource || lead.owner?.name || 'NexInt AI Solutions';
  const recipientName = lead.name || 'there';
  const company = lead.company || 'your team';
  const service = lead.service || 'custom software & AI engineering';
  const recentNotes = lead.lead_notes?.map((n) => n.text).join('; ') || lead.notes || '';

  // Calculate default next follow-up (+4 days)
  const nextDate = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];

  // Try calling Gemini if an API key is configured
  const geminiKey = process.env.GEMINI_ARGON_API_KEY || process.env.GEMINI_API_KEY || '';
  const geminiModel = process.env.GEMINI_ARGON_MODEL || 'gemini-2.5-flash';

  if (geminiKey) {
    try {
      const prompt = `You are a high-performing IT sales and technical account executive at NexInt AI (Chennai, India).
Write a professional, warm, concise, and high-converting follow-up email for this lead:
- Lead Name: ${recipientName}
- Lead Company: ${company}
- Service Needed: ${service}
- Current Deal Stage: ${lead.status}
- Budget: ${lead.currency} ${lead.budget}
- Follow-up Objective: ${req.templateType}
- Recent Work Notes / Context: ${recentNotes}
- Sender Name: ${senderName}
${req.customNotes ? `- Custom Guidance: ${req.customNotes}` : ''}

Rules:
1. Keep the body between 80 to 140 words.
2. Direct, respectful, conversational, and focused on helping them succeed.
3. Include a clear call to action (e.g. quick 15-minute call or reply).
4. Return ONLY valid JSON with keys "subject" and "body". Do NOT wrap in markdown backticks.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (response.ok) {
        const json = (await response.json()) as any;
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.subject && parsed.body) {
            return {
              subject: parsed.subject,
              body: parsed.body,
              recipient_email: lead.email,
              recipient_name: recipientName,
              company,
              lead_status: lead.status,
              suggested_next_followup: nextDate,
            };
          }
        }
      }
    } catch (aiErr) {
      console.warn('Gemini follow-up generation failed, utilizing built-in template synthesizer:', aiErr);
    }
  }

  // Built-in intelligent template synthesizer
  let subject = `Following up regarding ${service} for ${company}`;
  let body = `Hi ${recipientName},

I hope your week is going well.

I am following up on our recent conversation regarding ${service} for ${company}. We are excited about the potential collaboration and wanted to see if you had any questions on scope, deliverables, or team allocation.

Would you have 10-15 minutes this week for a brief touchpoint to align on next steps?

Best regards,
${senderName}
NexInt AI Technologies`;

  if (req.templateType === 'proposal_checkin' || lead.status === 'Proposal sent') {
    subject = `Checking in: Proposal for ${company} — NexInt AI`;
    body = `Hi ${recipientName},

I wanted to quickly check in to confirm you received the proposal we shared for ${company}'s ${service} initiative.

We designed the milestones and architecture to deliver quick business outcomes within your timeline. Have you had an opportunity to review it with your team?

I would be happy to jump on a quick call to answer any technical questions or fine-tune specific deliverables to fit your schedule.

Warm regards,
${senderName}
NexInt AI Technologies`;
  } else if (req.templateType === 'meeting_reminder' || lead.status === 'Meeting scheduled') {
    subject = `Upcoming Discussion: ${service} for ${company}`;
    body = `Hi ${recipientName},

Looking forward to our upcoming discussion on ${service} for ${company}.

Ahead of our call, please feel free to share any specific architecture requirements, sample data, or questions your team would like us to cover.

Looking forward to connecting soon!

Best,
${senderName}
NexInt AI Technologies`;
  } else if (req.templateType === 'negotiation_close' || lead.status === 'Negotiation') {
    subject = `Next steps: Finalizing ${service} engagement for ${company}`;
    body = `Hi ${recipientName},

Hope all is well. Following our recent discussion, our engineering team has reserved capacity for the kickoff of ${company}'s ${service} engagement.

Please let us know if there are any contractual or scope adjustments needed so we can finalize the agreement and initiate Sprint 1 seamlessly.

Best regards,
${senderName}
NexInt AI Technologies`;
  } else if (req.templateType === 'reengagement' || req.templateType === 'gentle_nudge') {
    subject = `Quick check-in: ${company} & ${service}`;
    body = `Hi ${recipientName},

I know how busy things get, so I wanted to send a gentle nudge regarding ${company}'s plans around ${service}.

Are you still planning to move forward with this project this quarter, or has the timeline shifted? Let me know so we can best support you whenever the timing is right.

Best regards,
${senderName}
NexInt AI Technologies`;
  }

  return {
    subject,
    body,
    recipient_email: lead.email,
    recipient_name: recipientName,
    company,
    lead_status: lead.status,
    suggested_next_followup: nextDate,
  };
}

/**
 * Execute a single follow-up email dispatch, logging to EmailLog and LeadNote
 */
export async function executeFollowupEmail(params: {
  leadId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  nextFollowupDate?: string;
  sentByUserId?: string;
  sentByUserName?: string;
  templateType?: string;
}) {
  const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) throw new Error('Lead not found');

  const senderName = params.sentByUserName || lead.followup_resource || 'NexInt CRM Automation';

  // 1. Verify user exists if sentByUserId is provided to satisfy foreign key constraint
  let validUserId: string | null = null;
  if (params.sentByUserId) {
    const userExists = await prisma.user.findUnique({ where: { id: params.sentByUserId } });
    if (userExists) validUserId = userExists.id;
  }

  // 2. Dispatch email
  const emailRes = await sendCrmEmail({
    to: params.recipientEmail,
    toName: params.recipientName,
    subject: params.subject,
    text: params.body,
    fromName: senderName,
  });

  const nowIso = new Date().toISOString();

  // 3. Log in EmailLog
  const emailLog = await prisma.emailLog.create({
    data: {
      lead_id: lead.id,
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName,
      subject: params.subject,
      body: params.body,
      status: emailRes.status,
      provider: emailRes.provider,
      sent_by: validUserId,
      sent_at: nowIso,
    },
  });

  // 4. Append to Lead Work Notes with official author tracking
  await prisma.leadNote.create({
    data: {
      lead_id: lead.id,
      text: `[Email Follow-up Sent] Subject: "${params.subject}" (via ${emailRes.provider})`,
      created_by: validUserId,
    },
  });

  // 4. Advance next_followup date if provided (or default +4 days)
  const nextDate = params.nextFollowupDate
    ? new Date(params.nextFollowupDate).toISOString()
    : new Date(Date.now() + 4 * 86400000).toISOString();

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      next_followup: nextDate,
      // If still New, advance to Contacted
      ...(lead.status === 'New' ? { status: 'Contacted' } : {}),
    },
  });

  return {
    emailLog,
    emailResult: emailRes,
    nextFollowup: nextDate,
  };
}

/**
 * Run automated follow-up batch across all due leads
 */
export async function runAutomatedFollowupBatch(triggerByUserId?: string, triggerByName?: string) {
  const now = new Date();
  const leads = await prisma.lead.findMany({
    include: {
      owner: true,
      lead_notes: { take: 2, orderBy: { created_at: 'desc' } },
    },
  });

  // Identify leads due for follow-up today or overdue (and not closed)
  const dueLeads = leads.filter((l) => {
    if (!l.email || l.email.includes('example.com') === false && !l.email.includes('@')) return false;
    if (l.status === 'Converted' || l.status === 'Lost') return false;
    if (!l.next_followup) return true; // Never followed up
    const fDate = new Date(l.next_followup);
    return fDate <= now;
  });

  const results: Array<{
    lead_id: string;
    company: string;
    recipient_email: string;
    subject: string;
    status: string;
    next_followup: string;
  }> = [];

  for (const lead of dueLeads) {
    try {
      // Determine template type based on status
      const templateType: FollowupTemplateType =
        lead.status === 'Proposal sent'
          ? 'proposal_checkin'
          : lead.status === 'Meeting scheduled'
          ? 'meeting_reminder'
          : lead.status === 'Negotiation'
          ? 'negotiation_close'
          : 'gentle_nudge';

      const draft = await generateFollowupDraft({
        leadId: lead.id,
        templateType,
        senderName: triggerByName || lead.followup_resource || 'NexInt AI Sales Team',
      });

      const outcome = await executeFollowupEmail({
        leadId: lead.id,
        recipientEmail: draft.recipient_email,
        recipientName: draft.recipient_name,
        subject: draft.subject,
        body: draft.body,
        nextFollowupDate: draft.suggested_next_followup,
        sentByUserId: triggerByUserId,
        sentByUserName: triggerByName || 'Automated Followup System',
      });

      results.push({
        lead_id: lead.id,
        company: lead.company,
        recipient_email: draft.recipient_email,
        subject: draft.subject,
        status: outcome.emailResult.status,
        next_followup: outcome.nextFollowup,
      });
    } catch (err) {
      console.warn(`Failed automated follow-up for lead ${lead.id} (${lead.company}):`, err);
    }
  }

  return {
    total_due: dueLeads.length,
    processed_count: results.length,
    timestamp: new Date().toISOString(),
    results,
  };
}
