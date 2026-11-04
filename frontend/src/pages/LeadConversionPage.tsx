import React, { useEffect, useState, useMemo } from 'react';
import {
  Kanban,
  Table as TableIcon,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  History,
  ExternalLink,
  Search,
  ArrowRight,
  Sparkles,
  GripVertical,
  Rocket,
  Building2,
  FolderKanban,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Conversion,
  ConversionHistoryItem,
  ConversionOutcome,
  ConversionSummary,
  NavTab,
  NotConvertedReason,
  ProjectStatus,
  ServiceType,
} from '../types/crm';
import {
  CURRENCIES,
  formatCurrency,
  formatDate,
  formatDateTime,
  getConversionBadge,
  NOT_CONVERTED_REASONS,
  PROJECT_STATUSES,
  SERVICE_TYPES,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface LeadConversionPageProps {
  initialLeadId?: string | null;
  onClearInitialId?: () => void;
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

export const LeadConversionPage: React.FC<LeadConversionPageProps> = ({
  initialLeadId,
  onClearInitialId,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [summary, setSummary] = useState<ConversionSummary>({
    total: 0,
    converted: 0,
    not_converted: 0,
    in_progress: 0,
    conversion_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');

  // Outcome Modal State
  const [activeConversion, setActiveConversion] = useState<Conversion | null>(null);
  const [targetOutcome, setTargetOutcome] = useState<ConversionOutcome>('converted');
  const [dealValue, setDealValue] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [decidedAt, setDecidedAt] = useState(toInputDate(new Date().toISOString()));
  const [reason, setReason] = useState<NotConvertedReason>('Budget');
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // History Modal State
  const [historyConversion, setHistoryConversion] = useState<Conversion | null>(null);

  // Official Client & Project Onboarding Modal State
  const [onboardConv, setOnboardConv] = useState<Conversion | null>(null);
  const [onboardCompany, setOnboardCompany] = useState('');
  const [onboardContactName, setOnboardContactName] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardIndustry, setOnboardIndustry] = useState('');
  const [onboardWebsite, setOnboardWebsite] = useState('');
  const [onboardAddress, setOnboardAddress] = useState('');
  const [onboardClientNotes, setOnboardClientNotes] = useState('');
  const [onboardProjectName, setOnboardProjectName] = useState('');
  const [onboardServiceType, setOnboardServiceType] = useState<ServiceType>('AI services');
  const [onboardProjectStatus, setOnboardProjectStatus] = useState<ProjectStatus>('In progress');
  const [onboardBudget, setOnboardBudget] = useState('0');
  const [onboardCurrency, setOnboardCurrency] = useState('INR');
  const [onboardStartDate, setOnboardStartDate] = useState(toInputDate(new Date().toISOString()));
  const [onboardEndDate, setOnboardEndDate] = useState('');
  const [onboardTechStack, setOnboardTechStack] = useState('');
  const [onboardProjectDesc, setOnboardProjectDesc] = useState('');
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);

  // Drag & Drop State
  const [draggedConvId, setDraggedConvId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ConversionOutcome | null>(null);

  const openOnboardModal = (conv: Conversion) => {
    setOnboardConv(conv);
    setOnboardCompany(conv.lead.company || '');
    setOnboardContactName(conv.lead.name || '');
    setOnboardEmail(conv.lead.email || '');
    setOnboardPhone(conv.lead.phone || '');
    setOnboardIndustry('Enterprise Technology');
    setOnboardWebsite(
      `https://${conv.lead.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    );
    setOnboardAddress('');
    setOnboardClientNotes(conv.comment || conv.lead.notes || '');
    setOnboardProjectName(`${conv.lead.company} — ${conv.lead.service} Transformation`);
    setOnboardServiceType(conv.lead.service || 'AI services');
    setOnboardProjectStatus('In progress');
    setOnboardBudget(String(conv.deal_value ?? conv.lead.budget ?? 0));
    setOnboardCurrency(conv.currency || conv.lead.currency || 'INR');
    const today = new Date();
    const targetEnd = new Date();
    targetEnd.setDate(today.getDate() + 60);
    setOnboardStartDate(toInputDate(today.toISOString()));
    setOnboardEndDate(toInputDate(targetEnd.toISOString()));
    setOnboardTechStack('TypeScript, React, Node.js, Cloud Architecture');
    setOnboardProjectDesc(conv.comment || conv.lead.notes || '');
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardConv) return;
    setOnboardingSubmitting(true);
    try {
      const res = await apiFetch<{
        client: { id: string; company: string };
        project: { id: string; name: string } | null;
      }>('/conversions/onboard', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: onboardConv.lead_id,
          company: onboardCompany,
          contact_name: onboardContactName,
          email: onboardEmail,
          phone: onboardPhone,
          industry: onboardIndustry,
          website: onboardWebsite,
          address: onboardAddress,
          client_notes: onboardClientNotes,
          project_name: onboardProjectName,
          service_type: onboardServiceType,
          project_status: onboardProjectStatus,
          start_date: onboardStartDate,
          end_date: onboardEndDate,
          budget: Number(onboardBudget) || 0,
          currency: onboardCurrency,
          tech_stack: onboardTechStack,
          project_description: onboardProjectDesc,
        }),
      });
      showToast(
        res.project
          ? `Onboarded Official Client "${res.client.company}" & Kicked Off Project "${res.project.name}"!`
          : `Onboarded Official Client "${res.client.company}"!`
      );
      setOnboardConv(null);
      fetchConversions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to onboard client & project', 'error');
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  const fetchConversions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ conversions: Conversion[]; summary: ConversionSummary }>(
        '/conversions'
      );
      setConversions(res.conversions);
      setSummary(res.summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load conversions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversions();
  }, []);

  useEffect(() => {
    if (initialLeadId && conversions.length > 0) {
      const found = conversions.find((c) => c.lead_id === initialLeadId);
      if (found) {
        if (found.outcome === 'converted') {
          openOnboardModal(found);
        }
        onClearInitialId?.();
      }
    }
  }, [initialLeadId, conversions]);

  const filteredConversions = useMemo(() => {
    if (!search.trim()) return conversions;
    const q = search.toLowerCase().trim();
    return conversions.filter(
      (c) =>
        c.lead.name.toLowerCase().includes(q) ||
        c.lead.company.toLowerCase().includes(q) ||
        c.lead.service.toLowerCase().includes(q) ||
        (c.reason && c.reason.toLowerCase().includes(q))
    );
  }, [conversions, search]);

  const openOutcomeModal = (conv: Conversion, outcome: ConversionOutcome) => {
    setActiveConversion(conv);
    setTargetOutcome(outcome);
    setDealValue(String(conv.deal_value ?? conv.lead.budget ?? 0));
    setCurrency(conv.currency || conv.lead.currency || 'USD');
    setDecidedAt(
      conv.decided_at ? toInputDate(conv.decided_at) : toInputDate(new Date().toISOString())
    );
    setReason((conv.reason as NotConvertedReason) || 'Budget');
    setComment(conv.comment || '');
    setFormError(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, conv: Conversion) => {
    setDraggedConvId(conv.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', conv.id);
  };

  const handleDragEnd = () => {
    setDraggedConvId(null);
    setDragOverCol(null);
  };

  const handleDragOverCol = (e: React.DragEvent<HTMLDivElement>, colKey: ConversionOutcome) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleDropOnCol = async (
    e: React.DragEvent<HTMLDivElement>,
    targetCol: ConversionOutcome
  ) => {
    e.preventDefault();
    const convId = e.dataTransfer.getData('text/plain') || draggedConvId;
    setDraggedConvId(null);
    setDragOverCol(null);

    if (!convId) return;
    const conv = conversions.find((c) => c.id === convId);
    if (!conv || conv.outcome === targetCol) return;

    if (targetCol === 'in_progress') {
      // Optimistically move card back to In Progress immediately
      setConversions((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, outcome: 'in_progress' } : c))
      );
      try {
        await apiFetch(`/conversions/${conv.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            outcome: 'in_progress',
            comment: conv.comment || 'Moved back to In Progress via Kanban drag-and-drop',
          }),
        });
        showToast(`Moved "${conv.lead.company}" to In Progress`, 'info');
        fetchConversions();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to move lead', 'error');
        fetchConversions();
      }
      return;
    }

    // For Converted or Not Converted, open the confirmation modal pre-selected to the dropped column
    openOutcomeModal(conv, targetCol);
  };

  const handleConfirmOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversion) return;
    setFormError(null);

    if (targetOutcome === 'converted') {
      const num = Number(dealValue);
      if (Number.isNaN(num) || num < 0) {
        setFormError('Please enter a valid deal value.');
        return;
      }
      if (!decidedAt) {
        setFormError('Please select the conversion decision date.');
        return;
      }
    }

    if (targetOutcome === 'not_converted' && !reason) {
      setFormError('Please select a reason for Not Converted.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        outcome: targetOutcome,
        deal_value: targetOutcome === 'converted' ? Number(dealValue) : activeConversion.deal_value,
        currency,
        decided_at: decidedAt,
        reason: targetOutcome === 'not_converted' ? reason : null,
        comment: comment.trim() || null,
      };

      const res = await apiFetch<{ conversion: Conversion; client?: { id: string; company: string } }>(
        `/conversions/${activeConversion.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );

      if (targetOutcome === 'converted') {
        showToast(
          `Converted "${activeConversion.lead.company}" and created linked Client record!`
        );
      } else if (targetOutcome === 'not_converted') {
        showToast(`Marked "${activeConversion.lead.company}" as Not Converted (${reason}).`, 'info');
      } else {
        showToast(`Moved "${activeConversion.lead.company}" back to In Progress.`, 'info');
      }

      setActiveConversion(null);
      fetchConversions();
      void res;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update conversion outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const parseHistory = (historyJson: string): ConversionHistoryItem[] => {
    try {
      const arr = JSON.parse(historyJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const columns: Array<{
    key: ConversionOutcome;
    title: string;
    subtitle: string;
    badgeClass: string;
  }> = [
    {
      key: 'in_progress',
      title: 'In Progress',
      subtitle: 'Evaluating proposal & contract terms',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    {
      key: 'converted',
      title: 'Converted (Won)',
      subtitle: 'Signed deal & automatically created Client',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    {
      key: 'not_converted',
      title: 'Not Converted (Lost)',
      subtitle: 'Closed with documented reason',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Lead Conversion Decisions
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter conversions..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* 5 Summary Cards at the Top */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total in Conversion
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary.total}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>Converted</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {summary.converted}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <span>Not Converted</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {summary.not_converted}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span>In Progress</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {summary.in_progress}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Conversion Rate</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
            {summary.conversion_rate}%
          </div>
        </div>
      </div>

      {/* Main Content: Kanban or Table */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading conversion pipeline...
        </div>
      ) : filteredConversions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <EmptyState
            icon={Kanban}
            title="No leads in the Conversion pipeline"
            description="Go to the Leads tab and click 'Move to Conversion' on any lead to evaluate its outcome here."
            actionLabel="Go to Leads"
            onAction={() => onNavigate('leads')}
          />
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {columns.map((col) => {
            const colItems = filteredConversions.filter((c) => c.outcome === col.key);
            const isDropTarget = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => handleDragOverCol(e, col.key)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDropOnCol(e, col.key)}
                className={`flex flex-col rounded-2xl border p-4 min-h-[460px] transition-all duration-200 ${
                  isDropTarget
                    ? 'bg-[#EEF8FA]/70 dark:bg-cyan-950/30 border-[#3596B0] ring-2 ring-[#3596B0]/50 shadow-md'
                    : 'bg-slate-100/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {col.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full border ${col.badgeClass}`}
                      >
                        {colItems.length}
                      </span>
                    </div>
                  </div>
                  {isDropTarget && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3596B0] animate-pulse">
                      Drop here
                    </span>
                  )}
                </div>

                <div className="space-y-3 flex-1">
                  {colItems.length === 0 ? (
                    <div
                      className={`h-40 rounded-xl border border-dashed flex items-center justify-center text-xs transition-colors ${
                        isDropTarget
                          ? 'border-[#3596B0] bg-white/60 dark:bg-slate-900/50 text-[#0F2547] dark:text-[#7BC8DC] font-semibold'
                          : 'border-slate-300 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {isDropTarget ? `Drop card to mark ${col.title}` : `No leads in ${col.title}`}
                    </div>
                  ) : (
                    colItems.map((conv) => {
                      const historyList = parseHistory(conv.history);
                      const isDragging = draggedConvId === conv.id;
                      return (
                        <div
                          key={conv.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, conv)}
                          onDragEnd={handleDragEnd}
                          className={`p-4 rounded-xl bg-white dark:bg-slate-900 border shadow-xs space-y-3 transition-all cursor-grab active:cursor-grabbing ${
                            isDragging
                              ? 'opacity-45 scale-[0.98] border-[#3596B0] ring-2 ring-[#3596B0]/40'
                              : 'border-slate-200 dark:border-slate-800 hover:border-[#3596B0] dark:hover:border-[#3596B0]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                  {conv.lead.company}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {conv.lead.name} &bull; {conv.lead.service}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setHistoryConversion(conv)}
                              title="View outcome change history"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <History className="w-3.5 h-3.5" />
                              {historyList.length}
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-slate-500 dark:text-slate-400">
                              {conv.outcome === 'converted' ? 'Deal Value:' : 'Est. Value:'}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(
                                conv.deal_value ?? conv.lead.budget,
                                conv.currency || conv.lead.currency
                              )}
                            </span>
                          </div>

                          {conv.outcome === 'not_converted' && conv.reason && (
                            <div className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60 text-xs">
                              <div className="font-semibold text-rose-700 dark:text-rose-300">
                                Reason: {conv.reason}
                              </div>
                              {conv.comment && (
                                <div className="text-rose-600/90 dark:text-rose-400 text-[11px] mt-0.5">
                                  {conv.comment}
                                </div>
                              )}
                            </div>
                          )}

                          {conv.outcome === 'converted' && (
                            <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                                  Decided {formatDate(conv.decided_at)}
                                </span>
                                {conv.lead.client && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigate('clients', conv.lead.client?.id)}
                                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                                  >
                                    Client Profile <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {conv.comment && (
                                <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                                  {conv.comment}
                                </div>
                              )}
                            </div>
                          )}

                          {conv.outcome === 'in_progress' && conv.comment && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                              &ldquo;{conv.comment}&rdquo;
                            </p>
                          )}

                          {/* Action Buttons to Mark / Change Outcome */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                            {conv.outcome === 'in_progress' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openOutcomeModal(conv, 'converted')}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Mark Converted
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openOutcomeModal(conv, 'not_converted')}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Not Converted
                                </button>
                              </>
                            )}

                            {conv.outcome === 'converted' && (
                              <div className="w-full space-y-2">
                                <button
                                  type="button"
                                  onClick={() => openOnboardModal(conv)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-xs transition-colors"
                                >
                                  <Rocket className="w-3.5 h-3.5 text-[#3596B0]" />
                                  Onboard Client &amp; Project
                                </button>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Converted
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openOutcomeModal(conv, 'converted')}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                      Change Outcome
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openOutcomeModal(conv, 'in_progress')}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                      Reopen
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {conv.outcome === 'not_converted' && (
                              <>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  Not Converted
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openOutcomeModal(conv, 'not_converted')}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    Change Outcome
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openOutcomeModal(conv, 'in_progress')}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    Reopen
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Lead &amp; Company</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4">Outcome</th>
                  <th className="py-3.5 px-4">Deal Value</th>
                  <th className="py-3.5 px-4">Reason / Notes</th>
                  <th className="py-3.5 px-4">Decided Date</th>
                  <th className="py-3.5 px-4 text-right">Update Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                {filteredConversions.map((conv) => (
                  <tr
                    key={conv.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {conv.lead.company}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {conv.lead.name} &bull; {conv.lead.email}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {conv.lead.service}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getConversionBadge(
                          conv.outcome
                        )}`}
                      >
                        {conv.outcome === 'converted'
                          ? 'Converted'
                          : conv.outcome === 'not_converted'
                          ? 'Not Converted'
                          : 'In Progress'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {formatCurrency(
                        conv.deal_value ?? conv.lead.budget,
                        conv.currency || conv.lead.currency
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                      {conv.reason && (
                        <span className="font-semibold text-rose-600 dark:text-rose-400 mr-1.5">
                          [{conv.reason}]
                        </span>
                      )}
                      <span>{conv.comment || '—'}</span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(conv.decided_at)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {conv.outcome === 'converted' && (
                          <button
                            type="button"
                            onClick={() => openOnboardModal(conv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#0F2547] hover:bg-[#193A6B] text-white"
                          >
                            <Rocket className="w-3.5 h-3.5 text-[#3596B0]" />
                            Onboard
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openOutcomeModal(conv, 'converted')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Convert
                        </button>
                        <button
                          type="button"
                          onClick={() => openOutcomeModal(conv, 'not_converted')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-50"
                        >
                          Lost
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryConversion(conv)}
                          title="Outcome Change History"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record or Change Conversion Outcome */}
      <Modal
        open={Boolean(activeConversion)}
        onClose={() => setActiveConversion(null)}
        title={
          targetOutcome === 'converted'
            ? `Confirm Conversion — ${activeConversion?.lead.company}`
            : targetOutcome === 'not_converted'
            ? `Mark as Not Converted — ${activeConversion?.lead.company}`
            : `Move Back to In Progress — ${activeConversion?.lead.company}`
        }
        subtitle="Any change in outcome is logged in the conversion audit trail."
        maxWidth="max-w-lg"
      >
        {activeConversion && (
          <form onSubmit={handleConfirmOutcome} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            {/* Outcome Switcher Tabs inside Modal */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setTargetOutcome('converted')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  targetOutcome === 'converted'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Converted
              </button>
              <button
                type="button"
                onClick={() => setTargetOutcome('not_converted')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  targetOutcome === 'not_converted'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Not Converted
              </button>
              <button
                type="button"
                onClick={() => setTargetOutcome('in_progress')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  targetOutcome === 'in_progress'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                In Progress
              </button>
            </div>

            {targetOutcome === 'converted' && (
              <>
                <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    Confirming will automatically create a linked <strong>Client</strong> record for{' '}
                    <strong>{activeConversion.lead.company}</strong> ({activeConversion.lead.name},{' '}
                    {activeConversion.lead.email}).
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Final Deal Value *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Decision / Contract Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={decidedAt}
                    onChange={(e) => setDecidedAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </>
            )}

            {targetOutcome === 'not_converted' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Reason for Not Converting *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as NotConvertedReason)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {NOT_CONVERTED_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {targetOutcome === 'not_converted'
                  ? 'Optional Comment / Post-Mortem Note'
                  : 'Deal Notes / Comment'}
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  targetOutcome === 'converted'
                    ? 'e.g. Signed MSA and Phase 1 SOW...'
                    : 'e.g. Prospect chose lower-cost template solution...'
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveConversion(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 ${
                  targetOutcome === 'converted'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : targetOutcome === 'not_converted'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {submitting
                  ? 'Saving...'
                  : targetOutcome === 'converted'
                  ? 'Confirm & Create Client'
                  : 'Save Outcome'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Outcome Change Audit History */}
      <Modal
        open={Boolean(historyConversion)}
        onClose={() => setHistoryConversion(null)}
        title={`Outcome History — ${historyConversion?.lead.company || ''}`}
        subtitle="Audit log of conversion status changes recorded for this lead."
        maxWidth="max-w-lg"
      >
        {historyConversion && (
          <div className="space-y-3">
            {parseHistory(historyConversion.history).length === 0 ? (
              <p className="text-xs text-slate-400">No history entries recorded.</p>
            ) : (
              parseHistory(historyConversion.history).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.changed_by || 'System'}
                    </span>
                    <span>{formatDateTime(item.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-[11px]">
                      {item.from_outcome || 'Lead Pipeline'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getConversionBadge(
                        item.to_outcome
                      )}`}
                    >
                      {item.to_outcome}
                    </span>
                  </div>
                  {item.deal_value !== undefined && item.deal_value !== null && (
                    <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      Deal Value: {formatCurrency(item.deal_value, item.currency || 'USD')}
                    </div>
                  )}
                  {item.reason && (
                    <div className="text-rose-600 dark:text-rose-400 font-medium">
                      Reason: {item.reason}
                    </div>
                  )}
                  {(item.comment || item.note) && (
                    <div className="text-slate-600 dark:text-slate-300">
                      {item.comment || item.note}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Official Client & Project Onboarding */}
      <Modal
        open={Boolean(onboardConv)}
        onClose={() => setOnboardConv(null)}
        title={`Onboard Official Client & Project — ${onboardConv?.lead.company || ''}`}
        maxWidth="max-w-2xl"
      >
        {onboardConv && (
          <form onSubmit={handleOnboardSubmit} className="space-y-5">
            {/* Section 1: Official Client Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F2547] dark:text-[#7BC8DC]">
                <Building2 className="w-4 h-4 text-[#3596B0]" />
                <span>1. Official Client Onboarding Profile</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardCompany}
                    onChange={(e) => setOnboardCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardContactName}
                    onChange={(e) => setOnboardContactName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={onboardEmail}
                    onChange={(e) => setOnboardEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={onboardPhone}
                    onChange={(e) => setOnboardPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Industry Sector
                  </label>
                  <input
                    type="text"
                    value={onboardIndustry}
                    onChange={(e) => setOnboardIndustry(e.target.value)}
                    placeholder="e.g. FinTech, Healthcare, Logistics"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={onboardWebsite}
                    onChange={(e) => setOnboardWebsite(e.target.value)}
                    placeholder="https://company.com"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Headquarters Address
                </label>
                <input
                  type="text"
                  value={onboardAddress}
                  onChange={(e) => setOnboardAddress(e.target.value)}
                  placeholder="Street, City, Country"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Section 2: Project Kickoff Onboarding */}
            <div className="p-4 rounded-2xl bg-[#EEF8FA]/60 dark:bg-cyan-950/20 border border-[#B0E0EC] dark:border-cyan-900/60 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F2547] dark:text-[#7BC8DC]">
                <FolderKanban className="w-4 h-4 text-[#3596B0]" />
                <span>2. Project Onboarding &amp; Kickoff</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardProjectName}
                    onChange={(e) => setOnboardProjectName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service Type
                  </label>
                  <select
                    value={onboardServiceType}
                    onChange={(e) => setOnboardServiceType(e.target.value as ServiceType)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
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
                    Initial Project Status
                  </label>
                  <select
                    value={onboardProjectStatus}
                    onChange={(e) => setOnboardProjectStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Budget
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={onboardBudget}
                      onChange={(e) => setOnboardBudget(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <select
                      value={onboardCurrency}
                      onChange={(e) => setOnboardCurrency(e.target.value)}
                      className="w-24 px-2 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tech Stack
                  </label>
                  <input
                    type="text"
                    value={onboardTechStack}
                    onChange={(e) => setOnboardTechStack(e.target.value)}
                    placeholder="React, Node.js, PostgreSQL, AWS"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kickoff Start Date
                  </label>
                  <input
                    type="date"
                    value={onboardStartDate}
                    onChange={(e) => setOnboardStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Delivery Date
                  </label>
                  <input
                    type="date"
                    value={onboardEndDate}
                    onChange={(e) => setOnboardEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Scope &amp; Deliverables
                </label>
                <textarea
                  rows={2}
                  value={onboardProjectDesc}
                  onChange={(e) => setOnboardProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOnboardConv(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={onboardingSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-[#0F2547] hover:bg-[#193A6B] text-white disabled:opacity-50"
              >
                <Rocket className="w-4 h-4 text-[#3596B0]" />
                {onboardingSubmitting
                  ? 'Onboarding...'
                  : 'Complete Client & Project Onboarding'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

