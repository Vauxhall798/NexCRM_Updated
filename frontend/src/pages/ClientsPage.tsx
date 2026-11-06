import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  Eye,
  Globe,
  MapPin,
  Mail,
  Phone,
  FolderPlus,
  ExternalLink,
  MessageSquarePlus,
  Building2,
  ArrowLeft,
  CreditCard,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import {
  Client,
  ClientStatus,
  NavTab,
  ProjectStatus,
  ServiceType,
  User,
} from '../types/crm';
import {
  CLIENT_STATUSES,
  CURRENCIES,
  exportToCsv,
  formatCurrency,
  formatDate,
  formatDateTime,
  getClientStatusBadge,
  getProjectStatusBadge,
  PROJECT_STATUSES,
  SERVICE_TYPES,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface ClientsPageProps {
  users: User[];
  initialClientId?: string | null;
  onClearInitialId?: () => void;
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

interface ClientFormState {
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  industry: string;
  status: ClientStatus;
  became_client_at: string;
  notes: string;
}

const emptyClientForm: ClientFormState = {
  company: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  industry: '',
  status: 'Active',
  became_client_at: toInputDate(new Date().toISOString()),
  notes: '',
};

export const ClientsPage: React.FC<ClientsPageProps> = ({
  users,
  initialClientId,
  onClearInitialId,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected Client Detail Page
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Add / Edit Client Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Client Confirmation (with cascade check if client has projects)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [forceDeleteRequired, setForceDeleteRequired] = useState(false);
  const [deleteProjectCount, setDeleteProjectCount] = useState(0);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Quick "Add Project" Modal (from Client Detail page with Client pre-selected)
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    service_type: 'Custom software' as ServiceType,
    status: 'Planned' as ProjectStatus,
    start_date: toInputDate(new Date().toISOString()),
    end_date: toInputDate(new Date(Date.now() + 30 * 86400000).toISOString()),
    budget: '45000',
    currency: 'USD',
    manager_id: '',
    tech_stack: 'TypeScript, React, Node.js',
    notes: '',
  });
  const [projectSubmitting, setProjectSubmitting] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await apiFetch<{ clients: Client[] }>(`/clients?${params.toString()}`);
      setClients(res.clients);
      if (selectedClient) {
        const updated = res.clients.find((c) => c.id === selectedClient.id);
        if (updated) setSelectedClient(updated);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [statusFilter]);

  useEffect(() => {
    if (initialClientId && clients.length > 0) {
      const found = clients.find((c) => c.id === initialClientId);
      if (found) {
        setSelectedClient(found);
        onClearInitialId?.();
      }
    }
  }, [initialClientId, clients]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.contact_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, currentPage]);

  const openAddModal = () => {
    setEditingClient(null);
    setForm(emptyClientForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setForm({
      company: client.company,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone,
      address: client.address || '',
      website: client.website || '',
      industry: client.industry || '',
      status: client.status,
      became_client_at: toInputDate(client.became_client_at),
      notes: client.notes || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.company.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setFormError('Company name, primary contact name, and email are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingClient) {
        const res = await apiFetch<{ client: Client }>(`/clients/${editingClient.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        showToast(`Updated client "${res.client.company}"`);
        if (selectedClient?.id === res.client.id) {
          setSelectedClient(res.client);
        }
      } else {
        const res = await apiFetch<{ client: Client }>('/clients', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        showToast(`Created client "${res.client.company}"`);
      }
      setModalOpen(false);
      fetchClients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSubmitting(false);
    }
  };

  const initiateDeleteClient = (client: Client) => {
    setDeletingClient(client);
    const projCount = client.projects?.length || 0;
    setDeleteProjectCount(projCount);
    setForceDeleteRequired(projCount > 0);
  };

  const handleConfirmDeleteClient = async () => {
    if (!deletingClient) return;
    setDeletingLoading(true);
    try {
      const query = forceDeleteRequired ? '?force=true' : '';
      await apiFetch(`/clients/${deletingClient.id}${query}`, { method: 'DELETE' });
      showToast(`Deleted client "${deletingClient.company}"`);
      if (selectedClient?.id === deletingClient.id) {
        setSelectedClient(null);
      }
      setDeletingClient(null);
      fetchClients();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setForceDeleteRequired(true);
        setDeleteProjectCount(Number(err.data.projectCount || 1));
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to delete client', 'error');
        setDeletingClient(null);
      }
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleAddClientNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newNoteText.trim()) return;
    setAddingNote(true);
    try {
      await apiFetch(`/clients/${selectedClient.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text: newNoteText.trim() }),
      });
      setNewNoteText('');
      const refreshed = await apiFetch<{ client: Client }>(`/clients/${selectedClient.id}`);
      setSelectedClient(refreshed.client);
      fetchClients();
      showToast('Added note to client activity');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add note', 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const handleCreateProjectForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setProjectSubmitting(true);
    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          ...projectForm,
          client_id: selectedClient.id,
          budget: Number(projectForm.budget || 0),
          manager_id: projectForm.manager_id || users[0]?.id || null,
        }),
      });
      showToast(`Created project "${projectForm.name}" for ${selectedClient.company}`);
      setProjectModalOpen(false);
      const refreshed = await apiFetch<{ client: Client }>(`/clients/${selectedClient.id}`);
      setSelectedClient(refreshed.client);
      fetchClients();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create project', 'error');
    } finally {
      setProjectSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredClients.map((c) => ({
      Company: c.company,
      Primary_Contact: c.contact_name,
      Email: c.email,
      Phone: c.phone,
      Industry: c.industry,
      Address: c.address,
      Website: c.website,
      Status: c.status,
      Projects_Count: c.projects?.length || 0,
      Became_Client_At: formatDate(c.became_client_at),
      Source_Lead: c.lead ? `${c.lead.name} (${c.lead.source})` : 'Direct Client',
    }));
    exportToCsv('nexcrm-clients.csv', rows);
    showToast(`Exported ${rows.length} clients to CSV`);
  };

  /* If a client is selected, render full Client Detail Page with Overview, Projects, and Notes/Activity */
  if (selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Clients
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedClient.company}
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getClientStatusBadge(
                    selectedClient.status
                  )}`}
                >
                  {selectedClient.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Primary Contact: {selectedClient.contact_name} &bull; Client since{' '}
                {formatDate(selectedClient.became_client_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEditModal(selectedClient)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Client
            </button>
            <button
              type="button"
              onClick={() => {
                setProjectForm({
                  ...projectForm,
                  name: `${selectedClient.company} — Phase 1`,
                  manager_id: users[0]?.id || '',
                });
                setProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <FolderPlus className="w-4 h-4" />
              Add Project
            </button>
          </div>
        </div>

        {/* Section 1: Overview (Contact & Company Info + Link to Original Lead) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Client Overview &amp; Company Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Industry:</span>
                  <span className="font-semibold text-xs">
                    {selectedClient.industry || 'Technology'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Email:</span>
                  <a
                    href={`mailto:${selectedClient.email}`}
                    className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {selectedClient.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Phone:</span>
                  <span className="font-semibold text-xs">{selectedClient.phone}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Address:</span>
                  <span className="font-medium text-xs">{selectedClient.address || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">Website:</span>
                  {selectedClient.website ? (
                    <a
                      href={selectedClient.website}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {selectedClient.website}
                    </a>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </div>
                {selectedClient.lead_id && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => onNavigate('leads', selectedClient.lead_id || undefined)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Linked to Original Lead ({selectedClient.lead?.name || 'View Lead'})
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Account Notes
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedClient.notes || 'No general account notes added.'}
              </p>
            </div>
          </div>

          {/* Section 3: Notes / Activity Log */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              3. Client Notes &amp; Activity ({selectedClient.client_notes?.length || 0})
            </h3>

            <form onSubmit={handleAddClientNote} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Add account note..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={addingNote || !newNoteText.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-60">
              {!selectedClient.client_notes || selectedClient.client_notes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No client activity notes yet.</p>
              ) : (
                selectedClient.client_notes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {n.author?.name || 'Team'}
                      </span>
                      <span>{formatDateTime(n.created_at)}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{n.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Projects List for this Client */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Client Projects ({selectedClient.projects?.length || 0})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All active, planned, and delivered projects for {selectedClient.company}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setProjectForm({
                  ...projectForm,
                  name: `${selectedClient.company} — New Project`,
                  manager_id: users[0]?.id || '',
                });
                setProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Project for {selectedClient.company}
            </button>
          </div>

          {!selectedClient.projects || selectedClient.projects.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No projects created for this client yet. Click &ldquo;Add Project&rdquo; above to
              start one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Project Name</th>
                    <th className="py-3 px-4">Service Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Start &amp; End Date</th>
                    <th className="py-3 px-4">Budget</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                  {selectedClient.projects.map((proj) => (
                    <tr
                      key={proj.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {proj.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {proj.service_type}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getProjectStatusBadge(
                            proj.status
                          )}`}
                        >
                          {proj.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {formatDate(proj.start_date)} &rarr; {formatDate(proj.end_date)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(proj.budget, proj.currency)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${proj.progress}%` }}
                            />
                          </div>
                          <span className="font-semibold">{proj.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => onNavigate('client_payments', proj.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Payment Phases &rarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('projects', proj.id)}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          View Project &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pre-selected Client Add Project Modal */}
        <Modal
          open={projectModalOpen}
          onClose={() => setProjectModalOpen(false)}
          title={`Add Project for ${selectedClient.company}`}
        >
          <form onSubmit={handleCreateProjectForClient} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Type *
                </label>
                <select
                  value={projectForm.service_type}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, service_type: e.target.value as ServiceType })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
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
                  Status
                </label>
                <select
                  value={projectForm.status}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={projectForm.start_date}
                  onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected End Date *
                </label>
                <input
                  type="date"
                  required
                  value={projectForm.end_date}
                  onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget ({projectForm.currency})
                </label>
                <input
                  type="number"
                  min={0}
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Manager
                </label>
                <select
                  value={projectForm.manager_id}
                  onChange={(e) => setProjectForm({ ...projectForm, manager_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tech Stack (comma-separated tags)
              </label>
              <input
                type="text"
                value={projectForm.tech_stack}
                onChange={(e) => setProjectForm({ ...projectForm, tech_stack: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={projectSubmitting}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white"
              >
                {projectSubmitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Edit Client Modal also available in detail view */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Edit Client — ${selectedClient.company}`}
        >
          <form onSubmit={handleSaveClient} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Primary Contact *</label>
                <input
                  type="text"
                  required
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Phone *</label>
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Industry</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Address / Country</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Clients Directory</h2>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredClients.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40"
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
            Add Client
          </button>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, primary contact, industry, location..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['ALL', ...CLIENT_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All Clients' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No clients found"
            description="Convert a lead or add a client directly to begin tracking projects."
            actionLabel="Add Client"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Company &amp; Industry</th>
                    <th className="py-3.5 px-4">Primary Contact</th>
                    <th className="py-3.5 px-4">Location / Origin</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Projects</th>
                    <th className="py-3.5 px-4">Client Since</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                  {paginatedClients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedClient(client)}
                          className="text-left group"
                        >
                          <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {client.company}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {client.industry || 'IT & Software'}
                          </div>
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {client.contact_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {client.email} &bull; {client.phone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        <div>{client.address || '—'}</div>
                        {client.lead_id ? (
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                            From Converted Lead
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Direct Account</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${getClientStatusBadge(
                            client.status
                          )}`}
                        >
                          {client.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {client.projects?.length || 0} project(s)
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {formatDate(client.became_client_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedClient(client)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => initiateDeleteClient(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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

            <Pagination
              currentPage={currentPage}
              totalItems={filteredClients.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingClient ? `Edit Client — ${editingClient.company}` : 'Add Client'}
      >
        <form onSubmit={handleSaveClient} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Acme Systems Inc."
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Contact Name *
              </label>
              <input
                type="text"
                required
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Jane Doe"
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
                placeholder="contact@company.com"
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
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Industry
              </label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="FinTech, Healthcare, Logistics..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Address / Country
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="San Francisco, CA, USA"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Website
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://company.com"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date Became Client
              </label>
              <input
                type="date"
                value={form.became_client_at}
                onChange={(e) => setForm({ ...form, became_client_at: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Billing preferences, SLA details, key stakeholders..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Client Confirmation (warns if client has projects!) */}
      <ConfirmDialog
        open={Boolean(deletingClient)}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleConfirmDeleteClient}
        loading={deletingLoading}
        title={
          forceDeleteRequired
            ? `Warning: Client Has ${deleteProjectCount} Active Project(s)`
            : 'Delete Client'
        }
        description={
          forceDeleteRequired
            ? `"${deletingClient?.company}" has ${deleteProjectCount} associated project(s) and their timeline entries. Deleting this client will permanently delete all ${deleteProjectCount} project(s). Are you sure you want to delete everything?`
            : `Are you sure you want to delete "${deletingClient?.company}"? This action cannot be undone.`
        }
        confirmLabel={
          forceDeleteRequired ? `Delete Client & ${deleteProjectCount} Project(s)` : 'Delete Client'
        }
      />
    </div>
  );
};

