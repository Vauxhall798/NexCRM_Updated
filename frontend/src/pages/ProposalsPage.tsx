import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Send,
  Save,
  Code2,
  Eye,
  Mail,
  Copy,
  Download,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
  RefreshCw,
  Building2,
  UserCheck,
  Wand2,
  Maximize2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Client,
  Lead,
  NavTab,
  Proposal,
  ProposalStatus,
  ProposalSummary,
  ServiceType,
} from '../types/crm';
import { CURRENCIES, formatCurrency, formatDateTime, SERVICE_TYPES } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';

interface ProposalsPageProps {
  onNavigate?: (tab: NavTab, contextId?: string) => void;
}

const PROMPT_PRESETS = [
  {
    label: 'Vendor Hub & Procurement Portal',
    prompt:
      'From discovering and onboarding agencies, consultants, freelancers and influencers to matching them to briefs, comparing quotes, raising POs, approving invoices and collecting feedback — working alongside Folk, ClickUp and Focus.',
  },
  {
    label: 'Enterprise AI & Operations Hub',
    prompt:
      'Build an end-to-end AI-powered operations hub with automated intake, intelligent matching, multi-stage approvals, ERP & CRM two-way sync, and executive dashboards.',
  },
  {
    label: 'Cloud & Data Engineering Platform',
    prompt:
      'Architect a unified data engineering and automation platform with smart spreadsheet migration, automated document verification, role-based access control, and 100% client ownership.',
  },
  {
    label: 'Custom Web & Self-Service Portal',
    prompt:
      'Deliver a responsive web application and external self-service portal with e-signature onboarding, automated follow-ups, milestone billing, and plain-language Ask AI.',
  },
];

export const ProposalsPage: React.FC<ProposalsPageProps> = () => {
  const { showToast } = useToast();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<ProposalSummary>({
    total: 0,
    sentCount: 0,
    draftCount: 0,
    acceptedCount: 0,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Proposal ID when editing an existing saved proposal
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

  // User Prompt State (for prompt-driven HTML proposal generation)
  const [userPrompt, setUserPrompt] = useState(
    'From discovering and onboarding agencies, consultants, freelancers and influencers to matching them to briefs, comparing quotes, raising POs, approving invoices and collecting feedback — working alongside Folk, ClickUp and Focus.'
  );

  // Generator Form State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [companyName, setCompanyName] = useState('Hotcult');
  const [recipientName, setRecipientName] = useState('Manjari Srivishnu');
  const [recipientEmail, setRecipientEmail] = useState('manjari@hotcult.com');
  const [projectTitle, setProjectTitle] = useState('Vendor Hub');
  const [serviceType, setServiceType] = useState<ServiceType>('AI services');
  const [budget, setBudget] = useState('950000');
  const [currency, setCurrency] = useState('INR');
  const [timelineWeeks, setTimelineWeeks] = useState('12');
  const [keyRequirements, setKeyRequirements] = useState(
    'The vendor repository lives in a multi-tab sheet: agencies, consultants, ratings, feedback and influencers by language\nA brief goes to two or three vendors; they send an RFQ with cost and approach; you pick one and sign a contract\nNDAs need signatures, sometimes from one specific person, and reminders\nAfter delivery, the invoice goes to finance for approval, then payment and a PO through Focus, and an email once the bank transfer is done\nYou want to know where every project stands: NDA, PO, invoice, closed\nInternal ratings come from the team and creative directors; vendor feedback is a Google Form that brand solutions chases'
  );
  const [tone, setTone] = useState('Executive & Consultative');
  const envArgonApiKey = String(import.meta.env.VITE_GEMINI_ARGON_API_KEY || '').trim();

  // AI Generated & User-Editable Mail + HTML Proposal State
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [htmlProposal, setHtmlProposal] = useState('');
  const [aiModelUsed, setAiModelUsed] = useState('NexInt AI');
  const [previewTab, setPreviewTab] = useState<'full_mail' | 'html_preview' | 'html_code'>(
    'full_mail'
  );
  const [fullscreenArtifactOpen, setFullscreenArtifactOpen] = useState(false);

  // Action Loading States
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [propRes, clientRes, leadRes] = await Promise.all([
        apiFetch<{ proposals: Proposal[]; summary: ProposalSummary }>('/proposals'),
        apiFetch<{ clients: Client[] }>('/clients'),
        apiFetch<{ leads: Lead[] }>('/leads'),
      ]);
      setProposals(propRes.proposals);
      setSummary(propRes.summary);
      setClients(clientRes.clients);
      setLeads(leadRes.leads);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load proposals data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      const matchedLead =
        (found.lead_id && leads.find((l) => l.id === found.lead_id)) ||
        leads.find(
          (l) =>
            l.email.toLowerCase() === found.email.toLowerCase() ||
            l.company.toLowerCase() === found.company.toLowerCase()
        );
      setSelectedLeadId(matchedLead ? matchedLead.id : found.lead_id || '');
      setCompanyName(found.company);
      setRecipientName(found.contact_name);
      setRecipientEmail(found.email);
      const nextTitle = `${found.company} — Digital Transformation & Engineering Proposal`;
      setProjectTitle(nextTitle);
      if (found.notes) {
        setKeyRequirements(found.notes);
      }
      setUserPrompt(
        `Generate an interactive HTML proposal for ${found.company} (${found.contact_name}) for "${nextTitle}" with interactive tabs, 3-tier pricing selector, roadmap, and executive sign-off.`
      );
    } else {
      setSelectedLeadId('');
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setSelectedClientId('');
    const found = leads.find((l) => l.id === leadId);
    if (found) {
      setCompanyName(found.company);
      setRecipientName(found.name);
      setRecipientEmail(found.email);
      setServiceType(found.service);
      setBudget(String(found.budget || 450000));
      setCurrency(found.currency || 'INR');
      const nextTitle = `${found.company} — ${found.service} Solution Proposal`;
      setProjectTitle(nextTitle);
      if (found.notes) {
        setKeyRequirements(found.notes);
      }
      setUserPrompt(
        `Generate an interactive HTML proposal for ${found.company} (${found.name}) covering ${found.service} with budget ${found.currency || 'INR'} ${found.budget}, interactive tabs, 3-tier pricing options, and milestone schedule.`
      );
    }
  };

  const handleGenerateWithArgon = async (silent = false, customPromptOverride?: string) => {
    if (!companyName.trim()) {
      showToast('Please enter a company name', 'error');
      return;
    }
    setGenerating(true);
    try {
      const promptToUse =
        customPromptOverride !== undefined ? customPromptOverride : userPrompt;
      const res = await apiFetch<{
        email_subject: string;
        email_body: string;
        html_proposal: string;
        ai_model: string;
      }>('/proposals/generate', {
        method: 'POST',
        body: JSON.stringify({
          company_name: companyName,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          project_title: projectTitle,
          service_type: serviceType,
          budget: Number(budget) || 0,
          currency,
          timeline_weeks: Number(timelineWeeks) || 8,
          key_requirements: keyRequirements,
          user_prompt: promptToUse,
          tone,
          api_key: envArgonApiKey || undefined,
        }),
      });

      setEmailSubject(res.email_subject);
      setEmailBody(res.email_body);
      setHtmlProposal(res.html_proposal);
      setAiModelUsed(res.ai_model || 'nexint-ai-proposal');
      if (!silent) {
        showToast('Generated Interactive HTML Proposal & Mail Body from your prompt!');
      }
    } catch (err) {
      if (!silent) {
        showToast(
          err instanceof Error ? err.message : 'Failed to generate proposal with AI',
          'error'
        );
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveOrSend = async (targetStatus: 'Draft' | 'Sent') => {
    if (!companyName.trim() || !recipientEmail.trim()) {
      showToast('Company name and recipient email are required.', 'error');
      return;
    }
    if (!htmlProposal.trim()) {
      showToast('Please generate or enter an HTML proposal first.', 'error');
      return;
    }

    if (targetStatus === 'Sent') {
      setSending(true);
    } else {
      setSaving(true);
    }

    try {
      const payload = {
        lead_id: selectedLeadId || null,
        client_id: selectedClientId || null,
        company_name: companyName.trim(),
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim(),
        project_title: projectTitle.trim(),
        service_type: serviceType,
        budget: Number(budget) || 0,
        currency,
        timeline_weeks: Number(timelineWeeks) || 8,
        key_requirements: keyRequirements.trim(),
        email_subject: emailSubject.trim(),
        email_body: emailBody,
        html_proposal: htmlProposal,
        ai_model: aiModelUsed,
        status: targetStatus,
      };

      let savedProposal: Proposal;
      if (activeProposalId) {
        const updated = await apiFetch<{ proposal: Proposal }>(`/proposals/${activeProposalId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        savedProposal = updated.proposal;
      } else {
        const created = await apiFetch<{ proposal: Proposal }>('/proposals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedProposal = created.proposal;
        setActiveProposalId(created.proposal.id);
      }

      if (savedProposal.lead_id) {
        setSelectedLeadId(savedProposal.lead_id);
      }

      if (targetStatus === 'Sent') {
        showToast(
          savedProposal.lead_id
            ? `Proposal sent to ${recipientName} <${recipientEmail}> — Lead status changed to "Proposal sent"!`
            : `Interactive HTML Proposal Mail sent to ${recipientName} <${recipientEmail}>!`
        );
      } else {
        showToast(`Saved proposal draft for ${companyName}.`, 'info');
      }

      fetchAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save proposal', 'error');
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const handleLoadProposal = (prop: Proposal) => {
    setActiveProposalId(prop.id);
    setSelectedClientId(prop.client_id || '');
    setSelectedLeadId(prop.lead_id || '');
    setCompanyName(prop.company_name);
    setRecipientName(prop.recipient_name);
    setRecipientEmail(prop.recipient_email);
    setProjectTitle(prop.project_title);
    setServiceType(prop.service_type);
    setBudget(String(prop.budget));
    setCurrency(prop.currency);
    setTimelineWeeks(String(prop.timeline_weeks));
    setKeyRequirements(prop.key_requirements);
    setEmailSubject(prop.email_subject);
    setEmailBody(prop.email_body);
    setHtmlProposal(prop.html_proposal);
    setAiModelUsed(prop.ai_model || 'gemini-argon-ai');
    showToast(`Loaded ${prop.proposal_number} (${prop.company_name}) into studio`, 'info');
  };

  const handleUpdateProposalStatus = async (prop: Proposal, status: ProposalStatus) => {
    try {
      await apiFetch(`/proposals/${prop.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      showToast(`Updated ${prop.proposal_number} status to ${status}`);
      fetchAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProposal) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/proposals/${deletingProposal.id}`, { method: 'DELETE' });
      if (activeProposalId === deletingProposal.id) {
        setActiveProposalId(null);
      }
      showToast(`Deleted proposal ${deletingProposal.proposal_number}`, 'info');
      setDeletingProposal(null);
      fetchAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete proposal', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleCopyHtml = () => {
    if (!htmlProposal) return;
    navigator.clipboard.writeText(htmlProposal);
    showToast('Copied HTML proposal code to clipboard!');
  };

  const handleDownloadHtml = () => {
    if (!htmlProposal) return;
    const blob = new Blob([htmlProposal], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-proposal.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded interactive HTML proposal file!');
  };

  const getStatusBadgeClass = (st: ProposalStatus) => {
    switch (st) {
      case 'Sent':
        return 'bg-[#EEF8FA] text-[#0F2547] border-[#B0E0EC] dark:bg-cyan-950/60 dark:text-[#7BC8DC] dark:border-cyan-800';
      case 'Accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      case 'Declined':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            AI HTML Proposal Mailer
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveProposalId(null);
              handleGenerateWithArgon(false);
            }}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#3596B0]" />
            {generating ? 'Generating Proposal...' : 'Generate using AI'}
          </button>
        </div>
      </div>

      {/* Prominent AI Prompt Composer Box */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0F2547] via-[#15315B] to-[#1D437A] text-white shadow-md border border-[#3596B0]/30 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#7BC8DC]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#7BC8DC]">
              Prompt AI to Generate NexInt AI HTML Proposal
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PROMPT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setUserPrompt(preset.prompt);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-cyan-100 border border-white/15 transition-colors cursor-pointer"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={2}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleGenerateWithArgon(false);
              }
            }}
            placeholder="Describe how you want your interactive HTML proposal and email structured (e.g. 'Create an interactive proposal for Kinetix Robotics with 3-tier pricing options, cloud architecture deliverables, 10-week roadmap, and ROI breakdown')..."
            className="flex-1 px-3.5 py-2.5 text-xs leading-relaxed rounded-xl bg-slate-950/50 border border-white/20 text-white placeholder:text-slate-300 focus:outline-none focus:border-[#7BC8DC]"
          />
          <button
            type="button"
            onClick={() => handleGenerateWithArgon(false)}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#3596B0] hover:bg-[#2B8098] text-white shadow-sm inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating Artifact...' : 'Generate HTML Proposal'}
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Total Proposals</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary.total}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#B0E0EC] dark:border-cyan-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#0F2547] dark:text-[#7BC8DC]">
            <span>Sent in Mail</span>
            <Send className="w-4 h-4 text-[#3596B0]" />
          </div>
          <div className="text-2xl font-bold text-[#0F2547] dark:text-[#7BC8DC] mt-1">
            {summary.sentCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span>Drafts</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {summary.draftCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>Accepted by Client</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {summary.acceptedCount}
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Configurator (5 cols) | Right Editable Mail & HTML Proposal Preview (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Gemini Argon AI Input Parameters */}
        <div className="xl:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3596B0]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                1. Client &amp; Scope Parameters
              </h3>
            </div>
            {activeProposalId && (
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#EEF8FA] text-[#0F2547] dark:bg-cyan-950 dark:text-[#7BC8DC]">
                Editing Saved Proposal
              </span>
            )}
          </div>

          {/* Quick-Select Existing Client or Lead */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <Building2 className="w-3 h-3 text-[#3596B0]" />
                Prefill from Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.contact_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <UserCheck className="w-3 h-3 text-[#3596B0]" />
                Or Prefill from Lead
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => handleSelectLead(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Select Lead --</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.company} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client Company *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recipient Name *
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recipient Email *
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposal / Project Title *
              </label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Service Pillar
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Delivery Timeline (Weeks)
              </label>
              <input
                type="number"
                min={1}
                max={104}
                value={timelineWeeks}
                onChange={(e) => setTimelineWeeks(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposed Investment &amp; Currency
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-24 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposal Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Executive & Consultative">Executive &amp; Consultative</option>
                <option value="Technical & Architecture-First">
                  Technical &amp; Architecture-First
                </option>
                <option value="Value & ROI Focused">Value &amp; ROI Focused</option>
                <option value="Concise & Fast-Track">Concise &amp; Fast-Track</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Key Deliverables &amp; Technical Scope (One per line or comma-separated)
              </label>
              <textarea
                rows={4}
                value={keyRequirements}
                onChange={(e) => setKeyRequirements(e.target.value)}
                placeholder="Describe key features, technical requirements, SLAs, or business goals..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGenerateWithArgon(false)}
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#3596B0]" />
            {generating
              ? 'Generating NexInt AI HTML Proposal & Mail...'
              : 'Generate using AI'}
          </button>
        </div>

        {/* Right Column: Editable AI Mail Body + Editable HTML Proposal & Live Preview */}
        <div className="xl:col-span-7 space-y-5">
          {/* Card A: Editable AI Mail Composer */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#3596B0]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  2. AI-Generated Mail Subject &amp; Body (Editable)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateWithArgon(false)}
                disabled={generating}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0F2547] dark:text-[#7BC8DC] bg-[#EEF8FA] dark:bg-cyan-950/50 hover:opacity-90"
              >
                <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                Regenerate AI Mail
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  To (Recipient Email)
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Email Subject Line (Editable)
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  AI-Generated Cover Email Body (You can freely edit this before sending)
                </label>
                <span className="text-[10px] font-semibold text-[#3596B0]">
                  Editable Text
                </span>
              </div>
              <textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-sans"
              />
            </div>
          </div>

          {/* Card B: Interactive HTML Proposal Document Preview & Source Editor */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewTab('full_mail')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    previewTab === 'full_mail'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#3596B0]" />
                  Full Mail + Interactive HTML
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('html_preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    previewTab === 'html_preview'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#3596B0]" />
                  Interactive Artifact Only
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('html_code')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    previewTab === 'html_code'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-[#3596B0]" />
                  Edit / Paste HTML Source
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFullscreenArtifactOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#EEF8FA] text-[#0F2547] dark:bg-cyan-950/60 dark:text-[#7BC8DC] hover:opacity-90"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Fullscreen Artifact
                </button>
                <button
                  type="button"
                  onClick={handleCopyHtml}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy HTML
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .html
                </button>
              </div>
            </div>

            {/* Preview / Code Content */}
            {!htmlProposal && !generating ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF8FA] dark:bg-cyan-950/60 border border-[#B0E0EC] dark:border-cyan-800 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-[#3596B0]" />
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ready to Generate Your NexInt AI HTML Proposal
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Enter your prompt and client details, then click <strong>Generate HTML Proposal</strong> or <strong>Generate using AI</strong> to build the interactive 16-section NexInt AI proposal artifact and cover email.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateWithArgon(false)}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#3596B0]" />
                    Generate HTML Proposal
                  </button>
                </div>
              </div>
            ) : generating ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-16 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-[#3596B0] animate-spin mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Generating NexInt AI HTML Proposal Artifact...
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Synthesizing all 16 sections, architecture diagram, phase delivery plan, and investment milestones from your prompt.
                </p>
              </div>
            ) : previewTab === 'html_code' ? (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Edit the generated HTML proposal code or paste any custom Claude Artifact HTML
                  below. Changes immediately render in the interactive preview.
                </div>
                <textarea
                  rows={20}
                  value={htmlProposal}
                  onChange={(e) => setHtmlProposal(e.target.value)}
                  className="w-full p-3.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-cyan-300 leading-relaxed"
                />
              </div>
            ) : previewTab === 'full_mail' ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950">
                {/* Simulated Email Client Envelope Header */}
                <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <img
                        src="/logo-mark.webp"
                        alt="NexIntAI Logo"
                        className="w-5 h-5 object-contain rounded bg-white p-0.5 border border-slate-200"
                      />
                      <span className="font-extrabold text-[#0F2547] dark:text-white">
                        NexInt<span className="text-[#3596B0]">AI</span>
                      </span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {recipientName} &lt;{recipientEmail}&gt;
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EEF8FA] text-[#0F2547] border border-[#B0E0EC] font-bold">
                      NexIntAI Branded HTML Proposal
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Subject:</span>{' '}
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {emailSubject}
                    </span>
                  </div>
                </div>

                {/* Editable Cover Email Body rendered above the embedded HTML Proposal */}
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {emailBody}
                </div>

                {/* Embedded Interactive HTML Proposal Artifact */}
                <div className="bg-slate-100 p-3">
                  <iframe
                    title="NexInt AI Interactive HTML Proposal Preview"
                    srcDoc={htmlProposal}
                    className="w-full h-[640px] rounded-xl bg-white border border-slate-200 shadow-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 p-3">
                <iframe
                  title="HTML Proposal Standalone Interactive Artifact"
                  srcDoc={htmlProposal}
                  className="w-full h-[680px] rounded-xl bg-white border border-slate-200 shadow-xs"
                />
              </div>
            )}

            {/* Bottom Action Bar: Save Draft or Send HTML Proposal Mail */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Recipient: <strong className="text-slate-800 dark:text-slate-200">{recipientEmail}</strong>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSaveOrSend('Draft')}
                  disabled={saving || sending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveOrSend('Sent')}
                  disabled={sending || saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#3596B0]" />
                  {sending ? 'Sending Mail...' : 'Send HTML Proposal in Mail'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved & Sent HTML Proposals History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Sent &amp; Saved AI Proposals ({proposals.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No proposals saved or sent yet. Enter a prompt above to generate and send your first
            interactive HTML proposal mail.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Proposal #</th>
                  <th className="py-3 px-4">Client &amp; Recipient</th>
                  <th className="py-3 px-4">Project Title</th>
                  <th className="py-3 px-4">Investment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent / Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {proposals.map((prop) => (
                  <tr
                    key={prop.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#0F2547] dark:text-[#7BC8DC]">
                      {prop.proposal_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {prop.company_name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {prop.recipient_name} &bull; {prop.recipient_email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {prop.project_title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {prop.service_type} &bull; {prop.timeline_weeks} weeks
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(prop.budget, prop.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${getStatusBadgeClass(
                          prop.status
                        )}`}
                      >
                        {prop.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {formatDateTime(prop.sent_at || prop.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadProposal(prop)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#EEF8FA] text-[#0F2547] dark:bg-cyan-950/60 dark:text-[#7BC8DC] hover:opacity-90"
                        >
                          Open in Studio
                        </button>
                        {prop.status !== 'Accepted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateProposalStatus(prop, 'Accepted')}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            Mark Accepted
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeletingProposal(prop)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fullscreen Interactive HTML Artifact Modal */}
      <Modal
        open={fullscreenArtifactOpen}
        onClose={() => setFullscreenArtifactOpen(false)}
        title={`Interactive HTML Proposal Artifact — ${projectTitle}`}
        maxWidth="max-w-5xl"
      >
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 p-2">
          <iframe
            title="Fullscreen Interactive HTML Proposal"
            srcDoc={htmlProposal}
            className="w-full h-[76vh] rounded-lg bg-white border border-slate-200"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingProposal)}
        onClose={() => setDeletingProposal(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Proposal"
        description={`Are you sure you want to delete proposal ${deletingProposal?.proposal_number} for ${deletingProposal?.company_name}?`}
        confirmLabel="Delete Proposal"
        variant="danger"
        loading={deletingLoading}
      />
    </div>
  );
};
