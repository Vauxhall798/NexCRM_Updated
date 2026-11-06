import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Sparkles,
  Calendar,
  Building2,
  User,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Lead, FollowupTemplateType, FollowupDraft } from '../types/crm';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { formatDate } from '../lib/utils';

interface FollowUpEmailModalProps {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSent: () => void;
}

const TEMPLATES: Array<{ id: FollowupTemplateType; label: string; desc: string }> = [
  {
    id: 'proposal_checkin',
    label: 'Post-Proposal Check-in',
    desc: 'Verify proposal receipt and answer questions',
  },
  {
    id: 'initial_inquiry',
    label: 'Initial Inquiry Follow-up',
    desc: 'Touch base on their project requirements',
  },
  {
    id: 'meeting_reminder',
    label: 'Meeting Reminder & Agenda',
    desc: 'Confirm upcoming call details and topics',
  },
  {
    id: 'gentle_nudge',
    label: 'Gentle Status Nudge',
    desc: 'Polite check-in on project priority and timeline',
  },
  {
    id: 'negotiation_close',
    label: 'Contract & Negotiation Close',
    desc: 'Finalize terms, scope, and kickoff sprint',
  },
  {
    id: 'reengagement',
    label: 'Cold Lead Re-engagement',
    desc: 'Reconnect with stalled or silent prospects',
  },
];

export const FollowUpEmailModal: React.FC<FollowUpEmailModalProps> = ({
  open,
  lead,
  onClose,
  onSent,
}) => {
  const { showToast } = useToast();
  const [templateType, setTemplateType] = useState<FollowupTemplateType>('proposal_checkin');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [customGuidance, setCustomGuidance] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [sending, setSending] = useState(false);

  // Initialize draft when modal opens
  useEffect(() => {
    if (lead && open) {
      setRecipientEmail(lead.email || '');
      setRecipientName(lead.name || '');

      // Pick sensible template based on lead status
      let initialTpl: FollowupTemplateType = 'proposal_checkin';
      if (lead.status === 'New') initialTpl = 'initial_inquiry';
      else if (lead.status === 'Meeting scheduled') initialTpl = 'meeting_reminder';
      else if (lead.status === 'Negotiation') initialTpl = 'negotiation_close';
      else if (lead.status === 'Contacted') initialTpl = 'gentle_nudge';
      setTemplateType(initialTpl);

      // Auto-set next follow-up +4 days
      const d = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
      setNextFollowupDate(d);

      // Auto-generate initial draft
      fetchDraft(lead.id, initialTpl);
    }
  }, [lead, open]);

  const fetchDraft = async (leadId: string, tpl: FollowupTemplateType, guidance?: string) => {
    setGeneratingAi(true);
    try {
      const res = await apiFetch<{ draft: FollowupDraft }>('/automation/generate-draft', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: leadId,
          template_type: tpl,
          custom_notes: guidance || customGuidance,
        }),
      });

      setSubject(res.draft.subject);
      setBody(res.draft.body);
      if (res.draft.suggested_next_followup) {
        setNextFollowupDate(res.draft.suggested_next_followup);
      }
    } catch (err) {
      console.warn('Draft generation error:', err);
      // Fallback
      setSubject(`Following up on ${lead?.service || 'software engineering'} for ${lead?.company}`);
      setBody(`Hi ${lead?.name || 'there'},\n\nHope all is well. I wanted to follow up regarding our recent discussion on ${lead?.service} for ${lead?.company}.\n\nDo you have 10 minutes this week for a brief touchpoint?\n\nBest regards,\nNexInt AI Team`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleTemplateChange = (tpl: FollowupTemplateType) => {
    setTemplateType(tpl);
    if (lead) {
      fetchDraft(lead.id, tpl);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !recipientEmail.trim() || !subject.trim() || !body.trim()) {
      showToast('Please fill in recipient email, subject, and message body.', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await apiFetch<{ message: string; email_result: { status: string; provider: string } }>(
        '/automation/send-email',
        {
          method: 'POST',
          body: JSON.stringify({
            lead_id: lead.id,
            recipient_email: recipientEmail.trim(),
            recipient_name: recipientName.trim(),
            subject: subject.trim(),
            body: body.trim(),
            next_followup_date: nextFollowupDate,
            template_type: templateType,
          }),
        }
      );

      showToast(res.message);
      onSent();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send follow-up email', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Automated Follow-Up Email"
      subtitle={`Send a customized follow-up email to ${lead.name} (${lead.company})`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSendEmail} className="space-y-4">
        {/* Lead Context Pill Banner */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {lead.company}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-600 dark:text-slate-300">{lead.service}</span>
            <span className="text-slate-400">&bull;</span>
            <span className="px-2 py-0.5 rounded-md font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {lead.status}
            </span>
          </div>

          {lead.followup_resource && (
            <div className="text-[11px] text-slate-500">
              Assigned: <strong className="text-slate-700 dark:text-slate-300">{lead.followup_resource}</strong>
            </div>
          )}
        </div>

        {/* Template Selector & AI Re-generate Button */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Follow-Up Objective &amp; Template
            </label>
            <button
              type="button"
              onClick={() => lead && fetchDraft(lead.id, templateType)}
              disabled={generatingAi}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
              {generatingAi ? 'Composing Draft...' : 'Re-generate with AI'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEMPLATES.map((t) => {
              const active = templateType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplateChange(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{t.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {t.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient & Next Follow-Up Date Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Recipient Email *
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Auto-Schedule Next Follow-Up On *
            </label>
            <input
              type="date"
              value={nextFollowupDate}
              onChange={(e) => setNextFollowupDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Email Subject Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="e.g. Following up regarding custom AI solution for Acme"
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Email Body Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Body *
          </label>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className="w-full p-3 text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Will be logged directly into Lead Work Notes with timestamp &amp; author.</span>
            <span>{body.split(/\s+/).filter(Boolean).length} words</span>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <a
            href={`mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
              subject
            )}&body=${encodeURIComponent(body)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Open in your default email client (Gmail / Outlook)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Gmail / Outlook
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={sending || generatingAi}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Send className={`w-3.5 h-3.5 ${sending ? 'animate-pulse' : ''}`} />
              {sending ? 'Sending Email...' : 'Send Follow-Up from CRM'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

