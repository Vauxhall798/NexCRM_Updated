import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  GitCommitHorizontal,
  BarChartHorizontal,
  Flag,
  Sliders,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Project,
  TimelineEntry,
  TimelineStatus,
  TimelineType,
  User,
} from '../types/crm';
import {
  formatDate,
  getTimelineStatusBadge,
  getTimelineTypeBadge,
  TIMELINE_STATUSES,
  TIMELINE_TYPES,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface TimelinePageProps {
  users: User[];
  initialProjectId?: string | null;
  onClearInitialId?: () => void;
  embeddedProjectId?: string; // When rendered inside Project Detail Page -> Timeline tab
  onProjectUpdated?: () => void;
}

interface TimelineFormState {
  title: string;
  description: string;
  type: TimelineType;
  start_date: string;
  end_date: string;
  status: TimelineStatus;
  assignee_id: string;
}

const emptyTimelineForm: TimelineFormState = {
  title: '',
  description: '',
  type: 'Task',
  start_date: toInputDate(new Date().toISOString()),
  end_date: '',
  status: 'Planned',
  assignee_id: '',
};

export const TimelinePage: React.FC<TimelinePageProps> = ({
  users,
  initialProjectId,
  onClearInitialId,
  embeddedProjectId,
  onProjectUpdated,
}) => {
  const { showToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(embeddedProjectId || '');
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'vertical' | 'gantt'>('vertical');

  // Add / Edit Entry Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [form, setForm] = useState<TimelineFormState>(emptyTimelineForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Entry Confirmation
  const [deletingEntry, setDeletingEntry] = useState<TimelineEntry | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Manual Progress Override state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [manualProgress, setManualProgress] = useState(0);
  const [useManualOverride, setUseManualOverride] = useState(false);

  const loadProjects = async () => {
    try {
      const res = await apiFetch<{ projects: Project[] }>('/projects');
      setProjects(res.projects);
      if (embeddedProjectId) {
        setSelectedProjectId(embeddedProjectId);
      } else if (initialProjectId) {
        setSelectedProjectId(initialProjectId);
        onClearInitialId?.();
      } else if (!selectedProjectId && res.projects.length > 0) {
        setSelectedProjectId(res.projects[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load projects', 'error');
    }
  };

  const loadTimeline = async (projId: string) => {
    if (!projId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ entries: TimelineEntry[] }>(`/timeline?project_id=${projId}`);
      setEntries(res.entries);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load timeline', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [embeddedProjectId, initialProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadTimeline(selectedProjectId);
    }
  }, [selectedProjectId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const doneCount = useMemo(
    () => entries.filter((e) => e.status === 'Done').length,
    [entries]
  );
  const totalCount = entries.length;
  const computedProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const displayedProgress = activeProject?.progress_override
    ? activeProject.progress
    : computedProgress;

  const openAddModal = () => {
    setEditingEntry(null);
    setForm({
      ...emptyTimelineForm,
      assignee_id: activeProject?.manager_id || users[0]?.id || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (entry: TimelineEntry) => {
    setEditingEntry(entry);
    setForm({
      title: entry.title,
      description: entry.description || '',
      type: entry.type,
      start_date: toInputDate(entry.start_date),
      end_date: toInputDate(entry.end_date),
      status: entry.status,
      assignee_id: entry.assignee_id || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim() || !form.start_date) {
      setFormError('Title and Date are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        project_id: selectedProjectId,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        assignee_id: form.assignee_id || null,
      };

      if (editingEntry) {
        await apiFetch(`/timeline/${editingEntry.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated timeline entry "${form.title}"`);
      } else {
        await apiFetch('/timeline', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Added timeline entry "${form.title}"`);
      }

      setModalOpen(false);
      await loadTimeline(selectedProjectId);
      await loadProjects();
      onProjectUpdated?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save timeline entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (entry: TimelineEntry, newStatus: TimelineStatus) => {
    try {
      await apiFetch(`/timeline/${entry.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadTimeline(selectedProjectId);
      await loadProjects();
      onProjectUpdated?.();
      showToast(`Marked "${entry.title}" as ${newStatus}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleMoveEntry = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= entries.length) return;

    const reordered = [...entries];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setEntries(reordered);

    try {
      await apiFetch('/timeline/reorder', {
        method: 'PUT',
        body: JSON.stringify({
          project_id: selectedProjectId,
          ordered_ids: reordered.map((e) => e.id),
        }),
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder entries', 'error');
      loadTimeline(selectedProjectId);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/timeline/${deletingEntry.id}`, { method: 'DELETE' });
      showToast(`Deleted timeline entry "${deletingEntry.title}"`);
      setDeletingEntry(null);
      await loadTimeline(selectedProjectId);
      await loadProjects();
      onProjectUpdated?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete entry', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleSaveProgressOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await apiFetch(`/projects/${activeProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          progress: useManualOverride ? manualProgress : computedProgress,
          progress_override: useManualOverride,
        }),
      });
      setOverrideModalOpen(false);
      await loadProjects();
      onProjectUpdated?.();
      showToast(
        useManualOverride
          ? `Set manual progress override to ${manualProgress}%`
          : `Synced project progress to timeline (${computedProgress}%)`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update progress', 'error');
    }
  };

  // Gantt chart date range bounds
  const ganttBounds = useMemo(() => {
    if (entries.length === 0) {
      const now = Date.now();
      return { minMs: now - 7 * 86400000, maxMs: now + 30 * 86400000 };
    }
    const startTimes = entries.map((e) => new Date(e.start_date).getTime());
    const endTimes = entries.map((e) =>
      e.end_date ? new Date(e.end_date).getTime() : new Date(e.start_date).getTime() + 3 * 86400000
    );
    const minMs = Math.min(...startTimes) - 3 * 86400000;
    const maxMs = Math.max(...endTimes, minMs + 14 * 86400000) + 3 * 86400000;
    return { minMs, maxMs };
  }, [entries]);

  return (
    <div className="space-y-5">
      {/* Top Bar: Project Selector (unless embedded) + Progress Summary + View Toggle */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {!embeddedProjectId ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Select Project Timeline
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full sm:w-96 px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client?.company})
                    </option>
                  ))}
                </select>
              </div>
              {activeProject && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 sm:pt-4">
                  Client: <strong className="text-slate-800 dark:text-slate-200">{activeProject.client?.company}</strong> &bull; Schedule:{' '}
                  {formatDate(activeProject.start_date)} &rarr; {formatDate(activeProject.end_date)}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Project Delivery Timeline
              </h3>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('vertical')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'vertical'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <GitCommitHorizontal className="w-3.5 h-3.5" />
                Vertical Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('gantt')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'gantt'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <BarChartHorizontal className="w-3.5 h-3.5" />
                Gantt Schedule
              </button>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              disabled={!selectedProjectId}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Timeline Entry
            </button>
          </div>
        </div>

        {/* Done Count vs Total & Progress Indicator */}
        {activeProject && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-600 dark:text-slate-300">
                  Completed Entries:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {doneCount} of {totalCount} Done
                  </strong>{' '}
                  ({computedProgress}% auto-calculated)
                </span>
              </div>
              {activeProject.progress_override && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Manual Progress Override Active ({activeProject.progress}%)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-40 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${displayedProgress}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {displayedProgress}%
              </span>
              <button
                type="button"
                onClick={() => {
                  setManualProgress(activeProject.progress);
                  setUseManualOverride(activeProject.progress_override);
                  setOverrideModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Sliders className="w-3 h-3" />
                Adjust Progress
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Timeline Area */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading timeline entries...
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <EmptyState
            icon={Flag}
            title="No timeline entries for this project yet"
            description="Log milestones, tasks, client meetings, deliveries, or blockers to track project execution."
            actionLabel="Add Timeline Entry"
            onAction={openAddModal}
          />
        </div>
      ) : viewMode === 'vertical' ? (
        /* Vertical Timeline View with Reordering & Quick Status Toggles */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-200 dark:border-indigo-900/80 space-y-6">
            {entries.map((entry, idx) => {
              const isDone = entry.status === 'Done';
              const isDelayed = entry.status === 'Delayed';

              return (
                <div key={entry.id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div
                    className={`w-4 h-4 rounded-full border-2 absolute -left-[33px] sm:-left-[41px] top-4 transition-colors ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-200 dark:border-emerald-900'
                        : isDelayed
                        ? 'bg-rose-500 border-rose-200 dark:border-rose-900'
                        : entry.status === 'In progress'
                        ? 'bg-indigo-600 border-indigo-200 dark:border-indigo-900'
                        : 'bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900'
                    }`}
                  />

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-400">
                            #{idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getTimelineTypeBadge(
                              entry.type
                            )}`}
                          >
                            {entry.type}
                          </span>
                          <h4
                            className={`text-sm font-bold ${
                              isDone
                                ? 'text-slate-600 dark:text-slate-300'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {entry.title}
                          </h4>
                        </div>

                        {entry.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {entry.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(entry.start_date)}
                            {entry.end_date &&
                              entry.end_date !== entry.start_date &&
                              ` → ${formatDate(entry.end_date)}`}
                          </span>
                          <span>
                            Responsible:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {entry.assignee?.name || 'Unassigned'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Right Controls: Status Dropdown, Reorder Up/Down, Edit, Delete */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                        <select
                          value={entry.status}
                          onChange={(e) =>
                            handleQuickStatusChange(entry, e.target.value as TimelineStatus)
                          }
                          aria-label={`Status for ${entry.title}`}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${getTimelineStatusBadge(
                            entry.status
                          )}`}
                        >
                          {TIMELINE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => handleMoveEntry(idx, 'up')}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveEntry(idx, 'down')}
                            disabled={idx === entries.length - 1}
                            title="Move Down"
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditModal(entry)}
                          title="Edit Entry"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingEntry(entry)}
                          title="Delete Entry"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Gantt-style Schedule View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs overflow-x-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Gantt Schedule View
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visual span from {formatDate(new Date(ganttBounds.minMs).toISOString())} to{' '}
                {formatDate(new Date(ganttBounds.maxMs).toISOString())}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" /> Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-indigo-500 inline-block" /> In progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" /> Delayed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-slate-400 inline-block" /> Planned
              </span>
            </div>
          </div>

          <div className="min-w-[680px] space-y-3">
            {entries.map((entry) => {
              const totalSpan = Math.max(1, ganttBounds.maxMs - ganttBounds.minMs);
              const startMs = new Date(entry.start_date).getTime();
              const endMs = entry.end_date
                ? new Date(entry.end_date).getTime()
                : startMs + 2 * 86400000;
              const leftPct = Math.max(
                0,
                Math.min(92, ((startMs - ganttBounds.minMs) / totalSpan) * 100)
              );
              const widthPct = Math.max(
                6,
                Math.min(100 - leftPct, ((endMs - startMs) / totalSpan) * 100)
              );

              const barColor =
                entry.status === 'Done'
                  ? 'bg-emerald-500'
                  : entry.status === 'In progress'
                  ? 'bg-indigo-600'
                  : entry.status === 'Delayed'
                  ? 'bg-rose-500'
                  : 'bg-slate-400 dark:bg-slate-600';

              return (
                <div
                  key={entry.id}
                  onClick={() => openEditModal(entry)}
                  className="grid grid-cols-12 items-center gap-4 py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors"
                >
                  <div className="col-span-4 pr-2">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {entry.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {entry.type} &bull; {entry.assignee?.name || 'Unassigned'}
                    </div>
                  </div>

                  <div className="col-span-8 relative h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center">
                    <div
                      className={`h-5 rounded-md ${barColor} text-white text-[10px] font-semibold flex items-center px-2 truncate shadow-xs`}
                      style={{
                        marginLeft: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      title={`${entry.title}: ${formatDate(entry.start_date)} - ${formatDate(
                        entry.end_date || entry.start_date
                      )}`}
                    >
                      {formatDate(entry.start_date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Timeline Entry Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEntry ? `Edit Timeline Entry — ${editingEntry.title}` : 'Add Timeline Entry'}
        subtitle="Record a milestone, task, meeting, delivery, issue, or note."
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Architecture Sign-Off & Database Schema Freeze"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Entry Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TimelineType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {TIMELINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TimelineStatus })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {TIMELINE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsible Person
              </label>
              <select
                value={form.assignee_id}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Deliverables, acceptance criteria, or meeting outcomes..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
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
              {submitting ? 'Saving...' : editingEntry ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Progress Override Modal */}
      <Modal
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        title="Project Progress Settings"
        subtitle="Progress is automatically calculated from Done vs Total timeline entries unless manually overridden."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveProgressOverride} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Timeline Auto-Calculation: {doneCount} / {totalCount} Done ({computedProgress}%)
            </div>
            <div className="text-slate-500">
              When auto-sync is enabled, marking timeline entries as Done automatically updates
              project progress.
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={useManualOverride}
              onChange={(e) => setUseManualOverride(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            Manually override project progress %
          </label>

          {useManualOverride && (
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Manual Progress Percentage</span>
                <span>{manualProgress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={manualProgress}
                onChange={(e) => setManualProgress(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOverrideModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white"
            >
              Save Progress Setting
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDeleteEntry}
        loading={deletingLoading}
        title="Delete Timeline Entry"
        description={`Are you sure you want to delete "${deletingEntry?.title}" from the timeline?`}
        confirmLabel="Delete Entry"
      />
    </div>
  );
};

