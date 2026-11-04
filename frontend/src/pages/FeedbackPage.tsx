import React, { useEffect, useState, useMemo } from 'react';
import {
  MessageSquareHeart,
  Star,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  CheckCircle2,
  Sparkles,
  Building2,
  FolderKanban,
  Quote,
  LayoutGrid,
  Table as TableIcon,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Client,
  Feedback,
  FeedbackCategory,
  FeedbackSentiment,
  FeedbackStatus,
  FeedbackSummary,
  NavTab,
  Project,
} from '../types/crm';
import {
  exportToCsv,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SENTIMENTS,
  FEEDBACK_STATUSES,
  formatDate,
  getFeedbackSentimentBadge,
  getFeedbackStatusBadge,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface FeedbackPageProps {
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

interface FeedbackFormState {
  client_id: string;
  project_id: string;
  rating: number;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  comment: string;
  action_taken: string;
  status: FeedbackStatus;
  submitted_by: string;
  feedback_date: string;
  is_testimonial: boolean;
}

const emptyFeedbackForm: FeedbackFormState = {
  client_id: '',
  project_id: '',
  rating: 5,
  sentiment: 'Positive',
  category: 'Delivery Quality',
  comment: '',
  action_taken: '',
  status: 'Reviewed',
  submitted_by: '',
  feedback_date: toInputDate(new Date().toISOString()),
  is_testimonial: false,
};

export const FeedbackPage: React.FC<FeedbackPageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({
    totalCount: 0,
    averageRating: 0,
    positiveCount: 0,
    positivePct: 0,
    pendingActionsCount: 0,
    testimonialCount: 0,
    ratingDistribution: [
      { star: 5, count: 0 },
      { star: 4, count: 0 },
      { star: 3, count: 0 },
      { star: 2, count: 0 },
      { star: 1, count: 0 },
    ],
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filters
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  const [form, setForm] = useState<FeedbackFormState>(emptyFeedbackForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation
  const [deletingFeedback, setDeletingFeedback] = useState<Feedback | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [fbRes, clientRes, projRes] = await Promise.all([
        apiFetch<{ feedbacks: Feedback[]; summary: FeedbackSummary }>('/feedback'),
        apiFetch<{ clients: Client[] }>('/clients'),
        apiFetch<{ projects: Project[] }>('/projects'),
      ]);
      setFeedbacks(fbRes.feedbacks);
      setSummary(fbRes.summary);
      setClients(clientRes.clients);
      setProjects(projRes.projects);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load client feedback', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => {
      if (clientFilter !== 'ALL' && f.client_id !== clientFilter) return false;
      if (sentimentFilter !== 'ALL' && f.sentiment !== sentimentFilter) return false;
      if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchComment = f.comment.toLowerCase().includes(q);
        const matchClient = f.client?.company.toLowerCase().includes(q);
        const matchProject = f.project?.name.toLowerCase().includes(q);
        const matchAuthor = f.submitted_by.toLowerCase().includes(q);
        const matchAction = f.action_taken.toLowerCase().includes(q);
        if (!matchComment && !matchClient && !matchProject && !matchAuthor && !matchAction) {
          return false;
        }
      }
      return true;
    });
  }, [feedbacks, clientFilter, sentimentFilter, categoryFilter, statusFilter, search]);

  // Projects filtered by selected client inside modal
  const clientProjects = useMemo(() => {
    if (!form.client_id) return projects;
    return projects.filter((p) => p.client_id === form.client_id);
  }, [projects, form.client_id]);

  const openAddModal = () => {
    const firstClient = clients[0];
    const firstProj = firstClient
      ? projects.find((p) => p.client_id === firstClient.id)
      : undefined;

    setEditingFeedback(null);
    setForm({
      ...emptyFeedbackForm,
      client_id: firstClient?.id || '',
      project_id: firstProj?.id || '',
      submitted_by: firstClient ? `${firstClient.contact_name}` : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (fb: Feedback) => {
    setEditingFeedback(fb);
    setForm({
      client_id: fb.client_id,
      project_id: fb.project_id || '',
      rating: fb.rating,
      sentiment: fb.sentiment,
      category: fb.category,
      comment: fb.comment,
      action_taken: fb.action_taken || '',
      status: fb.status,
      submitted_by: fb.submitted_by || '',
      feedback_date: toInputDate(fb.feedback_date),
      is_testimonial: Boolean(fb.is_testimonial),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.client_id || !form.comment.trim()) {
      setFormError('Please select a client and enter the client feedback comment.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        project_id: form.project_id || null,
        comment: form.comment.trim(),
        action_taken: form.action_taken.trim(),
        submitted_by: form.submitted_by.trim(),
      };

      if (editingFeedback) {
        await apiFetch(`/feedback/${editingFeedback.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Updated client feedback entry');
      } else {
        await apiFetch('/feedback', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Logged new client feedback');
      }

      setModalOpen(false);
      fetchAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (fb: Feedback, newStatus: FeedbackStatus) => {
    try {
      await apiFetch(`/feedback/${fb.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Updated feedback status to "${newStatus}"`);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleDeleteFeedback = async () => {
    if (!deletingFeedback) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/feedback/${deletingFeedback.id}`, { method: 'DELETE' });
      showToast('Deleted client feedback record');
      setDeletingFeedback(null);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete feedback', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredFeedbacks.map((f) => ({
      Date: formatDate(f.feedback_date),
      Client: f.client?.company || '',
      Project: f.project?.name || 'General Account',
      Submitted_By: f.submitted_by,
      Rating_Stars: f.rating,
      Sentiment: f.sentiment,
      Category: f.category,
      Client_Feedback: f.comment,
      Action_Taken: f.action_taken,
      Status: f.status,
      Testimonial_Approved: f.is_testimonial ? 'Yes' : 'No',
    }));
    exportToCsv('nexcrm-client-feedback.csv', rows);
    showToast(`Exported ${rows.length} feedback records to CSV`);
  };

  const renderStars = (rating: number) => (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'text-slate-300 dark:text-slate-700'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F2547] dark:text-slate-100">
            Client Feedback &amp; CSAT Log
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-[#0F2547] dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-[#0F2547] dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredFeedbacks.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0F2547] hover:bg-[#173461] dark:bg-[#3596B0] dark:hover:bg-[#28788E] text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Feedback
          </button>
        </div>
      </div>

      {/* Top Summary Row: 4 KPI Cards + Rating Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg. CSAT Rating
            </span>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-[#0F2547] dark:text-white flex items-baseline gap-1.5">
                {summary.averageRating}
                <span className="text-sm font-medium text-slate-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(Math.round(summary.averageRating))}</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Positive Sentiment
            </span>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {summary.positivePct}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {summary.positiveCount} of {summary.totalCount} reviews
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Open Action Items
            </span>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">
                {summary.pendingActionsCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Needs follow-up / action
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-[#B0E0EC] dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3596B0]">
              Client Testimonials
            </span>
            <div className="mt-2">
              <div className="text-3xl font-extrabold text-[#0F2547] dark:text-[#49AFCB]">
                {summary.testimonialCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Approved for case studies
              </div>
            </div>
          </div>
        </div>

        {/* Rating Breakdown Card */}
        <div className="lg:col-span-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-center space-y-1.5">
          <div className="text-xs font-bold text-[#0F2547] dark:text-slate-200 mb-1">
            Rating Distribution ({summary.totalCount} total)
          </div>
          {summary.ratingDistribution.map((row) => {
            const pct =
              summary.totalCount > 0 ? Math.round((row.count / summary.totalCount) * 100) : 0;
            return (
              <div key={row.star} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
                  {row.star} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3596B0] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[11px] text-slate-500">{row.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client feedback, stakeholder, or action taken..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
          />
        </div>

        <div className="md:col-span-2">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
          >
            <option value="ALL">All Sentiments</option>
            {FEEDBACK_SENTIMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
          >
            <option value="ALL">All Categories</option>
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
          >
            <option value="ALL">All Statuses</option>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Cards or Table */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading client feedback...
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <EmptyState
            icon={MessageSquareHeart}
            title="No client feedback entries found"
            description="Record feedback from sprint demos, mid-project check-ins, or post-delivery reviews."
            actionLabel="Log Client Feedback"
            onAction={openAddModal}
          />
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredFeedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#3596B0] transition-all"
            >
              <div className="space-y-3">
                {/* Top Metadata Row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onNavigate('clients', fb.client_id)}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F2547] dark:text-white hover:text-[#3596B0]"
                      >
                        <Building2 className="w-4 h-4 text-[#3596B0]" />
                        {fb.client?.company}
                      </button>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getFeedbackSentimentBadge(
                          fb.sentiment
                        )}`}
                      >
                        {fb.sentiment}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {fb.category}
                      </span>
                      {fb.is_testimonial && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#EEF8FA] dark:bg-slate-800 text-[#3596B0] border border-[#B0E0EC] dark:border-slate-700">
                          <Sparkles className="w-3 h-3" />
                          Testimonial
                        </span>
                      )}
                    </div>

                    {fb.project && (
                      <button
                        type="button"
                        onClick={() => onNavigate('projects', fb.project?.id)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-[#3596B0]"
                      >
                        <FolderKanban className="w-3.5 h-3.5" />
                        Project: <span className="font-medium">{fb.project.name}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    {renderStars(fb.rating)}
                    <span className="text-[11px] text-slate-400 mt-1">
                      {formatDate(fb.feedback_date)}
                    </span>
                  </div>
                </div>

                {/* Client Quote Box */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 relative">
                  <Quote className="w-5 h-5 text-[#3596B0]/30 absolute top-3 right-3" />
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed pr-6">
                    &ldquo;{fb.comment}&rdquo;
                  </p>
                  <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    — {fb.submitted_by || fb.client?.contact_name || 'Client Stakeholder'}
                  </div>
                </div>

                {/* Our Team's Action Taken / Follow-up */}
                <div className="p-3.5 rounded-xl bg-[#EEF8FA]/60 dark:bg-slate-800/30 border border-[#B0E0EC]/70 dark:border-slate-800 text-xs">
                  <div className="font-bold text-[#0F2547] dark:text-[#49AFCB] flex items-center gap-1.5 mb-1">
                    {fb.status === 'Resolved' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-[#3596B0]" />
                    )}
                    Our Follow-up / Action Taken:
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    {fb.action_taken || 'No follow-up action logged yet.'}
                  </p>
                </div>
              </div>

              {/* Card Footer Controls */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Status:</span>
                  <select
                    value={fb.status}
                    onChange={(e) =>
                      handleQuickStatusChange(fb, e.target.value as FeedbackStatus)
                    }
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${getFeedbackStatusBadge(
                      fb.status
                    )}`}
                  >
                    {FEEDBACK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(fb)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingFeedback(fb)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Client &amp; Project</th>
                  <th className="py-3.5 px-4">Rating &amp; Sentiment</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Client Feedback</th>
                  <th className="py-3.5 px-4">Action Taken</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {filteredFeedbacks.map((fb) => (
                  <tr
                    key={fb.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {fb.client?.company}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fb.project?.name || 'General'} &bull; {formatDate(fb.feedback_date)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>{renderStars(fb.rating)}</div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getFeedbackSentimentBadge(
                          fb.sentiment
                        )}`}
                      >
                        {fb.sentiment}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {fb.category}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-slate-800 dark:text-slate-200 line-clamp-2">
                        &ldquo;{fb.comment}&rdquo;
                      </p>
                      <span className="text-[11px] text-slate-400">— {fb.submitted_by}</span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-600 dark:text-slate-300">
                      {fb.action_taken || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${getFeedbackStatusBadge(
                          fb.status
                        )}`}
                      >
                        {fb.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(fb)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F2547] hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingFeedback(fb)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
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

      {/* Add / Edit Client Feedback Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFeedback ? 'Edit Client Feedback' : 'Log Client Feedback'}
        subtitle="Record feedback received from a client stakeholder and document our team's follow-up action."
      >
        <form onSubmit={handleSaveFeedback} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client *
              </label>
              <select
                required
                value={form.client_id}
                onChange={(e) => {
                  const newClientId = e.target.value;
                  const c = clients.find((cl) => cl.id === newClientId);
                  const firstProj = projects.find((p) => p.client_id === newClientId);
                  setForm({
                    ...form,
                    client_id: newClientId,
                    project_id: firstProj?.id || '',
                    submitted_by: c ? c.contact_name : form.submitted_by,
                  });
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Related Project (Optional)
              </label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">General Account Feedback</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Star Rating (1 to 5) *
              </label>
              <div className="flex items-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      const autoSentiment: FeedbackSentiment =
                        star >= 4 ? 'Positive' : star === 3 ? 'Constructive' : 'Critical';
                      setForm({ ...form, rating: star, sentiment: autoSentiment });
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= form.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                  {form.rating} / 5
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sentiment
              </label>
              <select
                value={form.sentiment}
                onChange={(e) =>
                  setForm({ ...form, sentiment: e.target.value as FeedbackSentiment })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {FEEDBACK_SENTIMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as FeedbackCategory })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Follow-up Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FeedbackStatus })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Submitted By (Client Contact &amp; Role)
              </label>
              <input
                type="text"
                value={form.submitted_by}
                onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
                placeholder="e.g. Elena Rostova, CTO"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Feedback Date
              </label>
              <input
                type="date"
                value={form.feedback_date}
                onChange={(e) => setForm({ ...form, feedback_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              What the Client Said (Feedback Comment) *
            </label>
            <textarea
              rows={3}
              required
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Enter the exact feedback or review shared by the client..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Our Action Taken / Response Plan
            </label>
            <textarea
              rows={2}
              value={form.action_taken}
              onChange={(e) => setForm({ ...form, action_taken: e.target.value })}
              placeholder="What improvements, fixes, or follow-ups did our team take in response?"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_testimonial}
              onChange={(e) => setForm({ ...form, is_testimonial: e.target.checked })}
              className="w-4 h-4 rounded text-[#0F2547]"
            />
            Client approved using this feedback as a public testimonial / case study quote
          </label>

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
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#0F2547] hover:bg-[#173461] dark:bg-[#3596B0] text-white disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingFeedback
                ? 'Save Changes'
                : 'Log Client Feedback'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingFeedback)}
        onClose={() => setDeletingFeedback(null)}
        onConfirm={handleDeleteFeedback}
        loading={deletingLoading}
        title="Delete Client Feedback"
        description={`Are you sure you want to delete this feedback entry from "${deletingFeedback?.client?.company}"?`}
        confirmLabel="Delete Feedback"
      />
    </div>
  );
};

