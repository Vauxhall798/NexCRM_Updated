import React, { useEffect, useMemo, useState } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Download,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Edit3,
  Trash2,
  ExternalLink,
  UserCheck,
  Building2,
  FolderCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  BauCategory,
  BauPriority,
  BauSummary,
  BauTicket,
  BauTicketState,
  Client,
  NavTab,
  Project,
  User,
} from '../types/crm';
import {
  BAU_CATEGORIES,
  BAU_PRIORITIES,
  BAU_STATES,
  exportToCsv,
  formatDate,
  formatDateTime,
  getBauPriorityBadge,
  getBauStateBadge,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

interface BauPageProps {
  users: User[];
  onNavigate: (tab: NavTab, id?: string) => void;
}

interface BauFormState {
  client_id: string;
  project_id: string;
  title: string;
  description: string;
  category: BauCategory;
  priority: BauPriority;
  state: BauTicketState;
  reported_by: string;
  assignee_id: string;
  resolution_notes: string;
  sla_due_date: string;
}

const emptyForm: BauFormState = {
  client_id: '',
  project_id: '',
  title: '',
  description: '',
  category: 'Bug / Defect',
  priority: 'Medium',
  state: 'New',
  reported_by: '',
  assignee_id: '',
  resolution_notes: '',
  sla_due_date: '',
};

export const BauPage: React.FC<BauPageProps> = ({ users, onNavigate }) => {
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<BauTicket[]>([]);
  const [summary, setSummary] = useState<BauSummary>({
    total: 0,
    newCount: 0,
    wipCount: 0,
    pendingCount: 0,
    resolvedCount: 0,
    criticalCount: 0,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [onlyFinishedProjects, setOnlyFinishedProjects] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<BauTicket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<BauTicket | null>(null);
  const [form, setForm] = useState<BauFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BauTicket | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (stateFilter) params.set('state', stateFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (clientFilter) params.set('client_id', clientFilter);
      if (projectFilter) params.set('project_id', projectFilter);

      const [bauRes, clientsRes, projectsRes] = await Promise.all([
        apiFetch<{ tickets: BauTicket[]; summary: BauSummary }>(
          `/bau-tickets?${params.toString()}`
        ),
        apiFetch<{ clients: Client[] }>('/clients'),
        apiFetch<{ projects: Project[] }>('/projects'),
      ]);

      setTickets(bauRes.tickets);
      setSummary(bauRes.summary);
      setClients(clientsRes.clients);
      setProjects(projectsRes.projects);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load BAU tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, stateFilter, priorityFilter, clientFilter, projectFilter]);

  const finishedProjects = useMemo(
    () => projects.filter((p) => p.status === 'Completed'),
    [projects]
  );

  const displayedTickets = useMemo(() => {
    if (!onlyFinishedProjects) return tickets;
    return tickets.filter((t) => t.project?.status === 'Completed');
  }, [tickets, onlyFinishedProjects]);

  const availableProjectsForForm = useMemo(() => {
    const filtered = form.client_id
      ? projects.filter((p) => p.client_id === form.client_id)
      : projects;
    return [...filtered].sort((a, b) => {
      if (a.status === 'Completed' && b.status !== 'Completed') return -1;
      if (a.status !== 'Completed' && b.status === 'Completed') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [projects, form.client_id]);

  const openCreateModal = (presetState: BauTicketState = 'New') => {
    setEditingTicket(null);
    const defaultProject = finishedProjects[0] || projects[0];
    const matchingClient = clients.find((c) => c.id === defaultProject?.client_id);

    setForm({
      ...emptyForm,
      state: presetState,
      project_id: defaultProject?.id || '',
      client_id: defaultProject?.client_id || clients[0]?.id || '',
      reported_by: matchingClient?.contact_name || '',
      assignee_id: users[0]?.id || '',
    });
    setModalOpen(true);
  };

  const openEditModal = (ticket: BauTicket) => {
    setEditingTicket(ticket);
    setForm({
      client_id: ticket.client_id,
      project_id: ticket.project_id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      state: ticket.state,
      reported_by: ticket.reported_by,
      assignee_id: ticket.assignee_id || '',
      resolution_notes: ticket.resolution_notes || '',
      sla_due_date: toInputDate(ticket.sla_due_date),
    });
    setModalOpen(true);
  };

  const handleProjectSelectInForm = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) {
      setForm((prev) => ({ ...prev, project_id: projectId }));
      return;
    }
    const client = clients.find((c) => c.id === proj.client_id);
    setForm((prev) => ({
      ...prev,
      project_id: proj.id,
      client_id: proj.client_id,
      reported_by: prev.reported_by || client?.contact_name || '',
    }));
  };

  const handleClientSelectInForm = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    const clientProjects = projects.filter((p) => p.client_id === clientId);
    const preferredProject =
      clientProjects.find((p) => p.status === 'Completed') || clientProjects[0];

    setForm((prev) => ({
      ...prev,
      client_id: clientId,
      project_id: preferredProject?.id || '',
      reported_by: client?.contact_name || prev.reported_by,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.client_id) {
      showToast('Please select a project and client', 'error');
      return;
    }
    if (!form.title.trim() || !form.description.trim() || !form.reported_by.trim()) {
      showToast('Please fill in ticket title, description, and client reporter', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        assignee_id: form.assignee_id || null,
        resolution_notes: form.resolution_notes || '',
        sla_due_date: form.sla_due_date || null,
      };

      if (editingTicket) {
        await apiFetch(`/bau-tickets/${editingTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Ticket ${editingTicket.ticket_number} updated`, 'success');
      } else {
        await apiFetch('/bau-tickets', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('BAU ticket logged for project', 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save BAU ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStateChange = async (ticket: BauTicket, newState: BauTicketState) => {
    if (ticket.state === newState) return;
    try {
      await apiFetch(`/bau-tickets/${ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ state: newState }),
      });
      showToast(`${ticket.ticket_number} moved to "${newState}"`, 'success');
      await loadData();
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket((prev) => (prev ? { ...prev, state: newState } : null));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update ticket state', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiFetch(`/bau-tickets/${deleteTarget.id}`, { method: 'DELETE' });
      showToast(`Ticket ${deleteTarget.ticket_number} deleted`, 'success');
      setDeleteTarget(null);
      if (selectedTicket?.id === deleteTarget.id) setSelectedTicket(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete BAU ticket', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      'nexcrm-bau-tickets.csv',
      displayedTickets.map((t) => ({
        TicketNumber: t.ticket_number,
        Title: t.title,
        State: t.state,
        Priority: t.priority,
        Category: t.category,
        Project: t.project?.name || '',
        ProjectStatus: t.project?.status || '',
        Client: t.client?.company || '',
        ReportedBy: t.reported_by,
        Assignee: t.assignee?.name || 'Unassigned',
        CreatedAt: formatDate(t.created_at),
        ResolvedAt: formatDate(t.resolved_at),
      }))
    );
    showToast('Exported BAU tickets to CSV', 'info');
  };

  const stateColumnMeta: Record<
    BauTicketState,
    { accent: string; headerBg: string; dot: string; description: string }
  > = {
    New: {
      accent: 'border-t-4 border-t-sky-500',
      headerBg: 'bg-sky-50/70 dark:bg-sky-950/30',
      dot: 'bg-sky-500',
      description: 'Freshly logged by client',
    },
    'Work in progress': {
      accent: 'border-t-4 border-t-[#3596B0]',
      headerBg: 'bg-[#EEF8FA]/80 dark:bg-cyan-950/30',
      dot: 'bg-[#3596B0]',
      description: 'Actively being engineered',
    },
    Pending: {
      accent: 'border-t-4 border-t-amber-500',
      headerBg: 'bg-amber-50/70 dark:bg-amber-950/30',
      dot: 'bg-amber-500',
      description: 'Awaiting client input or UAT',
    },
    Resolved: {
      accent: 'border-t-4 border-t-emerald-500',
      headerBg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
      dot: 'bg-emerald-500',
      description: 'Verified & deployed to prod',
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F2547] dark:bg-[#3596B0] text-white flex items-center justify-center shrink-0 shadow-sm">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[#0F2547] dark:text-slate-100">
                BAU Support & Post-Delivery Tickets
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#EEF8FA] dark:bg-slate-800 text-[#3596B0] border border-[#B0E0EC] dark:border-slate-700">
                Finished Projects Desk
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!displayedTickets.length}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => openCreateModal('New')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F2547] hover:bg-[#193B6E] dark:bg-[#3596B0] dark:hover:bg-[#2A7B91] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log BAU Ticket
          </button>
        </div>
      </div>

      {/* State Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStateFilter('')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            stateFilter === ''
              ? 'bg-[#0F2547] text-white border-[#0F2547] shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#3596B0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                stateFilter === '' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Total Tickets
            </span>
            <LifeBuoy
              className={`w-4 h-4 ${
                stateFilter === '' ? 'text-[#49AFCB]' : 'text-[#3596B0]'
              }`}
            />
          </div>
          <div className="text-2xl font-extrabold mt-2">{summary.total}</div>
          <div
            className={`text-[11px] mt-1 ${
              stateFilter === '' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {summary.criticalCount} critical open
          </div>
        </div>

        <div
          onClick={() => setStateFilter(stateFilter === 'New' ? '' : 'New')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            stateFilter === 'New'
              ? 'ring-2 ring-sky-500 bg-sky-50/60 dark:bg-sky-950/40 border-sky-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              1. New
            </span>
            <Sparkles className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.newCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Awaiting triage
          </div>
        </div>

        <div
          onClick={() =>
            setStateFilter(stateFilter === 'Work in progress' ? '' : 'Work in progress')
          }
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            stateFilter === 'Work in progress'
              ? 'ring-2 ring-[#3596B0] bg-[#EEF8FA]/60 dark:bg-cyan-950/40 border-[#3596B0]'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#3596B0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F2547] dark:text-[#7BC8DC]">
              2. Work in progress
            </span>
            <Clock className="w-4 h-4 text-[#3596B0]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.wipCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Active engineering
          </div>
        </div>

        <div
          onClick={() => setStateFilter(stateFilter === 'Pending' ? '' : 'Pending')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            stateFilter === 'Pending'
              ? 'ring-2 ring-amber-500 bg-amber-50/60 dark:bg-amber-950/40 border-amber-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              3. Pending
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Waiting on client / UAT
          </div>
        </div>

        <div
          onClick={() => setStateFilter(stateFilter === 'Resolved' ? '' : 'Resolved')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            stateFilter === 'Resolved'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              4. Resolved
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.resolvedCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Closed & verified
          </div>
        </div>
      </div>

      {/* Filters & View Switcher */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[210px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, title, reporter..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3596B0]"
            />
          </div>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All States</option>
            {BAU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All Priorities</option>
            {BAU_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company}
              </option>
            ))}
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyFinishedProjects(!onlyFinishedProjects)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              onlyFinishedProjects
                ? 'bg-[#EEF8FA] dark:bg-cyan-950/60 text-[#0F2547] dark:text-[#7BC8DC] border-[#3596B0]'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FolderCheck className="w-3.5 h-3.5 text-[#3596B0]" />
            Finished Projects Only
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-end lg:self-center">
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'board'
                ? 'bg-white dark:bg-slate-900 text-[#0F2547] dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            State Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-900 text-[#0F2547] dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Table View
          </button>
        </div>
      </div>

      {/* Main Content: Board or Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
          Loading BAU tickets...
        </div>
      ) : displayedTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF8FA] dark:bg-slate-800 text-[#3596B0] flex items-center justify-center mx-auto">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-[#0F2547] dark:text-slate-100">
            No BAU tickets match your filters
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Log a client ticket for any finished or delivered project to track it through New, Work in progress, Pending, and Resolved states.
          </p>
          <button
            type="button"
            onClick={() => openCreateModal('New')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F2547] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Log First BAU Ticket
          </button>
        </div>
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {BAU_STATES.map((colState) => {
            const colTickets = displayedTickets.filter((t) => t.state === colState);
            const meta = stateColumnMeta[colState];
            return (
              <div
                key={colState}
                className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-[520px] overflow-hidden ${meta.accent}`}
              >
                {/* Column Header */}
                <div
                  className={`p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${meta.headerBg}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <h3 className="text-xs font-bold text-[#0F2547] dark:text-slate-100">
                        {colState}
                      </h3>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {colTickets.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {meta.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCreateModal(colState)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F2547] hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
                    title={`Add ${colState} ticket`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Cards Stack */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {colTickets.length === 0 ? (
                    <div className="h-40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-[11px] text-slate-400">
                      No tickets in {colState}
                    </div>
                  ) : (
                    colTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-[#3596B0] transition-all space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#0F2547] text-white text-[10px] font-mono font-bold">
                            {ticket.ticket_number}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBauPriorityBadge(
                                ticket.priority
                              )}`}
                            >
                              {ticket.priority}
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditModal(ticket)}
                              className="p-1 rounded-lg text-slate-400 hover:text-[#0F2547] dark:hover:text-white"
                              title="Edit ticket"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div
                          onClick={() => setSelectedTicket(ticket)}
                          className="cursor-pointer group"
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#3596B0] transition-colors line-clamp-2">
                            {ticket.title}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {ticket.description}
                          </p>
                        </div>

                        {/* Project & Client Context */}
                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                ticket.project && onNavigate('projects', ticket.project.id)
                              }
                              className="inline-flex items-center gap-1 font-semibold text-[#0F2547] dark:text-[#7BC8DC] hover:underline truncate"
                            >
                              <FolderCheck className="w-3 h-3 shrink-0 text-[#3596B0]" />
                              <span className="truncate">{ticket.project?.name}</span>
                            </button>
                            {ticket.project?.status === 'Completed' && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-semibold border border-emerald-200 dark:border-emerald-800 shrink-0">
                                Finished
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 truncate">
                              <Building2 className="w-3 h-3 shrink-0" />
                              {ticket.client?.company}
                            </span>
                            <span className="inline-flex items-center gap-1 truncate">
                              <UserCheck className="w-3 h-3 shrink-0" />
                              {ticket.assignee?.name || 'Unassigned'}
                            </span>
                          </div>
                        </div>

                        {/* Quick State Mover */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">Move state:</span>
                          <select
                            value={ticket.state}
                            onChange={(e) =>
                              handleQuickStateChange(ticket, e.target.value as BauTicketState)
                            }
                            className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#3596B0]"
                          >
                            {BAU_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Ticket</th>
                  <th className="py-3.5 px-4">Finished Project & Client</th>
                  <th className="py-3.5 px-4">Category & Priority</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">Reported By</th>
                  <th className="py-3.5 px-4">Assignee</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {displayedTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#0F2547] text-white text-[10px] font-mono font-bold">
                          {ticket.ticket_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(ticket)}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-[#3596B0] text-left"
                        >
                          {ticket.title}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {ticket.description}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() =>
                          ticket.project && onNavigate('projects', ticket.project.id)
                        }
                        className="font-semibold text-[#0F2547] dark:text-[#7BC8DC] hover:underline inline-flex items-center gap-1"
                      >
                        {ticket.project?.name}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{ticket.client?.company}</span>
                        {ticket.project?.status === 'Completed' && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-semibold border border-emerald-200 dark:border-emerald-800">
                            Finished
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-700 dark:text-slate-300">
                        {ticket.category}
                      </div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBauPriorityBadge(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={ticket.state}
                        onChange={(e) =>
                          handleQuickStateChange(ticket, e.target.value as BauTicketState)
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${getBauStateBadge(
                          ticket.state
                        )}`}
                      >
                        {BAU_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {ticket.reported_by}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDate(ticket.created_at)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {ticket.assignee?.name || 'Unassigned'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(ticket)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(ticket)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Ticket Detail Modal */}
      <Modal
        open={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        title={
          selectedTicket
            ? `${selectedTicket.ticket_number} — ${selectedTicket.title}`
            : 'BAU Ticket Details'
        }
      >
        {selectedTicket && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full font-semibold border ${getBauStateBadge(
                    selectedTicket.state
                  )}`}
                >
                  {selectedTicket.state}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full font-semibold border ${getBauPriorityBadge(
                    selectedTicket.priority
                  )}`}
                >
                  {selectedTicket.priority} Priority
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  {selectedTicket.category}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const t = selectedTicket;
                    setSelectedTicket(null);
                    openEditModal(t);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Edit Ticket
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Finished / Delivered Project
                </div>
                <div className="font-bold text-[#0F2547] dark:text-slate-100 mt-0.5">
                  {selectedTicket.project?.name} ({selectedTicket.project?.status})
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Client Account
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {selectedTicket.client?.company}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Client Reporter
                </div>
                <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {selectedTicket.reported_by}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Assigned Engineer
                </div>
                <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {selectedTicket.assignee?.name || 'Unassigned'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">
                Issue Description
              </div>
              <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {selectedTicket.description}
              </p>
            </div>

            {selectedTicket.resolution_notes && (
              <div>
                <div className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">
                  Engineering & Resolution Notes
                </div>
                <p className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-200 whitespace-pre-line">
                  {selectedTicket.resolution_notes}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
              <span>Logged: {formatDateTime(selectedTicket.created_at)}</span>
              {selectedTicket.resolved_at && (
                <span>Resolved: {formatDateTime(selectedTicket.resolved_at)}</span>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Log / Edit BAU Ticket Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingTicket
            ? `Edit ${editingTicket.ticket_number}`
            : 'Log BAU Ticket for Finished Project'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-[#EEF8FA] dark:bg-slate-800/80 border border-[#B0E0EC] dark:border-slate-700 text-[11px] text-[#0F2547] dark:text-[#7BC8DC]">
            Select the delivered project and client below. Completed projects are listed first.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project *
              </label>
              <select
                required
                value={form.project_id}
                onChange={(e) => handleProjectSelectInForm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select project...</option>
                {availableProjectsForForm.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.status === 'Completed' ? '✓ [Finished] ' : `[${p.status}] `}
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client *
              </label>
              <select
                required
                value={form.client_id}
                onChange={(e) => handleClientSelectInForm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ticket Summary / Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Webhook retry timeout on settlement batch export"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ticket State *
              </label>
              <select
                value={form.state}
                onChange={(e) =>
                  setForm({ ...form, state: e.target.value as BauTicketState })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              >
                {BAU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority *
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as BauPriority })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {BAU_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as BauCategory })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {BAU_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reported By (Client Contact) *
              </label>
              <input
                type="text"
                required
                value={form.reported_by}
                onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
                placeholder="Contact person"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Engineer
              </label>
              <select
                value={form.assignee_id}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target SLA Date
              </label>
              <input
                type="date"
                value={form.sla_due_date}
                onChange={(e) => setForm({ ...form, sla_due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Detailed Description & Steps *
            </label>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what the client reported on the delivered project..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Engineering / Resolution Notes
            </label>
            <textarea
              rows={2}
              value={form.resolution_notes}
              onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })}
              placeholder="Root cause, PR link, or reason ticket is pending/resolved..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#0F2547] hover:bg-[#193B6E] dark:bg-[#3596B0] text-white font-semibold disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingTicket
                ? 'Update Ticket'
                : 'Log BAU Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete BAU Ticket"
        description={
          deleteTarget
            ? `Are you sure you want to delete ticket ${deleteTarget.ticket_number} ("${deleteTarget.title}")?`
            : ''
        }
        confirmLabel="Delete Ticket"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
