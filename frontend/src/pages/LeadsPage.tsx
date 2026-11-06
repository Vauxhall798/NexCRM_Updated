import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  ArrowUpDown,
  Edit3,
  Trash2,
  Eye,
  AlertCircle,
  MessageSquarePlus,
  Users,
  Calendar,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  Rocket,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Lead, LeadNote, LeadSource, LeadStatus, NavTab, ServiceType, User, Resource } from '../types/crm';
import {
  CURRENCIES,
  exportToCsv,
  formatCurrency,
  formatDate,
  formatDateTime,
  getLeadStatusBadge,
  isFollowupOverdue,
  LEAD_SOURCES,
  LEAD_STATUSES,
  SERVICE_TYPES,
  toInputDate,
} from '../lib/utils';
import { Modal, Drawer } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { FollowUpEmailModal } from '../components/FollowUpEmailModal';

interface LeadsPageProps {
  users: User[];
  currentUser?: User | null;
  initialLeadId?: string | null;
  onClearInitialId?: () => void;
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

interface LeadFormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  service: ServiceType;
  budget: string;
  currency: string;
  status: LeadStatus;
  owner_id: string;
  next_followup: string;
  followup_resource: string;
  notes: string;
}

const emptyLeadForm: LeadFormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  source: 'Website',
  service: 'AI services',
  budget: '250000',
  currency: 'INR',
  status: 'New',
  owner_id: '',
  next_followup: '',
  followup_resource: '',
  notes: '',
};

export const LeadsPage: React.FC<LeadsPageProps> = ({
  users,
  currentUser,
  initialLeadId,
  onClearInitialId,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'company' | 'budget' | 'next_followup'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyLeadForm);
  const [formWorkNote, setFormWorkNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Detail Drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [drawerFollowupDate, setDrawerFollowupDate] = useState('');
  const [drawerFollowupResource, setDrawerFollowupResource] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Quick Follow-up & Work Note Modal
  const [workNoteModalOpen, setWorkNoteModalOpen] = useState(false);
  const [workNoteLead, setWorkNoteLead] = useState<Lead | null>(null);
  const [workNoteText, setWorkNoteText] = useState('');
  const [workNoteFollowupDate, setWorkNoteFollowupDate] = useState('');
  const [workNoteResource, setWorkNoteResource] = useState('');
  const [workNoteStatus, setWorkNoteStatus] = useState<LeadStatus>('New');
  const [submittingWorkNote, setSubmittingWorkNote] = useState(false);

  // Email Follow-up Modal & Automation
  const [emailModalLead, setEmailModalLead] = useState<Lead | null>(null);
  const [runningBatch, setRunningBatch] = useState(false);

  // Available internal resources for follow-up assignment suggestions
  const [internalResources, setInternalResources] = useState<Resource[]>([]);

  useEffect(() => {
    apiFetch<{ resources: Resource[] }>('/resources')
      .then((res) => {
        if (res?.resources) setInternalResources(res.resources);
      })
      .catch(() => {});
  }, []);

  const resourceSuggestions = useMemo(() => {
    const list: string[] = [];
    users.forEach((u) => {
      if (u.name && !list.includes(u.name)) list.push(u.name);
    });
    internalResources.forEach((r) => {
      const label = `${r.name} (${r.role_title})`;
      if (!list.includes(label)) list.push(label);
    });
    return list;
  }, [users, internalResources]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (ownerFilter !== 'ALL') params.set('owner_id', ownerFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('sort_by', sortBy);
      params.set('sort_dir', sortDir);

      const res = await apiFetch<{ leads: Lead[] }>(`/leads?${params.toString()}`);
      setLeads(res.leads);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, sourceFilter, ownerFilter, dateFrom, dateTo, sortBy, sortDir]);

  // Open detail drawer if navigated with initialLeadId
  useEffect(() => {
    if (initialLeadId && leads.length > 0) {
      const found = leads.find((l) => l.id === initialLeadId);
      if (found) {
        setSelectedLead(found);
        onClearInitialId?.();
      }
    }
  }, [initialLeadId, leads]);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase().trim();
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.service.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sourceFilter, ownerFilter, dateFrom, dateTo]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const openAddModal = () => {
    setEditingLead(null);
    setForm({
      ...emptyLeadForm,
      owner_id: users[0]?.id || '',
    });
    setFormWorkNote('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      service: lead.service,
      budget: String(lead.budget ?? 0),
      currency: lead.currency || 'USD',
      status: lead.status,
      owner_id: lead.owner_id || '',
      next_followup: toInputDate(lead.next_followup),
      followup_resource: lead.followup_resource || '',
      notes: lead.notes || '',
    });
    setFormWorkNote('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.company.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError('Name, Company, Email, and Phone are required.');
      return;
    }

    const budgetNum = Number(form.budget);
    if (Number.isNaN(budgetNum) || budgetNum < 0) {
      setFormError('Estimated budget must be a valid non-negative number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        source: form.source,
        service: form.service,
        budget: budgetNum,
        currency: form.currency,
        status: form.status,
        owner_id: form.owner_id || null,
        next_followup: form.next_followup || null,
        followup_resource: form.followup_resource.trim(),
        notes: form.notes.trim(),
      };
      if (formWorkNote.trim()) {
        payload.work_note = formWorkNote.trim();
      }

      if (editingLead) {
        const res = await apiFetch<{ lead: Lead }>(`/leads/${editingLead.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated lead "${res.lead.name}"`);
        if (selectedLead?.id === res.lead.id) {
          setSelectedLead(res.lead);
        }
      } else {
        const res = await apiFetch<{ lead: Lead }>('/leads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Created lead "${res.lead.name}"`);
      }

      setModalOpen(false);
      fetchLeads();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!deletingLead) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/leads/${deletingLead.id}`, { method: 'DELETE' });
      showToast(`Deleted lead "${deletingLead.name}"`);
      if (selectedLead?.id === deletingLead.id) {
        setSelectedLead(null);
      }
      setDeletingLead(null);
      fetchLeads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete lead', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newNoteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await apiFetch<{ note: LeadNote; lead: Lead }>(`/leads/${selectedLead.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          text: newNoteText.trim(),
          next_followup: drawerFollowupDate || undefined,
          followup_resource: drawerFollowupResource || undefined,
        }),
      });
      setNewNoteText('');
      setDrawerFollowupDate('');
      setDrawerFollowupResource('');
      setSelectedLead(res.lead);
      fetchLeads();
      showToast(`Work note logged by ${currentUser?.name || 'login 1'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add note', 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    try {
      await apiFetch(`/leads/${selectedLead.id}/notes/${noteId}`, { method: 'DELETE' });
      const refreshed = await apiFetch<{ lead: Lead }>(`/leads/${selectedLead.id}`);
      setSelectedLead(refreshed.lead);
      fetchLeads();
      showToast('Deleted note');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete note', 'error');
    }
  };

  const openWorkNoteModal = (lead: Lead) => {
    setWorkNoteLead(lead);
    setWorkNoteText('');
    setWorkNoteFollowupDate(toInputDate(lead.next_followup));
    setWorkNoteResource(lead.followup_resource || '');
    setWorkNoteStatus(lead.status);
    setWorkNoteModalOpen(true);
  };

  const handleSaveWorkNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workNoteLead || !workNoteText.trim()) {
      showToast('Please enter a work note', 'error');
      return;
    }
    setSubmittingWorkNote(true);
    try {
      const res = await apiFetch<{ note: LeadNote; lead: Lead }>(`/leads/${workNoteLead.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          text: workNoteText.trim(),
          next_followup: workNoteFollowupDate || null,
          followup_resource: workNoteResource || '',
          status: workNoteStatus !== workNoteLead.status ? workNoteStatus : undefined,
        }),
      });

      showToast(`Work note logged by ${currentUser?.name || 'login 1'}`);
      setWorkNoteModalOpen(false);
      setWorkNoteText('');
      setWorkNoteResource('');

      if (selectedLead?.id === workNoteLead.id) {
        setSelectedLead(res.lead);
      }
      fetchLeads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save work note', 'error');
    } finally {
      setSubmittingWorkNote(false);
    }
  };

  const setQuickFollowupDate = (days: number, target: 'modal' | 'drawer') => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().split('T')[0];
    if (target === 'modal') {
      setWorkNoteFollowupDate(iso);
    } else {
      setDrawerFollowupDate(iso);
    }
  };

  const dueFollowupsCount = useMemo(() => {
    return leads.filter(
      (l) => isFollowupOverdue(l.next_followup) && l.status !== 'Converted' && l.status !== 'Not converted'
    ).length;
  }, [leads]);

  const handleRunAutomatedBatch = async () => {
    if (runningBatch) return;
    if (dueFollowupsCount === 0) {
      showToast('No leads are currently overdue for follow-up.', 'info');
      return;
    }
    const confirmed = window.confirm(
      `Run automated follow-up dispatch for ${dueFollowupsCount} overdue lead(s)?\n\n` +
      `• Generates tailored email drafts for each overdue lead\n` +
      `• Dispatches via active email transport (or CRM Simulated Mode)\n` +
      `• Automatically logs an audit work note authored by ${currentUser?.name || 'CRM System'}\n` +
      `• Schedules the next follow-up (+4 days)`
    );
    if (!confirmed) return;

    setRunningBatch(true);
    try {
      const res = await apiFetch<{ dispatched: number; summary: string }>('/automation/run-batch', {
        method: 'POST',
        body: JSON.stringify({ sent_by_user_id: currentUser?.id }),
      });
      showToast(res.summary || `Automated follow-up batch complete: ${res.dispatched} processed.`);
      fetchLeads();
    } catch (err: any) {
      showToast(err?.message || 'Failed to run automated follow-up batch', 'error');
    } finally {
      setRunningBatch(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredLeads.map((l) => ({
      Name: l.name,
      Company: l.company,
      Email: l.email,
      Phone: l.phone,
      Source: l.source,
      Service: l.service,
      Budget: l.budget,
      Currency: l.currency,
      Status: l.status,
      Owner: l.owner?.name || 'Unassigned',
      Next_Followup: formatDate(l.next_followup),
      Conversion_Status: l.conversion?.outcome || 'Not in conversion',
      Created_At: formatDate(l.created_at),
    }));
    exportToCsv('nexcrm-leads.csv', rows);
    showToast(`Exported ${rows.length} leads to CSV`);
  };

  return (
    <div className="space-y-5">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Leads Pipeline</h2>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunAutomatedBatch}
            disabled={runningBatch || dueFollowupsCount === 0}
            title={dueFollowupsCount > 0 ? `Automate follow-ups for ${dueFollowupsCount} overdue leads` : 'No overdue follow-ups'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all ${
              dueFollowupsCount > 0
                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 shadow-xs cursor-pointer'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${dueFollowupsCount > 0 ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : ''}`} />
            <span>{runningBatch ? 'Automating...' : 'Automate Due Follow-ups'}</span>
            {dueFollowupsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                {dueFollowupsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLeads.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead, company, email, service..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Owners</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Date added from"
              className="w-full px-2 py-2 text-[11px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
            />
            {(statusFilter !== 'ALL' ||
              sourceFilter !== 'ALL' ||
              ownerFilter !== 'ALL' ||
              dateFrom ||
              dateTo ||
              search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setSourceFilter('ALL');
                  setOwnerFilter('ALL');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            Loading leads...
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads match your criteria"
            description="Add a new incoming enquiry or clear your current search filters."
            actionLabel="Add Lead"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                      >
                        Lead &amp; Company
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Service &amp; Source</th>
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('budget')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                      >
                        Est. Budget
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Owner</th>
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('next_followup')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                      >
                        Next Follow-up
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                  {paginatedLeads.map((lead) => {
                    const overdue =
                      lead.status !== 'Converted' &&
                      lead.status !== 'Not converted' &&
                      isFollowupOverdue(lead.next_followup) &&
                      (!lead.conversion || lead.conversion.outcome === 'in_progress');
                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors ${
                          overdue
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/80 dark:hover:bg-rose-950/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedLead(lead)}
                            className="text-left group"
                          >
                            <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {lead.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{lead.company}</span>
                              <span>&bull;</span>
                              <span className="truncate max-w-[160px]">{lead.email}</span>
                            </div>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {lead.service}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            via {lead.source}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                          {formatCurrency(lead.budget, lead.currency)}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${getLeadStatusBadge(
                              lead.status
                            )}`}
                          >
                            {lead.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                          {lead.owner?.name || 'Unassigned'}
                        </td>

                        <td className="py-3.5 px-4">
                          <div>
                            {lead.next_followup ? (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium w-fit ${
                                    overdue
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-semibold'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {overdue && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                                  {formatDate(lead.next_followup)}
                                  {overdue && (
                                    <span className="text-[10px] uppercase tracking-wider ml-0.5">
                                      Overdue
                                    </span>
                                  )}
                                </span>
                                {lead.followup_resource && (
                                  <span
                                    title={`Follow-up assigned to ${lead.followup_resource}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50/90 dark:bg-brand-950/60 px-2 py-0.5 rounded-md border border-brand-200/80 dark:border-brand-800/60 max-w-[200px] truncate"
                                  >
                                    <UserCheck className="w-3 h-3 text-brand-600 shrink-0" />
                                    <span className="truncate">{lead.followup_resource}</span>
                                  </span>
                                )}
                              </div>
                            ) : lead.followup_resource ? (
                              <span
                                title={`Follow-up assigned to ${lead.followup_resource}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50/90 dark:bg-brand-950/60 px-2 py-0.5 rounded-md border border-brand-200/80 dark:border-brand-800/60 max-w-[200px] truncate"
                              >
                                <UserCheck className="w-3 h-3 text-brand-600 shrink-0" />
                                <span className="truncate">{lead.followup_resource}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}

                            {lead.lead_notes && lead.lead_notes.length > 0 && (
                              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 max-w-[220px]">
                                <div
                                  className="truncate italic font-normal text-slate-700 dark:text-slate-300"
                                  title={lead.lead_notes[0].text}
                                >
                                  &ldquo;{lead.lead_notes[0].text}&rdquo;
                                </div>
                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <span>by {lead.lead_notes[0].author?.name || currentUser?.name || 'login 1'}</span>
                                  <span>&bull;</span>
                                  <span>{formatDate(lead.lead_notes[0].created_at)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {lead.status === 'Converted' && (
                              <button
                                type="button"
                                onClick={() => onNavigate('conversions', lead.id)}
                                title="Onboard Official Client & Project"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#0F2547] hover:bg-[#193A6B] text-white transition-colors"
                              >
                                <Rocket className="w-3 h-3 text-[#3596B0]" />
                                Onboard
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEmailModalLead(lead)}
                              title="Draft & Send Follow-up Email"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200/80 dark:border-emerald-800 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Email</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openWorkNoteModal(lead)}
                              title="Add Work Note / Follow-up"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/80 dark:border-indigo-800 transition-colors"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Note</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedLead(lead)}
                              title="View lead details & notes"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(lead)}
                              title="Edit lead"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingLead(lead)}
                              title="Delete lead"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredLeads.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Lead Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLead ? `Edit Lead — ${editingLead.name}` : 'Add New Lead'}
        subtitle="Enter the contact details, interested IT service, and next follow-up date."
      >
        <form onSubmit={handleSaveLead} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lead Name (Person) *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Elena Rostova"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. FinPulse Technologies"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="elena@company.com"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (415) 555-0190"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source *
              </label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Service Interested In *
              </label>
              <select
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value as ServiceType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Est. Budget
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-2 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Owner
              </label>
              <select
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Next Follow-up Date
              </label>
              <input
                type="date"
                value={form.next_followup}
                onChange={(e) => setForm({ ...form, next_followup: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Follow-up Resource
              </label>
              <input
                type="text"
                list="lead-resource-datalist"
                placeholder="e.g. Priya Sharma (Solutions Architect)"
                value={form.followup_resource}
                onChange={(e) => setForm({ ...form, followup_resource: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial / Summary Notes
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Project requirements, timeline expectations, technical constraints..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {editingLead && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Follow-up Work Note
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Logged by: <strong className="text-indigo-600 dark:text-indigo-400">{currentUser?.name || 'login 1'}</strong>
                </span>
              </div>
              <textarea
                rows={2}
                value={formWorkNote}
                onChange={(e) => setFormWorkNote(e.target.value)}
                placeholder="Record work notes or what was discussed in this follow-up..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingLead ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Lead Detail & Activity Log Drawer */}
      <Drawer
        open={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title={selectedLead ? selectedLead.name : 'Lead Details'}
        subtitle={selectedLead ? `${selectedLead.company} • ${selectedLead.service}` : ''}
      >
        {selectedLead && (
          <div className="space-y-6">
            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getLeadStatusBadge(
                    selectedLead.status
                  )}`}
                >
                  {selectedLead.status}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(selectedLead.budget, selectedLead.currency)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedLead)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                >
                  Edit Lead
                </button>
              </div>
            </div>

            {/* Contact & Lead Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  Contact Information
                </div>
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold">{selectedLead.company}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${selectedLead.email}`} className="hover:underline">
                    {selectedLead.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{selectedLead.phone}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  Enquiry Details
                </div>
                <div>
                  <span className="text-slate-500">Service:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLead.service}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Source:</span>{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedLead.source}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Owner:</span>{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedLead.owner?.name || 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Next Follow-up:</span>{' '}
                  <span
                    className={`font-semibold ${
                      isFollowupOverdue(selectedLead.next_followup)
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {formatDate(selectedLead.next_followup)}
                  </span>
                </div>
                {selectedLead.followup_resource && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="text-slate-500">Assigned Resource:</span>{' '}
                    <span className="font-bold text-brand-700 dark:text-brand-300">
                      {selectedLead.followup_resource}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {selectedLead.client && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Converted to Client: <strong>{selectedLead.client.company}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('clients', selectedLead.client?.id)}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  View Client &rarr;
                </button>
              </div>
            )}

            {/* Summary Notes */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Summary Notes
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedLead.notes || 'No summary notes provided.'}
              </div>
            </div>

            {/* Follow-up & Work Notes */}
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquarePlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Follow-up &amp; Work Notes ({selectedLead.lead_notes?.length || 0})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailModalLead(selectedLead)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200/80 dark:border-emerald-800 transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Follow-up Email</span>
                  </button>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Logged by: <span className="font-bold text-indigo-600 dark:text-indigo-400">{currentUser?.name || 'login 1'}</span>
                  </div>
                </div>
              </div>

              {/* Work Note Composer */}
              <form onSubmit={handleAddNote} className="p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Add Work Note
                  </label>
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Log a call summary, client feedback, pricing discussion, or next steps..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 shrink-0">Resource:</span>
                    <input
                      type="text"
                      list="lead-resource-datalist"
                      placeholder={selectedLead.followup_resource || 'Assign resource...'}
                      value={drawerFollowupResource}
                      onChange={(e) => setDrawerFollowupResource(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex-1 min-w-[120px]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 shrink-0">Follow-up:</span>
                    <input
                      type="date"
                      value={drawerFollowupDate}
                      onChange={(e) => setDrawerFollowupDate(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuickFollowupDate(2, 'drawer')}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      >
                        +2d
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickFollowupDate(7, 'drawer')}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      >
                        +1w
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={addingNote || !newNoteText.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors shadow-xs ml-auto"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    {addingNote ? 'Saving...' : 'Post Work Note'}
                  </button>
                </div>
              </form>

              {/* Notes Timeline List */}
              <div className="space-y-3">
                {!selectedLead.lead_notes || selectedLead.lead_notes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center">No work notes logged yet.</p>
                ) : (
                  selectedLead.lead_notes.map((note) => {
                    const authorName = note.author?.name || currentUser?.name || 'login 1';
                    const authorInitial = authorName.charAt(0).toUpperCase();
                    return (
                      <div
                        key={note.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                              {authorInitial}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {authorName}
                              </span>
                              {note.author?.role && (
                                <span className="px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {note.author.role}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">
                              {formatDateTime(note.created_at)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              title="Delete note"
                              className="text-slate-400 hover:text-rose-500 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {note.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Quick Follow-up / Work Note Modal */}
      <Modal
        open={workNoteModalOpen}
        onClose={() => setWorkNoteModalOpen(false)}
        title="Log Follow-up & Work Note"
        subtitle={workNoteLead ? `${workNoteLead.name} • ${workNoteLead.company}` : ''}
      >
        {workNoteLead && (
          <form onSubmit={handleSaveWorkNote} className="space-y-4">
            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Logged By (Author):</span>
              <span className="font-bold text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800">
                {currentUser?.name || 'login 1'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Work Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={workNoteText}
                onChange={(e) => setWorkNoteText(e.target.value)}
                placeholder="What was discussed in this follow-up? (e.g. Call summary, client requested quote for AI services, discussed timeline)..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Follow-up Resource
              </label>
              <input
                type="text"
                list="lead-resource-datalist"
                placeholder="e.g. Priya Sharma (Solutions Architect)"
                value={workNoteResource}
                onChange={(e) => setWorkNoteResource(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Next Follow-up Date
                </label>
                <input
                  type="date"
                  value={workNoteFollowupDate}
                  onChange={(e) => setWorkNoteFollowupDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickFollowupDate(2, 'modal')}
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                  >
                    +2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickFollowupDate(7, 'modal')}
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                  >
                    +1 Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickFollowupDate(14, 'modal')}
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                  >
                    +2 Weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkNoteFollowupDate('')}
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Status
                </label>
                <select
                  value={workNoteStatus}
                  onChange={(e) => setWorkNoteStatus(e.target.value as LeadStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {LEAD_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setWorkNoteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingWorkNote || !workNoteText.trim()}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors shadow-xs inline-flex items-center gap-1.5"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                {submittingWorkNote ? 'Saving Work Note...' : 'Save Work Note'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingLead)}
        onClose={() => setDeletingLead(null)}
        onConfirm={handleDeleteLead}
        loading={deletingLoading}
        title="Delete Lead"
        description={`Are you sure you want to permanently delete "${deletingLead?.name}" (${deletingLead?.company}) and its activity log? This action cannot be undone.`}
        confirmLabel="Delete Lead"
      />

      {/* Follow-up Email Composer & Automation Modal */}
      <FollowUpEmailModal
        open={Boolean(emailModalLead)}
        lead={emailModalLead}
        onClose={() => setEmailModalLead(null)}
        onSent={() => {
          fetchLeads();
          if (selectedLead && emailModalLead && selectedLead.id === emailModalLead.id) {
            apiFetch<{ lead: Lead }>(`/leads/${selectedLead.id}`)
              .then((res) => {
                if (res?.lead) setSelectedLead(res.lead);
              })
              .catch(() => {});
          }
        }}
      />

      <datalist id="lead-resource-datalist">
        {resourceSuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
};

