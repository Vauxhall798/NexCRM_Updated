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
  variationIndex?: number;
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

  // Built-in intelligent template synthesizer with multi-variation support
  const vIdx = Math.abs(Number(req.variationIndex || 0)) % 3;
  const tpl = req.templateType || 'gentle_nudge';
  const contextLine = recentNotes
    ? `\n\nBased on our notes ("${recentNotes.slice(0, 110)}${recentNotes.length > 110 ? '...' : ''}"), we have aligned our technical blueprint to match your priorities.`
    : '';

  let subject = `Following up regarding ${service} for ${company}`;
  let body = '';

  if (tpl === 'proposal_checkin') {
    const variants = [
      {
        subject: `Checking in: Proposal for ${company} — NexInt AI`,
        body: `Hi ${recipientName},\n\nI wanted to quickly check in to confirm you received the proposal we shared for ${company}'s ${service} initiative.${contextLine}\n\nWe designed the milestones and architecture to deliver measurable business outcomes within your target timeline. Have you had an opportunity to review it with your team?\n\nI would be happy to jump on a quick 15-minute call to walk through the technical architecture or fine-tune any deliverables.\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Architecture & Milestone Walkthrough: ${company} (${service})`,
        body: `Hi ${recipientName},\n\nHope your week is going well. Following up on the ${service} proposal we prepared for ${company}, I wanted to see what initial feedback came up from your stakeholders.${contextLine}\n\nIf helpful, our lead architect can join a brief 15-minute review session this week to adjust phase boundaries, integrations, or commercial milestones.\n\nLet me know what day and time works best for you.\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Next steps on ${company}'s ${service} proposal — NexInt AI`,
        body: `Hi ${recipientName},\n\nI am writing to touch base on the ${service} proposal for ${company}. Our delivery squad is currently planning sprint allocations for the upcoming cycle, and we would love to reserve dedicated engineering bandwidth for your launch.${contextLine}\n\nAre there any open questions on the scope or investment breakdown that I can clarify for you today?\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
    ];
    subject = variants[vIdx].subject;
    body = variants[vIdx].body;
  } else if (tpl === 'meeting_reminder') {
    const variants = [
      {
        subject: `Upcoming Discussion: ${service} for ${company}`,
        body: `Hi ${recipientName},\n\nLooking forward to our upcoming discussion on ${service} for ${company}.${contextLine}\n\nAhead of our call, please feel free to share any specific architecture requirements, sample workflows, or questions your team would like us to cover.\n\nLooking forward to connecting soon!\n\nBest,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Agenda & Technical Prep: ${company} × NexInt AI`,
        body: `Hi ${recipientName},\n\nWe are excited for our scheduled session regarding ${company}'s ${service} roadmap. During our call, we will cover:\n• Current workflow bottlenecks & target architecture\n• Phased delivery milestones & timeline\n• Transparent investment & ROI metrics\n\nPlease let me know if you would like to add any specific topics to the agenda.\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Confirming our ${service} discovery session — ${company}`,
        body: `Hi ${recipientName},\n\nJust a quick note to confirm our upcoming consultation for ${company}'s ${service} initiative.${contextLine}\n\nOur solutions engineering team has prepared a tailored walkthrough relevant to your domain. Let me know if your schedule still looks good or if anyone else from your team will be joining.\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
    ];
    subject = variants[vIdx].subject;
    body = variants[vIdx].body;
  } else if (tpl === 'negotiation_close') {
    const variants = [
      {
        subject: `Next steps: Finalizing ${service} engagement for ${company}`,
        body: `Hi ${recipientName},\n\nHope all is well. Following our recent discussion, our engineering team has reserved capacity for the kickoff of ${company}'s ${service} engagement.${contextLine}\n\nPlease let us know if there are any contractual or scope adjustments needed so we can finalize the agreement and initiate Sprint 1 seamlessly.\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Kickoff Readiness & Final Sign-off: ${company} (${service})`,
        body: `Hi ${recipientName},\n\nWe are thrilled to be at the final stage of our ${service} planning with ${company}. We have locked in your delivery squad and Phase 1 onboarding checklist.${contextLine}\n\nOnce the work order is signed off, we can begin environment setup and data discovery within 48 hours. Let me know if you need any final edits from our side!\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Closing the loop on ${company}'s ${service} agreement`,
        body: `Hi ${recipientName},\n\nTouching base on the final commercial terms for ${company}'s ${service} rollout. We want to ensure the milestone payment schedule and SLA terms align 100% with your procurement process.${contextLine}\n\nDo you have 10 minutes today to wrap up the final details?\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
    ];
    subject = variants[vIdx].subject;
    body = variants[vIdx].body;
  } else if (tpl === 'initial_inquiry') {
    const variants = [
      {
        subject: `Exploring ${service} for ${company} — NexInt AI`,
        body: `Hi ${recipientName},\n\nThank you for connecting with NexInt AI regarding ${company}'s ${service} initiative.${contextLine}\n\nWe specialize in building production-grade ${service.toLowerCase()} platforms with rapid time-to-value and 100% client IP ownership. Would you be open to a brief 15-minute discovery call this week to discuss your goals?\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Tailored ${service} blueprint for ${company}`,
        body: `Hi ${recipientName},\n\nI hope your week is going well. I wanted to follow up on your inquiry around ${service} for ${company}.${contextLine}\n\nWe have delivered similar architectures that reduced manual operational overhead by over 60%. I would love to share a quick demo and learn more about your requirements.\n\nWhat time works best for a quick chat this week?\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Quick introduction: ${company} × NexInt AI (${service})`,
        body: `Hi ${recipientName},\n\nReaching out regarding ${company}'s interest in ${service}. Our engineering team has reviewed your initial brief and put together a few architecture recommendations tailored to your workflow.${contextLine}\n\nCould we schedule a short 15-minute call on Thursday or Friday to walk through them?\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
    ];
    subject = variants[vIdx].subject;
    body = variants[vIdx].body;
  } else if (tpl === 'reengagement') {
    const variants = [
      {
        subject: `Reconnecting on ${company}'s ${service} roadmap`,
        body: `Hi ${recipientName},\n\nIt has been a little while since we last spoke about ${company}'s ${service} plans, so I wanted to reconnect and see how things are progressing on your end.${contextLine}\n\nWe have recently rolled out new accelerators in ${service.toLowerCase()} that can significantly shorten delivery timelines. Let me know if this initiative is back on your radar for this quarter!\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Checking in on priorities at ${company}`,
        body: `Hi ${recipientName},\n\nHope you and the team at ${company} are doing well! I wanted to circle back on our earlier conversation around ${service}.${contextLine}\n\nHas your timeline firmed up for the upcoming quarter? Even if priorities have shifted, I would love to hear what you are focused on now.\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Still exploring ${service} for ${company}?`,
        body: `Hi ${recipientName},\n\nI wanted to send a brief note to see if ${company} is still evaluating partners for ${service}.${contextLine}\n\nIf you are ready to revisit the scope or need an updated estimate for your budget cycle, I am happy to put together a refreshed roadmap for you.\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
    ];
    subject = variants[vIdx].subject;
    body = variants[vIdx].body;
  } else {
    // gentle_nudge
    const variants = [
      {
        subject: `Quick check-in: ${company} & ${service}`,
        body: `Hi ${recipientName},\n\nI know how busy things get, so I wanted to send a gentle nudge regarding ${company}'s plans around ${service}.${contextLine}\n\nAre you still planning to move forward with this project this quarter, or has the timeline shifted? Let me know so we can best support you whenever the timing is right.\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Following up: ${service} initiative for ${company}`,
        body: `Hi ${recipientName},\n\nI hope your week is going well. I am following up on our recent conversation regarding ${service} for ${company}.${contextLine}\n\nWe are excited about the potential collaboration and wanted to see if you had any questions on scope, deliverables, or team allocation. Would you have 10–15 minutes this week for a brief touchpoint?\n\nBest regards,\n${senderName}\nNexInt AI Technologies`,
      },
      {
        subject: `Keeping ${company}'s ${service} project moving forward`,
        body: `Hi ${recipientName},\n\nJust floating this to the top of your inbox regarding ${company}'s ${service} requirements.${contextLine}\n\nLet me know if there is any additional technical documentation, security compliance info, or case study we can share to help your team make a decision.\n\nWarm regards,\n${senderName}\nNexInt AI Technologies`,
      },
    ];
    subject = variants[vIdx].subject;
    body = variants[vIdx].body;
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

  // 4. Advance next_followup date if provided (or configured default days)
  const defaultIntervalDays = Number(process.env.DEFAULT_FOLLOWUP_DAYS || 4);
  const nextDate = params.nextFollowupDate
    ? new Date(params.nextFollowupDate).toISOString()
    : new Date(Date.now() + defaultIntervalDays * 86400000).toISOString();

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
