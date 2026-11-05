import React, { useEffect, useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  Calendar,
  Building2,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Percent,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Client,
  ClientPayment,
  NavTab,
  PaymentMethod,
  PaymentStatus,
  PaymentsSummary,
  Project,
  ProjectPaymentGroup,
} from '../types/crm';
import {
  exportToCsv,
  formatCurrency,
  formatDate,
  getPaymentStatusBadge,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface ClientPaymentsPageProps {
  initialProjectId?: string | null;
  onClearInitialId?: () => void;
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

interface PaymentFormState {
  client_id: string;
  project_id: string;
  phase_name: string;
  phase_number: number;
  amount: string;
  currency: string;
  percentage: string;
  status: PaymentStatus;
  due_date: string;
  paid_date: string;
  paid_amount: string;
  invoice_number: string;
  payment_method: PaymentMethod;
  transaction_ref: string;
  notes: string;
}

const emptyPaymentForm: PaymentFormState = {
  client_id: '',
  project_id: '',
  phase_name: '',
  phase_number: 1,
  amount: '',
  currency: 'INR',
  percentage: '25',
  status: 'Pending',
  due_date: toInputDate(new Date(Date.now() + 30 * 86400000).toISOString()),
  paid_date: '',
  paid_amount: '',
  invoice_number: '',
  payment_method: 'Bank Transfer / NEFT',
  transaction_ref: '',
  notes: '',
};

export const ClientPaymentsPage: React.FC<ClientPaymentsPageProps> = ({
  initialProjectId,
  onClearInitialId,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectPaymentGroup[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary>({
    total_contract_value: 0,
    total_collected: 0,
    total_pending: 0,
    total_overdue: 0,
    collection_rate: 0,
    total_phases: 0,
    paid_phases: 0,
    pending_phases: 0,
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [viewMode, setViewMode] = useState<'project_phases' | 'all_table'>('project_phases');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState(initialProjectId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ClientPayment | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick "Mark as Paid" Modal
  const [payingPhase, setPayingPhase] = useState<ClientPayment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toInputDate(new Date().toISOString()));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer / NEFT');
  const [payUtr, setPayUtr] = useState('');
  const [payInvoice, setPayInvoice] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  // Auto-Generate Phases Modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateProjectId, setGenerateProjectId] = useState('');
  const [generateTemplate, setGenerateTemplate] = useState<'4_phases' | '3_phases' | '5_phases'>('4_phases');
  const [markAdvanceAsPaid, setMarkAdvanceAsPaid] = useState(false);
  const [submittingGenerate, setSubmittingGenerate] = useState(false);

  // Delete Dialog
  const [deletingPayment, setDeletingPayment] = useState<ClientPayment | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Fetch Payments & Groups
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientFilter !== 'ALL') params.set('client_id', clientFilter);
      if (projectFilter !== 'ALL') params.set('project_id', projectFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch<{
        payments: ClientPayment[];
        project_groups: ProjectPaymentGroup[];
        summary: PaymentsSummary;
      }>(`/payments?${params.toString()}`);

      setPayments(res.payments);
      setProjectGroups(res.project_groups);
      setSummary(res.summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch reference clients and projects for selectors
  useEffect(() => {
    Promise.all([
      apiFetch<{ clients: Client[] }>('/clients').catch(() => ({ clients: [] })),
      apiFetch<{ projects: Project[] }>('/projects').catch(() => ({ projects: [] })),
    ]).then(([clientsRes, projectsRes]) => {
      setClients(clientsRes.clients || []);
      setProjects(projectsRes.projects || []);
    });
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [clientFilter, projectFilter, statusFilter, search]);

  useEffect(() => {
    if (initialProjectId) {
      setProjectFilter(initialProjectId);
      onClearInitialId?.();
    }
  }, [initialProjectId]);

  // Projects available for selected client in the Add/Edit form
  const availableProjectsForForm = useMemo(() => {
    if (!form.client_id) return projects;
    return projects.filter((p) => p.client_id === form.client_id);
  }, [projects, form.client_id]);

  // Open Add Modal
  const openCreateModal = (preselectedProjectId?: string) => {
    setEditingPayment(null);
    let targetClientId = '';
    let targetProjectId = preselectedProjectId || '';

    if (targetProjectId) {
      const proj = projects.find((p) => p.id === targetProjectId);
      if (proj) {
        targetClientId = proj.client_id;
      }
    } else if (clientFilter !== 'ALL') {
      targetClientId = clientFilter;
    }

    setForm({
      ...emptyPaymentForm,
      client_id: targetClientId,
      project_id: targetProjectId,
      due_date: toInputDate(new Date(Date.now() + 30 * 86400000).toISOString()),
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (payment: ClientPayment) => {
    setEditingPayment(payment);
    setForm({
      client_id: payment.client_id,
      project_id: payment.project_id,
      phase_name: payment.phase_name,
      phase_number: payment.phase_number || 1,
      amount: String(payment.amount),
      currency: payment.currency || 'INR',
      percentage: String(payment.percentage || 0),
      status: payment.status,
      due_date: toInputDate(payment.due_date),
      paid_date: payment.paid_date ? toInputDate(payment.paid_date) : '',
      paid_amount: String(payment.paid_amount || payment.amount || 0),
      invoice_number: payment.invoice_number || '',
      payment_method: payment.payment_method || 'Bank Transfer / NEFT',
      transaction_ref: payment.transaction_ref || '',
      notes: payment.notes || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Save Add/Edit Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.client_id) {
      setFormError('Please select a Client.');
      return;
    }
    if (!form.project_id) {
      setFormError('Please select a Project.');
      return;
    }
    if (!form.phase_name.trim()) {
      setFormError('Phase / Milestone name is required.');
      return;
    }

    const amountNum = Number(form.amount);
    if (Number.isNaN(amountNum) || amountNum < 0) {
      setFormError('Phase payment amount must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        client_id: form.client_id,
        project_id: form.project_id,
        phase_name: form.phase_name.trim(),
        phase_number: Number(form.phase_number) || 1,
        amount: amountNum,
        currency: form.currency,
        percentage: Number(form.percentage) || 0,
        status: form.status,
        due_date: form.due_date,
        paid_date: form.paid_date || null,
        paid_amount: form.status === 'Paid' ? (Number(form.paid_amount) || amountNum) : Number(form.paid_amount || 0),
        invoice_number: form.invoice_number.trim(),
        payment_method: form.payment_method,
        transaction_ref: form.transaction_ref.trim(),
        notes: form.notes.trim(),
      };

      if (editingPayment) {
        await apiFetch(`/payments/${editingPayment.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated phase "${payload.phase_name}"`);
      } else {
        await apiFetch('/payments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Recorded payment phase "${payload.phase_name}"`);
      }

      setModalOpen(false);
      fetchPayments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save payment phase');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Mark as Paid Modal
  const openPayModal = (payment: ClientPayment) => {
    setPayingPhase(payment);
    setPayAmount(String(payment.amount));
    setPayDate(toInputDate(new Date().toISOString()));
    setPayMethod(payment.payment_method || 'Bank Transfer / NEFT');
    setPayUtr(payment.transaction_ref || '');
    setPayInvoice(payment.invoice_number || '');
  };

  const handleConfirmPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPhase) return;
    setSubmittingPay(true);
    try {
      await apiFetch(`/payments/${payingPhase.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Paid',
          paid_date: payDate,
          paid_amount: Number(payAmount) || payingPhase.amount,
          payment_method: payMethod,
          transaction_ref: payUtr.trim(),
          invoice_number: payInvoice.trim(),
        }),
      });
      showToast(`Marked "${payingPhase.phase_name}" as Paid (${formatCurrency(Number(payAmount) || payingPhase.amount)})`);
      setPayingPhase(null);
      fetchPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to mark as paid', 'error');
    } finally {
      setSubmittingPay(false);
    }
  };

  // Auto Generate Phases Wizard
  const handleAutoGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateProjectId) {
      showToast('Please select a project to generate phases for', 'error');
      return;
    }
    setSubmittingGenerate(true);
    try {
      const res = await apiFetch<{ message: string }>('/payments/generate-phases', {
        method: 'POST',
        body: JSON.stringify({
          project_id: generateProjectId,
          template: generateTemplate,
          mark_advance_as_paid: markAdvanceAsPaid,
        }),
      });
      showToast(res.message);
      setGenerateModalOpen(false);
      fetchPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate phases', 'error');
    } finally {
      setSubmittingGenerate(false);
    }
  };

  // Delete Payment
  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/payments/${deletingPayment.id}`, { method: 'DELETE' });
      showToast(`Deleted payment phase "${deletingPayment.phase_name}"`);
      setDeletingPayment(null);
      fetchPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete payment phase', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const rows = payments.map((p) => ({
      Client: p.client?.company || '',
      Project: p.project?.name || '',
      Phase_Number: p.phase_number,
      Phase_Name: p.phase_name,
      Percentage: `${p.percentage}%`,
      Amount: p.amount,
      Currency: p.currency,
      Status: p.status,
      Due_Date: formatDate(p.due_date),
      Paid_Date: formatDate(p.paid_date),
      Paid_Amount: p.paid_amount,
      Invoice_Number: p.invoice_number || '',
      Payment_Method: p.payment_method || '',
      Transaction_Ref: p.transaction_ref || '',
      Notes: p.notes || '',
    }));
    exportToCsv(`client_payments_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Client Payment Phases &amp; Milestone Billing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track payments of clients in structured milestone phases in respect to each project.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={payments.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setGenerateProjectId(projects[0]?.id || '');
              setMarkAdvanceAsPaid(false);
              setGenerateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Auto-Generate Phases
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Payment Phase
          </button>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Contract Value
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(summary.total_contract_value)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Across {summary.total_phases} milestone phases
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>Total Collected</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {formatCurrency(summary.total_collected)}
          </div>
          <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400 mt-0.5">
            {summary.paid_phases} phases cleared
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <span>Pending / Invoiced</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {formatCurrency(summary.total_pending)}
          </div>
          <div className="text-[11px] text-blue-600/90 dark:text-blue-400 mt-0.5">
            {summary.pending_phases} phases scheduled
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <span>Overdue Collections</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {formatCurrency(summary.total_overdue)}
          </div>
          <div className="text-[11px] text-rose-600/90 dark:text-rose-400 mt-0.5">
            Requires follow-up action
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Collection Rate</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
            {summary.collection_rate}%
          </div>
          <div className="text-[11px] text-indigo-600/90 dark:text-indigo-400 mt-0.5">
            Of scheduled project budgets
          </div>
        </div>
      </div>

      {/* Filter Toolbar & View Mode Switcher */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phase, client, project, invoice or UTR..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setProjectFilter('ALL');
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company}
              </option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Projects</option>
            {(clientFilter === 'ALL'
              ? projects
              : projects.filter((p) => p.client_id === clientFilter)
            ).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Statuses</option>
            {PAYMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* View Switcher: Project Phase Breakdown vs Table */}
        <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('project_phases')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              viewMode === 'project_phases'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Phases by Project
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              viewMode === 'all_table'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            All Payments Table
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading client payment phases...
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <EmptyState
            icon={CreditCard}
            title="No Client Payments Recorded Yet"
            description="Track client milestone payments by adding custom phases or automatically generating 3 to 5 milestone phases based on project budgets."
            actionLabel="Add Payment Phase"
            onAction={() => openCreateModal()}
          />
        </div>
      ) : viewMode === 'project_phases' ? (
        /* Phases by Project View */
        <div className="space-y-6">
          {projectGroups.map((group) => {
            return (
              <div
                key={group.project_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* Project Header Banner */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        <FolderKanban className="w-4 h-4" />
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {group.project_name}
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {group.project_status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        <strong>{group.client_name}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>{group.service_type}</span>
                    </div>
                  </div>

                  {/* Financials & Add Phase Button */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Collected: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(group.total_collected, group.currency)}</strong> / {formatCurrency(group.project_budget || group.total_phases_amount, group.currency)}
                      </div>
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                        {group.collection_progress_pct}% Total Recovered
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openCreateModal(group.project_id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Phase
                    </button>
                  </div>
                </div>

                {/* Progress Bar of Milestone Phases */}
                <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/20">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
                    <span>Phase Payment Journey</span>
                    <span>{group.phases.filter((p) => p.status === 'Paid').length} of {group.phases.length} Phases Paid</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    {group.phases.map((phase) => {
                      const pct = phase.percentage > 0 ? phase.percentage : (100 / group.phases.length);
                      const bg =
                        phase.status === 'Paid'
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : phase.status === 'Invoiced'
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : phase.status === 'Partially Paid'
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : phase.is_overdue || phase.status === 'Overdue'
                          ? 'bg-rose-500 hover:bg-rose-600'
                          : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400';
                      return (
                        <div
                          key={phase.id}
                          style={{ width: `${pct}%` }}
                          title={`${phase.phase_name}: ${formatCurrency(phase.amount, phase.currency)} (${phase.status})`}
                          className={`${bg} h-full border-r border-white dark:border-slate-900 transition-all cursor-pointer`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Grid of Phases for this Project */}
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {group.phases.map((phase) => {
                      const isPaid = phase.status === 'Paid';
                      const isOverdue = phase.is_overdue || phase.status === 'Overdue';

                      return (
                        <div
                          key={phase.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                            isPaid
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/60'
                              : isOverdue
                              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                              : phase.status === 'Invoiced'
                              ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Phase {phase.phase_number} &bull; {phase.percentage}%
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getPaymentStatusBadge(
                                  phase.status
                                )}`}
                              >
                                {phase.status}
                              </span>
                            </div>

                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                              {phase.phase_name}
                            </h4>

                            <div className="mt-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                              {formatCurrency(phase.amount, phase.currency)}
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Due Date:</span>
                                <span className={isOverdue ? 'text-rose-600 font-bold' : 'font-medium'}>
                                  {formatDate(phase.due_date)}
                                </span>
                              </div>

                              {isPaid && (
                                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <span>Paid On:</span>
                                  <span>{formatDate(phase.paid_date)}</span>
                                </div>
                              )}

                              {phase.invoice_number && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">Invoice:</span>
                                  <span className="font-mono">{phase.invoice_number}</span>
                                </div>
                              )}

                              {phase.transaction_ref && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">UTR / Ref:</span>
                                  <span className="font-mono truncate max-w-[120px]" title={phase.transaction_ref}>
                                    {phase.transaction_ref}
                                  </span>
                                </div>
                              )}

                              {phase.notes && (
                                <p className="text-[11px] text-slate-500 italic pt-1 truncate" title={phase.notes}>
                                  &ldquo;{phase.notes}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Phase Action Buttons */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                            {!isPaid ? (
                              <button
                                type="button"
                                onClick={() => openPayModal(phase)}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Mark as Paid
                              </button>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Paid in full
                              </span>
                            )}

                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(phase)}
                                title="Edit Phase"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingPayment(phase)}
                                title="Delete Phase"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* All Payments Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Client &amp; Project</th>
                  <th className="py-3.5 px-4">Phase / Milestone</th>
                  <th className="py-3.5 px-4">Amount &amp; %</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Paid Date</th>
                  <th className="py-3.5 px-4">Invoice &amp; Reference</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                {payments.map((p) => {
                  const isPaid = p.status === 'Paid';
                  const isOverdue = p.is_overdue || p.status === 'Overdue';
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {p.client?.company}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <FolderKanban className="w-3 h-3 text-slate-400" />
                          <span>{p.project?.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                          {p.phase_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Phase {p.phase_number}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {formatCurrency(p.amount, p.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.percentage}% of project
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getPaymentStatusBadge(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {formatDate(p.due_date)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {isPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {formatDate(p.paid_date)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        {p.invoice_number ? (
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {p.invoice_number}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {p.transaction_ref && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ref: {p.transaction_ref}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => openPayModal(p)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Receive
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Edit Phase"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPayment(p)}
                            title="Delete Phase"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Payment Phase Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPayment ? 'Edit Client Payment Phase' : 'Add Client Payment Phase'}
        subtitle="Schedule or record a milestone payment phase for a project"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client *
              </label>
              <select
                value={form.client_id}
                onChange={(e) => {
                  const newClientId = e.target.value;
                  const matchingProj = projects.find((p) => p.client_id === newClientId);
                  setForm({
                    ...form,
                    client_id: newClientId,
                    project_id: matchingProj?.id || '',
                  });
                }}
                disabled={Boolean(editingPayment)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">Select a Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project *
              </label>
              <select
                value={form.project_id}
                onChange={(e) => {
                  const newProjId = e.target.value;
                  const proj = projects.find((p) => p.id === newProjId);
                  setForm({
                    ...form,
                    project_id: newProjId,
                    currency: proj?.currency || 'INR',
                  });
                }}
                disabled={Boolean(editingPayment)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">Select a Project</option>
                {availableProjectsForForm.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatCurrency(p.budget, p.currency)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phase / Milestone Title *
              </label>
              <input
                type="text"
                value={form.phase_name}
                onChange={(e) => setForm({ ...form, phase_name: e.target.value })}
                placeholder="e.g. Phase 1: Advance / Kickoff"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phase #
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.phase_number}
                onChange={(e) => setForm({ ...form, phase_number: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phase Amount (₹) *
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="250000"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Budget Share (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                placeholder="25"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              >
                {PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.status === 'Paid' && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  Received / Paid Date
                </label>
                <input
                  type="date"
                  value={form.paid_date}
                  onChange={(e) => setForm({ ...form, paid_date: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  Transaction / UTR Reference
                </label>
                <input
                  type="text"
                  value={form.transaction_ref}
                  onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })}
                  placeholder="e.g. UTR87654321"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Number (Optional)
              </label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="e.g. INV-2026-001"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Milestone Notes / Deliverables
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Scope triggers, deliverables checklist..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Saving Phase...' : editingPayment ? 'Confirm & Update Phase' : 'Confirm & Create Phase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Mark as Paid Modal */}
      <Modal
        open={Boolean(payingPhase)}
        onClose={() => setPayingPhase(null)}
        title={`Receive Payment: ${payingPhase?.phase_name}`}
        subtitle={`Client: ${payingPhase?.client?.company} • Project: ${payingPhase?.project?.name}`}
        maxWidth="max-w-md"
      >
        {payingPhase && (
          <form onSubmit={handleConfirmPaid} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Scheduled Amount:</span>
              <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(payingPhase.amount, payingPhase.currency)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount Received (₹) *
              </label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Received Date *
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Reference / UTR
                </label>
                <input
                  type="text"
                  value={payUtr}
                  onChange={(e) => setPayUtr(e.target.value)}
                  placeholder="e.g. UTR12345678"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={payInvoice}
                  onChange={(e) => setPayInvoice(e.target.value)}
                  placeholder="e.g. INV-2026-001"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPayingPhase(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPay}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                {submittingPay ? 'Recording...' : 'Confirm Receipt'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Auto-Generate Milestone Phases Wizard Modal */}
      <Modal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Auto-Generate Project Milestone Phases"
        subtitle="Automatically divide project budget into structured billing milestone phases"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAutoGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Project *
            </label>
            <select
              value={generateProjectId}
              onChange={(e) => setGenerateProjectId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.budget, p.currency)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Milestone Breakdown Template *
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generateTemplate === '4_phases'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={generateTemplate === '4_phases'}
                  onChange={() => setGenerateTemplate('4_phases')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    4-Phase Standard (25% / 25% / 25% / 25%)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Kickoff (25%) &rarr; Prototype (25%) &rarr; UAT (25%) &rarr; Production Go-Live (25%)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generateTemplate === '3_phases'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={generateTemplate === '3_phases'}
                  onChange={() => setGenerateTemplate('3_phases')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    3-Phase Milestone (40% / 40% / 20%)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Advance (40%) &rarr; Core Build (40%) &rarr; Delivery Sign-off (20%)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generateTemplate === '5_phases'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={generateTemplate === '5_phases'}
                  onChange={() => setGenerateTemplate('5_phases')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    5-Phase Enterprise (20% / 20% / 30% / 20% / 10%)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Initiation (20%) &rarr; Arch (20%) &rarr; Build (30%) &rarr; UAT (20%) &rarr; Handover (10%)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* User Consent Toggle for Initial Phase */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markAdvanceAsPaid}
                onChange={(e) => setMarkAdvanceAsPaid(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Mark Phase 1 (Advance) as already paid
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Keep unchecked (default) so all phases remain &quot;Pending&quot; until you explicitly confirm receiving payment.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingGenerate}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {submittingGenerate ? 'Generating...' : 'Confirm & Generate Phases'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeletePayment}
        loading={deletingLoading}
        title="Delete Payment Phase"
        description={`Are you sure you want to delete "${deletingPayment?.phase_name}" (${formatCurrency(deletingPayment?.amount, deletingPayment?.currency)})? This will remove this phase from project billing.`}
        confirmLabel="Delete Phase"
      />
    </div>
  );
};

