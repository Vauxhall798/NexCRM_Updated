import React, { useEffect, useState } from 'react';
import {
  UsersRound,
  Plus,
  UserPlus,
  Briefcase,
  Search,
  Download,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Gauge,
  Edit3,
  Trash2,
  ExternalLink,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  AssignmentStatus,
  NavTab,
  Project,
  Resource,
  ResourceAssignment,
  ResourceDepartment,
  ResourceSeniority,
  ResourceSummary,
} from '../types/crm';
import {
  ASSIGNMENT_STATUSES,
  RESOURCE_AVAILABILITY_STATUSES,
  RESOURCE_DEPARTMENTS,
  RESOURCE_SENIORITIES,
  exportToCsv,
  formatCurrency,
  formatDate,
  getResourceAvailabilityBadge,
  toInputDate,
} from '../lib/utils';
import { Drawer, Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

interface ResourcesPageProps {
  onNavigate: (tab: NavTab, id?: string) => void;
}

interface ResourceFormState {
  name: string;
  email: string;
  role_title: string;
  department: ResourceDepartment;
  seniority: ResourceSeniority;
  skills: string;
  total_capacity: number;
  hourly_rate: number;
  on_leave: boolean;
  notes: string;
}

interface AssignmentFormState {
  resource_id: string;
  project_id: string;
  assignment_role: string;
  allocation_pct: number;
  start_date: string;
  end_date: string;
  status: AssignmentStatus;
  notes: string;
}

const emptyResourceForm: ResourceFormState = {
  name: '',
  email: '',
  role_title: '',
  department: 'Engineering',
  seniority: 'Senior',
  skills: '',
  total_capacity: 100,
  hourly_rate: 2500,
  on_leave: false,
  notes: '',
};

const defaultStart = () => new Date().toISOString().split('T')[0];
const defaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return d.toISOString().split('T')[0];
};

export const ResourcesPage: React.FC<ResourcesPageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();

  const [resources, setResources] = useState<Resource[]>([]);
  const [summary, setSummary] = useState<ResourceSummary>({
    totalResources: 0,
    availableCount: 0,
    partiallyAvailableCount: 0,
    fullyBookedCount: 0,
    onLeaveCount: 0,
    avgUtilizationPct: 0,
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  // Resource Add/Edit Modal
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>(emptyResourceForm);
  const [savingResource, setSavingResource] = useState(false);

  // Assignment Add/Edit Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ResourceAssignment | null>(null);
  const [assignForm, setAssignForm] = useState<AssignmentFormState>({
    resource_id: '',
    project_id: '',
    assignment_role: '',
    allocation_pct: 50,
    start_date: defaultStart(),
    end_date: defaultEnd(),
    status: 'Active',
    notes: '',
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Detail Drawer & Deletions
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [deleteResourceTarget, setDeleteResourceTarget] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (departmentFilter) params.set('department', departmentFilter);
      if (availabilityFilter) params.set('availability', availabilityFilter);
      if (projectFilter) params.set('project_id', projectFilter);

      const [resData, projData] = await Promise.all([
        apiFetch<{ resources: Resource[]; summary: ResourceSummary }>(
          `/resources?${params.toString()}`
        ),
        apiFetch<{ projects: Project[] }>('/projects'),
      ]);

      setResources(resData.resources);
      setSummary(resData.summary);
      setProjects(projData.projects);

      if (selectedResource) {
        const refreshed = resData.resources.find((r) => r.id === selectedResource.id);
        if (refreshed) setSelectedResource(refreshed);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load resources', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, departmentFilter, availabilityFilter, projectFilter]);

  const openCreateResourceModal = () => {
    setEditingResource(null);
    setResourceForm(emptyResourceForm);
    setResourceModalOpen(true);
  };

  const openEditResourceModal = (res: Resource) => {
    setEditingResource(res);
    setResourceForm({
      name: res.name,
      email: res.email,
      role_title: res.role_title,
      department: res.department,
      seniority: res.seniority,
      skills: res.skills,
      total_capacity: res.total_capacity,
      hourly_rate: res.hourly_rate,
      on_leave: res.on_leave,
      notes: res.notes || '',
    });
    setResourceModalOpen(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.name.trim() || !resourceForm.email.trim() || !resourceForm.role_title.trim()) {
      showToast('Please fill in name, email, and role title', 'error');
      return;
    }

    try {
      setSavingResource(true);
      if (editingResource) {
        await apiFetch(`/resources/${editingResource.id}`, {
          method: 'PUT',
          body: JSON.stringify(resourceForm),
        });
        showToast(`${resourceForm.name} updated`, 'success');
      } else {
        await apiFetch('/resources', {
          method: 'POST',
          body: JSON.stringify(resourceForm),
        });
        showToast(`${resourceForm.name} added to company resources`, 'success');
      }
      setResourceModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save resource', 'error');
    } finally {
      setSavingResource(false);
    }
  };

  const openAssignModal = (presetResource?: Resource, existingAssign?: ResourceAssignment) => {
    if (existingAssign) {
      setEditingAssignment(existingAssign);
      setAssignForm({
        resource_id: existingAssign.resource_id,
        project_id: existingAssign.project_id,
        assignment_role: existingAssign.assignment_role,
        allocation_pct: existingAssign.allocation_pct,
        start_date: toInputDate(existingAssign.start_date) || defaultStart(),
        end_date: toInputDate(existingAssign.end_date) || defaultEnd(),
        status: existingAssign.status,
        notes: existingAssign.notes || '',
      });
    } else {
      setEditingAssignment(null);
      const targetRes = presetResource || resources.find((r) => r.available_pct > 0) || resources[0];
      const activeProjects = projects.filter(
        (p) => p.status === 'In progress' || p.status === 'Planned'
      );
      const defaultProj = activeProjects[0] || projects[0];
      const suggestedPct =
        targetRes && targetRes.available_pct > 0 ? Math.min(50, targetRes.available_pct) : 50;

      setAssignForm({
        resource_id: targetRes?.id || '',
        project_id: defaultProj?.id || '',
        assignment_role: targetRes?.role_title || 'Software Engineer',
        allocation_pct: suggestedPct,
        start_date: toInputDate(defaultProj?.start_date) || defaultStart(),
        end_date: toInputDate(defaultProj?.end_date) || defaultEnd(),
        status: 'Active',
        notes: '',
      });
    }
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.resource_id || !assignForm.project_id) {
      showToast('Please select both a resource and a project', 'error');
      return;
    }

    try {
      setSavingAssignment(true);
      if (editingAssignment) {
        await apiFetch(`/resources/assignments/${editingAssignment.id}`, {
          method: 'PUT',
          body: JSON.stringify(assignForm),
        });
        showToast('Project assignment updated', 'success');
      } else {
        await apiFetch('/resources/assignments', {
          method: 'POST',
          body: JSON.stringify(assignForm),
        });
        showToast('Resource assigned to project', 'success');
      }
      setAssignModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save assignment', 'error');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await apiFetch(`/resources/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      showToast('Project assignment removed', 'info');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove assignment', 'error');
    }
  };

  const handleDeleteResource = async () => {
    if (!deleteResourceTarget) return;
    try {
      setDeletingResource(true);
      await apiFetch(`/resources/${deleteResourceTarget.id}`, { method: 'DELETE' });
      showToast(`${deleteResourceTarget.name} removed`, 'success');
      if (selectedResource?.id === deleteResourceTarget.id) setSelectedResource(null);
      setDeleteResourceTarget(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete resource', 'error');
    } finally {
      setDeletingResource(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      'nexcrm-resources-availability.csv',
      resources.map((r) => ({
        Name: r.name,
        Email: r.email,
        Role: r.role_title,
        Department: r.department,
        Seniority: r.seniority,
        AvailabilityStatus: r.availability_status,
        AllocatedPct: `${r.allocated_pct}%`,
        AvailablePct: `${r.available_pct}%`,
        HourlyRate: r.hourly_rate,
        Skills: r.skills,
        ActiveProjects: (r.assignments || [])
          .filter((a) => a.status === 'Active')
          .map((a) => `${a.project?.name || ''} (${a.allocation_pct}%)`)
          .join('; '),
      }))
    );
    showToast('Exported resources & availability to CSV', 'info');
  };

  const selectedAssignResource = resources.find((r) => r.id === assignForm.resource_id);

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F2547] dark:bg-[#3596B0] text-white flex items-center justify-center shrink-0 shadow-sm">
            <UsersRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[#0F2547] dark:text-slate-100">
                Company Resources, Capacity & Project Allocation
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#EEF8FA] dark:bg-slate-800 text-[#3596B0] border border-[#B0E0EC] dark:border-slate-700">
                Live Utilization
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!resources.length}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => openAssignModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#3596B0] bg-[#EEF8FA] dark:bg-cyan-950/50 text-[#0F2547] dark:text-[#7BC8DC] text-xs font-semibold hover:bg-[#d8f1f6] transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5 text-[#3596B0]" />
            Assign to Project
          </button>
          <button
            type="button"
            onClick={openCreateResourceModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F2547] hover:bg-[#193B6E] dark:bg-[#3596B0] dark:hover:bg-[#2A7B91] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Resource
          </button>
        </div>
      </div>

      {/* Availability & Capacity KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setAvailabilityFilter('')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            availabilityFilter === ''
              ? 'bg-[#0F2547] text-white border-[#0F2547] shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#3596B0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                availabilityFilter === '' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Total Team
            </span>
            <UsersRound
              className={`w-4 h-4 ${
                availabilityFilter === '' ? 'text-[#49AFCB]' : 'text-[#3596B0]'
              }`}
            />
          </div>
          <div className="text-2xl font-extrabold mt-2">{summary.totalResources}</div>
          <div
            className={`text-[11px] mt-1 ${
              availabilityFilter === '' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {summary.onLeaveCount} currently on leave
          </div>
        </div>

        <div
          onClick={() =>
            setAvailabilityFilter(availabilityFilter === 'Available' ? '' : 'Available')
          }
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            availabilityFilter === 'Available'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              100% Available
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.availableCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Ready for new projects
          </div>
        </div>

        <div
          onClick={() =>
            setAvailabilityFilter(
              availabilityFilter === 'Partially Available' ? '' : 'Partially Available'
            )
          }
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            availabilityFilter === 'Partially Available'
              ? 'ring-2 ring-[#3596B0] bg-[#EEF8FA]/60 dark:bg-cyan-950/40 border-[#3596B0]'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#3596B0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F2547] dark:text-[#7BC8DC]">
              Partially Available
            </span>
            <Clock className="w-4 h-4 text-[#3596B0]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.partiallyAvailableCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Has open bandwidth %
          </div>
        </div>

        <div
          onClick={() =>
            setAvailabilityFilter(availabilityFilter === 'Fully Booked' ? '' : 'Fully Booked')
          }
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            availabilityFilter === 'Fully Booked'
              ? 'ring-2 ring-amber-500 bg-amber-50/60 dark:bg-amber-950/40 border-amber-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Fully Booked
            </span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.fullyBookedCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            100% allocated
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg Utilization
            </span>
            <Gauge className="w-4 h-4 text-[#3596B0]" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F2547] dark:text-white mt-2">
            {summary.avgUtilizationPct}%
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-[#3596B0] rounded-full transition-all"
              style={{ width: `${summary.avgUtilizationPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Bar & View Switcher */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, or skill (e.g. React, AWS, Python)..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3596B0]"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All Departments</option>
            {RESOURCE_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All Availability</option>
            {RESOURCE_AVAILABILITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="">All Assigned Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-end lg:self-center">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-900 text-[#0F2547] dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Capacity Cards
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
            Allocation Matrix
          </button>
        </div>
      </div>

      {/* Resource List */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
          Loading company resources & project allocations...
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF8FA] dark:bg-slate-800 text-[#3596B0] flex items-center justify-center mx-auto">
            <UsersRound className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-[#0F2547] dark:text-slate-100">
            No resources match your filters
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Add company engineers, designers, or consultants to track their availability and assign them to client projects.
          </p>
          <button
            type="button"
            onClick={openCreateResourceModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F2547] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add First Resource
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resources.map((res) => {
            const activeAssigns = (res.assignments || []).filter(
              (a) => a.status === 'Active' || a.status === 'Planned'
            );
            const skillsList = res.skills
              ? res.skills
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];

            return (
              <div
                key={res.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between hover:border-[#3596B0] transition-all shadow-2xs"
              >
                <div className="space-y-4">
                  {/* Top Identity & Availability Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => setSelectedResource(res)}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#0F2547] dark:bg-[#3596B0] text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {res.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0F2547] dark:text-slate-100 group-hover:text-[#3596B0] transition-colors">
                          {res.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {res.role_title}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${getResourceAvailabilityBadge(
                        res.availability_status
                      )}`}
                    >
                      {res.availability_status}
                    </span>
                  </div>

                  {/* Department, Seniority & Rate */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
                    <span>
                      <strong className="text-slate-700 dark:text-slate-200">
                        {res.department}
                      </strong>{' '}
                      • {res.seniority}
                    </span>
                    <span className="font-semibold text-[#0F2547] dark:text-[#7BC8DC]">
                      {formatCurrency(res.hourly_rate)}/hr
                    </span>
                  </div>

                  {/* Visual Capacity & Availability Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        Allocated: <strong className="text-[#0F2547] dark:text-white">{res.allocated_pct}%</strong>
                      </span>
                      <span
                        className={`font-bold ${
                          res.available_pct >= 50
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : res.available_pct > 0
                            ? 'text-[#3596B0]'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {res.on_leave ? 'On Leave (0% Free)' : `${res.available_pct}% Available`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all ${
                          res.allocated_pct >= 100
                            ? 'bg-amber-500'
                            : res.allocated_pct > 0
                            ? 'bg-[#0F2547] dark:bg-[#3596B0]'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, res.allocated_pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Skills */}
                  {skillsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skillsList.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                      {skillsList.length > 5 && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px]">
                          +{skillsList.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Assigned Projects List */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Assigned Projects ({activeAssigns.length})</span>
                    </div>

                    {activeAssigns.length === 0 ? (
                      <div className="py-3 px-3 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>Unassigned — 100% available for new project allocation</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {activeAssigns.map((assign) => (
                          <div
                            key={assign.id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  assign.project && onNavigate('projects', assign.project.id)
                                }
                                className="font-bold text-[#0F2547] dark:text-[#7BC8DC] hover:underline truncate block text-left"
                              >
                                {assign.project?.name}
                              </button>
                              <div className="text-[10px] text-slate-500 truncate">
                                {assign.assignment_role} •{' '}
                                {assign.status === 'Planned' ? 'Planned' : 'Active'}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 rounded-md bg-[#EEF8FA] dark:bg-slate-700 text-[#0F2547] dark:text-white font-bold text-[11px]">
                                {assign.allocation_pct}%
                              </span>
                              <button
                                type="button"
                                onClick={() => openAssignModal(res, assign)}
                                className="p-1 text-slate-400 hover:text-[#0F2547] dark:hover:text-white"
                                title="Edit allocation"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openAssignModal(res)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0F2547] hover:bg-[#193B6E] dark:bg-[#3596B0] text-white text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign to Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResource(res)}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditResourceModal(res)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#0F2547] dark:hover:text-white"
                    title="Edit resource"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View (Allocation Matrix) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Resource</th>
                  <th className="py-3.5 px-4">Department & Seniority</th>
                  <th className="py-3.5 px-4">Availability</th>
                  <th className="py-3.5 px-4">Utilization</th>
                  <th className="py-3.5 px-4">Current Project Assignments</th>
                  <th className="py-3.5 px-4">Rate</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {resources.map((res) => {
                  const activeAssigns = (res.assignments || []).filter(
                    (a) => a.status === 'Active' || a.status === 'Planned'
                  );
                  return (
                    <tr
                      key={res.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedResource(res)}
                          className="font-bold text-[#0F2547] dark:text-slate-100 hover:text-[#3596B0] text-left"
                        >
                          {res.name}
                        </button>
                        <div className="text-[11px] text-slate-500">{res.role_title}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {res.department}
                        </div>
                        <div className="text-[11px] text-slate-400">{res.seniority}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getResourceAvailabilityBadge(
                            res.availability_status
                          )}`}
                        >
                          {res.availability_status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold">{res.allocated_pct}% Busy</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {res.available_pct}% Free
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3596B0]"
                            style={{ width: `${Math.min(100, res.allocated_pct)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {activeAssigns.length === 0 ? (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            Unassigned (Bench)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {activeAssigns.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => openAssignModal(res, a)}
                                className="px-2 py-1 rounded-lg bg-[#EEF8FA] dark:bg-slate-800 text-[#0F2547] dark:text-[#7BC8DC] border border-[#B0E0EC] dark:border-slate-700 text-[11px] font-semibold hover:underline"
                              >
                                {a.project?.name} ({a.allocation_pct}%)
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(res.hourly_rate)}/hr
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openAssignModal(res)}
                            className="px-2.5 py-1 rounded-lg bg-[#0F2547] text-white text-[11px] font-semibold hover:bg-[#193B6E]"
                          >
                            + Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditResourceModal(res)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit resource"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteResourceTarget(res)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Delete resource"
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
        </div>
      )}

      {/* Resource Detail & Assignments Drawer */}
      <Drawer
        open={Boolean(selectedResource)}
        onClose={() => setSelectedResource(null)}
        title={selectedResource ? selectedResource.name : 'Resource Profile'}
        subtitle={
          selectedResource
            ? `${selectedResource.role_title} • ${selectedResource.department}`
            : ''
        }
      >
        {selectedResource && (
          <div className="space-y-6 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
              <span
                className={`px-3 py-1 rounded-full font-bold border ${getResourceAvailabilityBadge(
                  selectedResource.availability_status
                )}`}
              >
                {selectedResource.availability_status} — {selectedResource.available_pct}% Available
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAssignModal(selectedResource)}
                  className="px-3 py-1.5 rounded-xl bg-[#0F2547] text-white font-semibold"
                >
                  + Assign to Project
                </button>
                <button
                  type="button"
                  onClick={() => openEditResourceModal(selectedResource)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Capacity Breakdown */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Total Capacity
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {selectedResource.total_capacity}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Active Allocation
                </div>
                <div className="text-base font-extrabold text-[#0F2547] dark:text-[#7BC8DC] mt-0.5">
                  {selectedResource.allocated_pct}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Available Now
                </div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {selectedResource.available_pct}%
                </div>
              </div>
            </div>

            {/* Skills & Notes */}
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                  Technical Skills & Specializations
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResource.skills
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-lg bg-[#EEF8FA] dark:bg-slate-800 text-[#0F2547] dark:text-[#7BC8DC] font-semibold text-[11px]"
                      >
                        {skill}
                      </span>
                    ))}
                </div>
              </div>

              {selectedResource.notes && (
                <div>
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Notes
                  </div>
                  <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    {selectedResource.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Project Assignments List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Project Assignments ({(selectedResource.assignments || []).length})
                </h4>
              </div>

              {(selectedResource.assignments || []).length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                  No project assignments yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(selectedResource.assignments || []).map((assign) => (
                    <div
                      key={assign.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedResource(null);
                              if (assign.project) onNavigate('projects', assign.project.id);
                            }}
                            className="font-bold text-sm text-[#0F2547] dark:text-[#7BC8DC] hover:underline inline-flex items-center gap-1"
                          >
                            {assign.project?.name}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <div className="text-[11px] text-slate-500">
                            Role: <strong>{assign.assignment_role}</strong> • Client:{' '}
                            {assign.project?.client?.company || '—'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#EEF8FA] dark:bg-slate-800 text-[#0F2547] dark:text-[#7BC8DC] font-bold">
                            {assign.allocation_pct}%
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                            {assign.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(assign.start_date)} → {formatDate(assign.end_date)}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAssignModal(selectedResource, assign)}
                            className="text-[#3596B0] hover:underline font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(assign.id)}
                            className="text-rose-500 hover:underline font-semibold"
                          >
                            Unassign
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Add / Edit Company Resource Modal */}
      <Modal
        open={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        title={editingResource ? `Edit ${editingResource.name}` : 'Add Company Resource'}
      >
        <form onSubmit={handleSaveResource} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={resourceForm.name}
                onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
                placeholder="e.g. Vikram Mehta"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={resourceForm.email}
                onChange={(e) => setResourceForm({ ...resourceForm, email: e.target.value })}
                placeholder="vikram@nexcrm.io"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role Title *
              </label>
              <input
                type="text"
                required
                value={resourceForm.role_title}
                onChange={(e) =>
                  setResourceForm({ ...resourceForm, role_title: e.target.value })
                }
                placeholder="e.g. Senior Backend Engineer"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department *
              </label>
              <select
                value={resourceForm.department}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    department: e.target.value as ResourceDepartment,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {RESOURCE_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Seniority *
              </label>
              <select
                value={resourceForm.seniority}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    seniority: e.target.value as ResourceSeniority,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {RESOURCE_SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              value={resourceForm.skills}
              onChange={(e) => setResourceForm({ ...resourceForm, skills: e.target.value })}
              placeholder="React, TypeScript, Node.js, AWS, PostgreSQL"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-center">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Weekly Capacity (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={resourceForm.total_capacity}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    total_capacity: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Billing Rate (INR/hr)
              </label>
              <input
                type="number"
                min={0}
                value={resourceForm.hourly_rate}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    hourly_rate: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="pt-5">
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={resourceForm.on_leave}
                  onChange={(e) =>
                    setResourceForm({ ...resourceForm, on_leave: e.target.checked })
                  }
                  className="rounded border-slate-300 text-[#0F2547] focus:ring-[#3596B0]"
                />
                Currently on leave
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes & Certifications
            </label>
            <textarea
              rows={2}
              value={resourceForm.notes}
              onChange={(e) => setResourceForm({ ...resourceForm, notes: e.target.value })}
              placeholder="Certifications, domain background, or availability notes..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setResourceModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingResource}
              className="px-4 py-2 rounded-xl bg-[#0F2547] hover:bg-[#193B6E] dark:bg-[#3596B0] text-white font-semibold disabled:opacity-50"
            >
              {savingResource
                ? 'Saving...'
                : editingResource
                ? 'Update Resource'
                : 'Add Resource'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Resource to Project Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={
          editingAssignment
            ? 'Update Project Allocation'
            : 'Assign Resource to Project'
        }
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Resource *
              </label>
              <select
                required
                value={assignForm.resource_id}
                onChange={(e) => {
                  const r = resources.find((item) => item.id === e.target.value);
                  setAssignForm({
                    ...assignForm,
                    resource_id: e.target.value,
                    assignment_role: r?.role_title || assignForm.assignment_role,
                  });
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select resource...</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.available_pct}% Available — {r.role_title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Project *
              </label>
              <select
                required
                value={assignForm.project_id}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, project_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedAssignResource && (
            <div className="p-3 rounded-xl bg-[#EEF8FA] dark:bg-slate-800 border border-[#B0E0EC] dark:border-slate-700 flex items-center justify-between text-[11px]">
              <span>
                <strong>{selectedAssignResource.name}</strong> currently has{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {selectedAssignResource.available_pct}% free capacity
                </strong>{' '}
                ({selectedAssignResource.allocated_pct}% allocated).
              </span>
              <span className="font-bold text-[#0F2547] dark:text-[#7BC8DC]">
                {selectedAssignResource.department}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role on Project *
              </label>
              <input
                type="text"
                required
                value={assignForm.assignment_role}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, assignment_role: e.target.value })
                }
                placeholder="e.g. Lead Backend Architect"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assignment Status *
              </label>
              <select
                value={assignForm.status}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    status: e.target.value as AssignmentStatus,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {ASSIGNMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Capacity Allocation (%) *
              </label>
              <span className="font-extrabold text-[#0F2547] dark:text-[#7BC8DC]">
                {assignForm.allocation_pct}% of weekly bandwidth
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={assignForm.allocation_pct}
              onChange={(e) =>
                setAssignForm({
                  ...assignForm,
                  allocation_pct: Number(e.target.value),
                })
              }
              className="w-full accent-[#0F2547] dark:accent-[#3596B0]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>10% (Advisory)</span>
              <span>25% (Quarter)</span>
              <span>50% (Half-Time)</span>
              <span>75%</span>
              <span>100% (Full-Time Dedicated)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={assignForm.start_date}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, start_date: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date *
              </label>
              <input
                type="date"
                required
                value={assignForm.end_date}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, end_date: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Allocation Notes / Deliverables
            </label>
            <textarea
              rows={2}
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              placeholder="Key responsibilities on this project..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingAssignment}
              className="px-4 py-2 rounded-xl bg-[#0F2547] hover:bg-[#193B6E] dark:bg-[#3596B0] text-white font-semibold disabled:opacity-50"
            >
              {savingAssignment
                ? 'Saving...'
                : editingAssignment
                ? 'Update Allocation'
                : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Resource Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteResourceTarget)}
        title="Remove Company Resource"
        description={
          deleteResourceTarget
            ? `Are you sure you want to remove ${deleteResourceTarget.name} and their project allocations?`
            : ''
        }
        confirmLabel="Remove Resource"
        loading={deletingResource}
        onConfirm={handleDeleteResource}
        onClose={() => setDeleteResourceTarget(null)}
      />
    </div>
  );
};

