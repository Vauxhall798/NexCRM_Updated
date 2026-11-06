import React, { useEffect, useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  Eye,
  ArrowLeft,
  Calendar,
  Tag,
  User as UserIcon,
  Building2,
  DollarSign,
  TrendingUp,
  Server,
  Users,
  Receipt,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Clock,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  AmcBillingCycle,
  AmcSlaTier,
  AmcStatus,
  Client,
  NavTab,
  Project,
  ProjectCost,
  ProjectCostCategory,
  ProjectStatus,
  Resource,
  ServiceType,
  User,
} from '../types/crm';
import {
  CURRENCIES,
  exportToCsv,
  formatCurrency,
  formatDate,
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
import { TimelinePage } from './TimelinePage';

interface ProjectsPageProps {
  users: User[];
  initialProjectId?: string | null;
  onClearInitialId?: () => void;
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

interface ProjectFormState {
  client_id: string;
  name: string;
  description: string;
  service_type: ServiceType;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  budget: string;
  currency: string;
  manager_id: string;
  tech_stack: string;
  progress: string;
  progress_override: boolean;
  notes: string;
  amc_active: boolean;
  amc_status: AmcStatus;
  amc_amount: string;
  amc_start_date: string;
  amc_end_date: string;
  amc_billing_cycle: AmcBillingCycle;
  amc_sla_tier: AmcSlaTier;
  amc_scope: string;
  amc_contact: string;
}

interface ProjectCostFormState {
  title: string;
  category: ProjectCostCategory;
  vendor_or_resource: string;
  amount: string;
  incurred_date: string;
  notes: string;
}

const PROJECT_COST_CATEGORIES: ProjectCostCategory[] = [
  'Cloud / Infrastructure',
  'Resource Allocation',
  'Third-Party Vendor / API',
  'Software License / SaaS',
  'Contractor / Freelancer',
  'Other',
];

const QUICK_COST_PRESETS: Array<{
  label: string;
  title: string;
  category: ProjectCostCategory;
  vendor_or_resource: string;
  notes: string;
}> = [
  {
    label: 'Purchased AWS',
    title: 'Purchased AWS Cloud Infrastructure (EC2 / RDS / S3)',
    category: 'Cloud / Infrastructure',
    vendor_or_resource: 'Amazon Web Services (AWS)',
    notes: 'Production & staging cloud compute, database, and storage cost.',
  },
  {
    label: 'Resource Allocation Cost',
    title: 'Engineering & Delivery Resource Allocation',
    category: 'Resource Allocation',
    vendor_or_resource: 'Internal Engineering Squad',
    notes: 'Allocated developer / architect / designer sprint cost.',
  },
  {
    label: 'AI / API Vendor',
    title: 'LLM & Third-Party API Usage Credits',
    category: 'Third-Party Vendor / API',
    vendor_or_resource: 'Google Gemini / OpenAI / Stripe',
    notes: 'External API and AI model token consumption.',
  },
  {
    label: 'Software / SaaS License',
    title: 'DevOps Monitoring & SaaS Licenses',
    category: 'Software License / SaaS',
    vendor_or_resource: 'GitHub / Datadog / Figma',
    notes: 'Project-specific tooling and monitoring licenses.',
  },
];

const emptyProjectForm: ProjectFormState = {
  client_id: '',
  name: '',
  description: '',
  service_type: 'AI services',
  status: 'Planned',
  start_date: toInputDate(new Date().toISOString()),
  end_date: toInputDate(new Date(Date.now() + 30 * 86400000).toISOString()),
  budget: '500000',
  currency: 'INR',
  manager_id: '',
  tech_stack: 'TypeScript, React, Node.js, PostgreSQL',
  progress: '0',
  progress_override: false,
  notes: '',
  amc_active: false,
  amc_status: 'Not Contracted',
  amc_amount: '',
  amc_start_date: '',
  amc_end_date: '',
  amc_billing_cycle: 'Annual',
  amc_sla_tier: 'Standard 9x5',
  amc_scope: '',
  amc_contact: '',
};

const emptyCostForm: ProjectCostFormState = {
  title: '',
  category: 'Cloud / Infrastructure',
  vendor_or_resource: '',
  amount: '',
  incurred_date: toInputDate(new Date().toISOString()),
  notes: '',
};

function getProjectFinancials(proj: Project) {
  const costs = proj.project_costs || [];
  const budget = Number(proj.budget || 0);
  const totalCost =
    proj.total_cost !== undefined
      ? Number(proj.total_cost)
      : costs.reduce((s, c) => s + Number(c.amount || 0), 0);
  const resourceCost =
    proj.resource_cost !== undefined
      ? Number(proj.resource_cost)
      : costs
          .filter((c) => c.category === 'Resource Allocation')
          .reduce((s, c) => s + Number(c.amount || 0), 0);
  const vendorCost =
    proj.vendor_cost !== undefined ? Number(proj.vendor_cost) : totalCost - resourceCost;
  const profit = proj.profit !== undefined ? Number(proj.profit) : budget - totalCost;
  const marginPct =
    proj.profit_margin_pct !== undefined
      ? Number(proj.profit_margin_pct)
      : budget > 0
      ? Math.round((profit / budget) * 1000) / 10
      : 0;

  return {
    costs,
    budget,
    totalCost,
    vendorCost,
    resourceCost,
    profit,
    marginPct,
  };
}

function getCategoryBadgeStyle(category: ProjectCostCategory) {
  switch (category) {
    case 'Cloud / Infrastructure':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    case 'Resource Allocation':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    case 'Third-Party Vendor / API':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Software License / SaaS':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Contractor / Freelancer':
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  users,
  initialProjectId,
  onClearInitialId,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [managerFilter, setManagerFilter] = useState('ALL');
  const [viewFilter, setViewFilter] = useState<
    'ALL' | 'ACTIVE_DELIVERY' | 'DELIVERED_AMC' | 'EXPIRING_AMC'
  >('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Project Detail Page with Tabs: Overview, Costs & Profit, Timeline, AMC
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'costs' | 'timeline' | 'amc'>('overview');

  // Dedicated AMC Modal State
  const [amcModalOpen, setAmcModalOpen] = useState(false);
  const [amcTargetProject, setAmcTargetProject] = useState<Project | null>(null);
  const [amcForm, setAmcForm] = useState<{
    amc_active: boolean;
    amc_status: AmcStatus;
    amc_amount: string;
    amc_start_date: string;
    amc_end_date: string;
    amc_billing_cycle: AmcBillingCycle;
    amc_sla_tier: AmcSlaTier;
    amc_scope: string;
    amc_contact: string;
  }>({
    amc_active: true,
    amc_status: 'Active',
    amc_amount: '',
    amc_start_date: '',
    amc_end_date: '',
    amc_billing_cycle: 'Annual',
    amc_sla_tier: 'Standard 9x5',
    amc_scope: '',
    amc_contact: '',
  });
  const [amcSubmitting, setAmcSubmitting] = useState(false);

  // Add / Edit Project Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add / Edit Vendor Payment & Resource Allocation Cost Modal
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costTargetProject, setCostTargetProject] = useState<Project | null>(null);
  const [editingCost, setEditingCost] = useState<ProjectCost | null>(null);
  const [costForm, setCostForm] = useState<ProjectCostFormState>(emptyCostForm);
  const [selectedResourceHelperId, setSelectedResourceHelperId] = useState<string>('');
  const [resourceHoursHelper, setResourceHoursHelper] = useState<string>('40');
  const [costFormError, setCostFormError] = useState<string | null>(null);
  const [costSubmitting, setCostSubmitting] = useState(false);

  // Delete Project Confirmation
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Delete Cost Confirmation
  const [deletingCost, setDeletingCost] = useState<{
    project: Project;
    cost: ProjectCost;
  } | null>(null);
  const [deletingCostLoading, setDeletingCostLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [projRes, clientRes, resRes] = await Promise.all([
        apiFetch<{ projects: Project[] }>('/projects'),
        apiFetch<{ clients: Client[] }>('/clients'),
        apiFetch<{ resources: Resource[] }>('/resources').catch(() => ({ resources: [] })),
      ]);
      setProjects(projRes.projects);
      setClients(clientRes.clients);
      setResources(resRes.resources || []);
      if (selectedProject) {
        const refreshed = projRes.projects.find((p) => p.id === selectedProject.id);
        if (refreshed) setSelectedProject(refreshed);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (initialProjectId && projects.length > 0) {
      const found = projects.find((p) => p.id === initialProjectId);
      if (found) {
        setSelectedProject(found);
        setDetailTab('overview');
        onClearInitialId?.();
      }
    }
  }, [initialProjectId, projects]);

  const amcMetrics = useMemo(() => {
    const deliveredProjects = projects.filter((p) => p.status === 'Completed');
    const activeAmcs = projects.filter((p) => p.amc_active && p.amc_status === 'Active');
    const totalAmcArr = activeAmcs.reduce((acc, p) => acc + (p.amc_amount || 0), 0);

    const now = Date.now();
    const expiringSoon = projects.filter((p) => {
      if (!p.amc_active || !p.amc_end_date) return false;
      const diffDays = Math.ceil((new Date(p.amc_end_date).getTime() - now) / 86400000);
      return diffDays >= 0 && diffDays <= 45;
    });

    const expired = projects.filter((p) => {
      if (!p.amc_active || !p.amc_end_date) return false;
      const diffDays = Math.ceil((new Date(p.amc_end_date).getTime() - now) / 86400000);
      return diffDays < 0;
    });

    const deliveredWithoutAmc = deliveredProjects.filter(
      (p) => !p.amc_active || p.amc_status === 'Not Contracted'
    );
    const coverageRate =
      deliveredProjects.length > 0
        ? Math.round((activeAmcs.length / deliveredProjects.length) * 100)
        : 0;

    return {
      deliveredCount: deliveredProjects.length,
      activeAmcCount: activeAmcs.length,
      totalAmcArr,
      expiringSoonCount: expiringSoon.length,
      expiredCount: expired.length,
      deliveredWithoutAmcCount: deliveredWithoutAmc.length,
      coverageRate,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (clientFilter !== 'ALL' && p.client_id !== clientFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (managerFilter !== 'ALL' && p.manager_id !== managerFilter) return false;

      // View filter
      if (viewFilter === 'ACTIVE_DELIVERY' && (p.status === 'Completed' || p.status === 'Cancelled'))
        return false;
      if (viewFilter === 'DELIVERED_AMC' && p.status !== 'Completed' && !p.amc_active)
        return false;
      if (viewFilter === 'EXPIRING_AMC') {
        if (!p.amc_active || !p.amc_end_date) return false;
        const diffDays = Math.ceil((new Date(p.amc_end_date).getTime() - Date.now()) / 86400000);
        if (diffDays > 45) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesClient = p.client?.company.toLowerCase().includes(q);
        const matchesTech = p.tech_stack.toLowerCase().includes(q);
        const matchesAmc =
          p.amc_scope?.toLowerCase().includes(q) ||
          p.amc_sla_tier?.toLowerCase().includes(q) ||
          p.amc_contact?.toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesTech && !matchesAmc) return false;
      }
      return true;
    });
  }, [projects, clientFilter, statusFilter, managerFilter, viewFilter, search]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage]);

  const openAddModal = () => {
    setEditingProject(null);
    setForm({
      ...emptyProjectForm,
      client_id: clients[0]?.id || '',
      manager_id: users[0]?.id || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setForm({
      client_id: proj.client_id,
      name: proj.name,
      description: proj.description || '',
      service_type: proj.service_type,
      status: proj.status,
      start_date: toInputDate(proj.start_date),
      end_date: toInputDate(proj.end_date),
      budget: String(proj.budget ?? 0),
      currency: proj.currency || 'INR',
      manager_id: proj.manager_id || '',
      tech_stack: proj.tech_stack || '',
      progress: String(proj.progress ?? 0),
      progress_override: proj.progress_override ?? false,
      notes: proj.notes || '',
      amc_active: Boolean(proj.amc_active),
      amc_status: proj.amc_status || 'Not Contracted',
      amc_amount: proj.amc_amount ? String(proj.amc_amount) : '',
      amc_start_date: proj.amc_start_date ? toInputDate(proj.amc_start_date) : '',
      amc_end_date: proj.amc_end_date ? toInputDate(proj.amc_end_date) : '',
      amc_billing_cycle: proj.amc_billing_cycle || 'Annual',
      amc_sla_tier: proj.amc_sla_tier || 'Standard 9x5',
      amc_scope: proj.amc_scope || '',
      amc_contact: proj.amc_contact || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openAmcModal = (proj: Project) => {
    setAmcTargetProject(proj);
    const hasAmc = Boolean(proj.amc_active);
    const suggestedAmount =
      proj.amc_amount && proj.amc_amount > 0
        ? String(proj.amc_amount)
        : String(Math.round((Number(proj.budget || 500000) * 0.18) / 1000) * 1000);
    const now = new Date();
    const defaultStart = proj.amc_start_date
      ? toInputDate(proj.amc_start_date)
      : toInputDate(now.toISOString());
    const defaultEnd = proj.amc_end_date
      ? toInputDate(proj.amc_end_date)
      : toInputDate(new Date(now.getTime() + 365 * 86400000).toISOString());

    setAmcForm({
      amc_active: hasAmc || proj.status === 'Completed',
      amc_status:
        proj.amc_status || (proj.status === 'Completed' ? 'Active' : 'Not Contracted'),
      amc_amount: suggestedAmount,
      amc_start_date: defaultStart,
      amc_end_date: defaultEnd,
      amc_billing_cycle: proj.amc_billing_cycle || 'Annual',
      amc_sla_tier: proj.amc_sla_tier || 'Standard 9x5',
      amc_scope:
        proj.amc_scope ||
        '24/7 server uptime monitoring, security patch management, bug fixes (up to 20h/month), and cloud infra upkeep.',
      amc_contact: proj.amc_contact || proj.client?.contact_name || '',
    });
    setAmcModalOpen(true);
  };

  const handleSaveAmc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amcTargetProject) return;
    setAmcSubmitting(true);
    try {
      const res = await apiFetch<{ project: Project }>(`/projects/${amcTargetProject.id}/amc`, {
        method: 'PUT',
        body: JSON.stringify({
          amc_active: amcForm.amc_active,
          amc_status: amcForm.amc_status,
          amc_amount: Number(amcForm.amc_amount || 0),
          amc_start_date: amcForm.amc_start_date || null,
          amc_end_date: amcForm.amc_end_date || null,
          amc_billing_cycle: amcForm.amc_billing_cycle,
          amc_sla_tier: amcForm.amc_sla_tier,
          amc_scope: amcForm.amc_scope.trim(),
          amc_contact: amcForm.amc_contact.trim(),
        }),
      });
      setProjects((prev) => prev.map((p) => (p.id === res.project.id ? res.project : p)));
      if (selectedProject?.id === res.project.id) {
        setSelectedProject(res.project);
      }
      showToast(`Updated Annual Maintenance Contract (AMC) for "${res.project.name}"`);
      setAmcModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save AMC details', 'error');
    } finally {
      setAmcSubmitting(false);
    }
  };

  const handleExtendAmcOneYear = () => {
    const currentEnd = amcForm.amc_end_date ? new Date(amcForm.amc_end_date) : new Date();
    const newEnd = new Date(currentEnd.getTime() + 365 * 86400000);
    setAmcForm((prev) => ({
      ...prev,
      amc_active: true,
      amc_status: 'Active',
      amc_end_date: toInputDate(newEnd.toISOString()),
    }));
    showToast('Extended AMC coverage by +1 Year (365 days)');
  };

  const openAddCostModal = (
    proj: Project,
    preset?: {
      title: string;
      category: ProjectCostCategory;
      vendor_or_resource: string;
      notes: string;
    }
  ) => {
    setCostTargetProject(proj);
    setEditingCost(null);
    setSelectedResourceHelperId('');
    setResourceHoursHelper('40');
    setCostForm({
      title: preset?.title || '',
      category: preset?.category || 'Cloud / Infrastructure',
      vendor_or_resource: preset?.vendor_or_resource || '',
      amount: '',
      incurred_date: toInputDate(new Date().toISOString()),
      notes: preset?.notes || '',
    });
    setCostFormError(null);
    setCostModalOpen(true);
  };

  const openEditCostModal = (proj: Project, cost: ProjectCost) => {
    setCostTargetProject(proj);
    setEditingCost(cost);
    setSelectedResourceHelperId('');
    setCostForm({
      title: cost.title,
      category: cost.category,
      vendor_or_resource: cost.vendor_or_resource || '',
      amount: String(cost.amount ?? 0),
      incurred_date: toInputDate(cost.incurred_date),
      notes: cost.notes || '',
    });
    setCostFormError(null);
    setCostModalOpen(true);
  };

  const handleSelectResourceForCost = (resourceId: string, hoursStr: string) => {
    setSelectedResourceHelperId(resourceId);
    setResourceHoursHelper(hoursStr);
    const found = resources.find((r) => r.id === resourceId);
    if (found) {
      const hours = Number(hoursStr || 0);
      const calculatedCost = Math.round(hours * Number(found.hourly_rate || 0));
      setCostForm((prev) => ({
        ...prev,
        category: 'Resource Allocation',
        title: prev.title || `Resource Allocation — ${found.name} (${found.role_title})`,
        vendor_or_resource: `${found.name} (${found.role_title})`,
        amount: calculatedCost > 0 ? String(calculatedCost) : prev.amount,
        notes:
          prev.notes ||
          `${hours} hrs @ ${formatCurrency(found.hourly_rate, 'INR')}/hr (${found.department} · ${found.seniority})`,
      }));
    }
  };

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costTargetProject) return;
    setCostFormError(null);

    const numericAmount = Number(costForm.amount);
    if (!costForm.title.trim()) {
      setCostFormError('Please enter a cost title / description (e.g., Purchased AWS).');
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setCostFormError('Please enter a valid cost amount greater than 0.');
      return;
    }

    setCostSubmitting(true);
    try {
      const payload = {
        title: costForm.title.trim(),
        category: costForm.category,
        vendor_or_resource: costForm.vendor_or_resource.trim(),
        amount: numericAmount,
        incurred_date: costForm.incurred_date,
        notes: costForm.notes.trim(),
      };

      if (editingCost) {
        const res = await apiFetch<{ cost: ProjectCost; project: Project }>(
          `/projects/${costTargetProject.id}/costs/${editingCost.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        setProjects((prev) =>
          prev.map((p) => (p.id === res.project.id ? res.project : p))
        );
        if (selectedProject?.id === res.project.id) {
          setSelectedProject(res.project);
        }
        showToast(
          `Updated cost "${res.cost.title}" — New Project Profit: ${formatCurrency(
            res.project.profit ?? 0,
            res.project.currency
          )}`
        );
      } else {
        const res = await apiFetch<{ cost: ProjectCost; project: Project }>(
          `/projects/${costTargetProject.id}/costs`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        setProjects((prev) =>
          prev.map((p) => (p.id === res.project.id ? res.project : p))
        );
        if (selectedProject?.id === res.project.id) {
          setSelectedProject(res.project);
        }
        showToast(
          `Added ${formatCurrency(
            res.cost.amount,
            res.project.currency
          )} cost — Remaining Project Profit: ${formatCurrency(
            res.project.profit ?? 0,
            res.project.currency
          )}`
        );
      }

      setCostModalOpen(false);
    } catch (err) {
      setCostFormError(err instanceof Error ? err.message : 'Failed to save project cost');
    } finally {
      setCostSubmitting(false);
    }
  };

  const handleConfirmDeleteCost = async () => {
    if (!deletingCost) return;
    setDeletingCostLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; project: Project }>(
        `/projects/${deletingCost.project.id}/costs/${deletingCost.cost.id}`,
        { method: 'DELETE' }
      );
      setProjects((prev) =>
        prev.map((p) => (p.id === res.project.id ? res.project : p))
      );
      if (selectedProject?.id === res.project.id) {
        setSelectedProject(res.project);
      }
      showToast(
        `Removed "${deletingCost.cost.title}" — Updated Project Profit: ${formatCurrency(
          res.project.profit ?? 0,
          res.project.currency
        )}`
      );
      setDeletingCost(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete cost', 'error');
    } finally {
      setDeletingCostLoading(false);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.client_id || !form.start_date || !form.end_date) {
      setFormError('Project name, client, start date, and expected end date are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_id: form.client_id,
        name: form.name.trim(),
        description: form.description.trim(),
        service_type: form.service_type,
        status: form.status,
        start_date: form.start_date,
        end_date: form.end_date,
        budget: Number(form.budget || 0),
        currency: form.currency,
        manager_id: form.manager_id || null,
        tech_stack: form.tech_stack.trim(),
        progress: Math.min(100, Math.max(0, Number(form.progress || 0))),
        progress_override: form.progress_override,
        notes: form.notes.trim(),
        amc_active: form.amc_active,
        amc_status: form.amc_status,
        amc_amount: Number(form.amc_amount || 0),
        amc_start_date: form.amc_start_date || null,
        amc_end_date: form.amc_end_date || null,
        amc_billing_cycle: form.amc_billing_cycle,
        amc_sla_tier: form.amc_sla_tier,
        amc_scope: form.amc_scope.trim(),
        amc_contact: form.amc_contact.trim(),
      };

      if (editingProject) {
        const res = await apiFetch<{ project: Project }>(`/projects/${editingProject.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated project "${res.project.name}"`);
        if (selectedProject?.id === res.project.id) {
          setSelectedProject(res.project);
        }
      } else {
        const res = await apiFetch<{ project: Project }>('/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Created project "${res.project.name}"`);
      }

      setModalOpen(false);
      fetchAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusOrProgressUpdate = async (
    proj: Project,
    updates: { status?: ProjectStatus; progress?: number; progress_override?: boolean }
  ) => {
    try {
      const res = await apiFetch<{ project: Project }>(`/projects/${proj.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (selectedProject?.id === proj.id) {
        setSelectedProject(res.project);
      }
      fetchAll();
      showToast(`Updated "${proj.name}"`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/projects/${deletingProject.id}`, { method: 'DELETE' });
      showToast(`Deleted project "${deletingProject.name}"`);
      if (selectedProject?.id === deletingProject.id) {
        setSelectedProject(null);
      }
      setDeletingProject(null);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete project', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredProjects.map((p) => {
      const fin = getProjectFinancials(p);
      return {
        Project_Name: p.name,
        Client: p.client?.company || '',
        Service_Type: p.service_type,
        Status: p.status,
        Start_Date: formatDate(p.start_date),
        Expected_End_Date: formatDate(p.end_date),
        Budget: fin.budget,
        Total_Cost: fin.totalCost,
        Vendor_Cost: fin.vendorCost,
        Resource_Cost: fin.resourceCost,
        Net_Profit: fin.profit,
        Profit_Margin_Pct: `${fin.marginPct}%`,
        Currency: p.currency,
        Project_Manager: p.manager?.name || 'Unassigned',
        Progress_Percent: `${p.progress}%`,
        Tech_Stack: p.tech_stack,
      };
    });
    exportToCsv('nexcrm-projects-profitability.csv', rows);
    showToast(`Exported ${rows.length} projects with cost & profit breakdown to CSV`);
  };

  const renderProjectAmcSection = () => {
    if (!selectedProject) return null;
    const hasAmc = Boolean(selectedProject.amc_active);

    return (
      <div className="space-y-6">
        {/* AMC Header Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-[#3596B0] shrink-0 border border-teal-100 dark:border-teal-900/60">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Annual Maintenance Contract (AMC)
                </h3>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    hasAmc && selectedProject.amc_status === 'Active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : selectedProject.amc_status === 'Pending Renewal'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : selectedProject.amc_status === 'Expired'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {hasAmc ? selectedProject.amc_status || 'Active' : 'Not Contracted'}
                </span>
                {selectedProject.amc_is_expiring_soon && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                    Expiring Soon!
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Post-delivery infrastructure maintenance, SLA uptime commitments, security updates, and routine technical upkeep for {selectedProject.name}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {hasAmc && (
              <button
                type="button"
                onClick={() => {
                  openAmcModal(selectedProject);
                  handleExtendAmcOneYear();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                +1 Year Renewal
              </button>
            )}
            <button
              type="button"
              onClick={() => openAmcModal(selectedProject)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              {hasAmc ? 'Edit AMC Terms' : 'Contract AMC'}
            </button>
          </div>
        </div>

        {/* 4 AMC Vital Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Annual Contract Fee
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(selectedProject.amc_amount || 0, selectedProject.currency)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              Billed {selectedProject.amc_billing_cycle || 'Annual'}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Contract Tenure &amp; Expiry
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {selectedProject.amc_end_date ? formatDate(selectedProject.amc_end_date) : 'Not configured'}
            </div>
            <span
              className={`text-[11px] font-semibold mt-0.5 block ${
                selectedProject.amc_is_expired
                  ? 'text-rose-600 dark:text-rose-400'
                  : selectedProject.amc_is_expiring_soon
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {selectedProject.amc_days_remaining !== null && selectedProject.amc_days_remaining !== undefined
                ? selectedProject.amc_is_expired
                  ? `Expired ${Math.abs(selectedProject.amc_days_remaining)} days ago`
                  : `${selectedProject.amc_days_remaining} days remaining until renewal`
                : 'Tenure unconfigured'}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              SLA Support Tier
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              {selectedProject.amc_sla_tier || 'Standard 9x5'}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              {selectedProject.amc_sla_tier === '24/7 Mission Critical'
                ? '99.9% Uptime & 15m P1 SLA'
                : 'Business Hours & 4h SLA'}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Primary SPOC Contact
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {selectedProject.amc_contact || selectedProject.client?.contact_name || 'Not assigned'}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block truncate">
              {selectedProject.client?.company}
            </span>
          </div>
        </div>

        {/* Detailed Scope of Maintenance & SLA Coverage Checklist */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            AMC Scope of Deliverables &amp; Support Coverage
          </h4>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
            {selectedProject.amc_scope ||
              'Standard Enterprise AMC Scope:\n• 24/7 Cloud server monitoring and uptime oversight\n• Regular Linux OS security updates & critical CVE patching\n• Monthly database index maintenance and automated snapshot verification\n• Up to 20 hours/month of engineering bug fixes & minor enhancement support\n• SSL/TLS certificate renewal management'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">Incident Hotfixes</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">Rapid response to production bugs and regressions.</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">Security &amp; Backups</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">Automated database snapshots and security patching.</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">Periodic Health Check</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">Monthly SLA performance &amp; server audit reports.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCostModal = () => (
    <Modal
      open={costModalOpen}
      onClose={() => setCostModalOpen(false)}
      title={
        editingCost
          ? `Edit Project Cost — ${costTargetProject?.name || ''}`
          : `Add Vendor Payment / Resource Cost — ${costTargetProject?.name || ''}`
      }
      subtitle="Add vendor payments (e.g. Purchased AWS) or resource allocation costs. This deducts from the project budget to calculate net profit."
    >
      <form onSubmit={handleSaveCost} className="space-y-4">
        {costFormError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
            {costFormError}
          </div>
        )}

        {/* Quick Preset Chips */}
        {!editingCost && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Quick Fill Presets:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COST_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setCostForm((prev) => ({
                      ...prev,
                      title: preset.title,
                      category: preset.category,
                      vendor_or_resource: preset.vendor_or_resource,
                      notes: preset.notes,
                    }))
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cost Category *
            </label>
            <select
              value={costForm.category}
              onChange={(e) =>
                setCostForm({ ...costForm, category: e.target.value as ProjectCostCategory })
              }
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {PROJECT_COST_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Resource Rate Calculator when Category is Resource Allocation */}
          {costForm.category === 'Resource Allocation' && resources.length > 0 && (
            <div className="sm:col-span-2 p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/70 space-y-2">
              <div className="text-[11px] font-bold text-purple-800 dark:text-purple-300">
                Optional: Calculate from Team Resource Hourly Rate
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <select
                    value={selectedResourceHelperId}
                    onChange={(e) =>
                      handleSelectResourceForCost(e.target.value, resourceHoursHelper)
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Select Team Resource --</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.role_title} ({formatCurrency(r.hourly_rate, 'INR')}/hr)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    min={1}
                    value={resourceHoursHelper}
                    onChange={(e) =>
                      handleSelectResourceForCost(selectedResourceHelperId, e.target.value)
                    }
                    placeholder="Hours"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cost Item / Description *
            </label>
            <input
              type="text"
              required
              value={costForm.title}
              onChange={(e) => setCostForm({ ...costForm, title: e.target.value })}
              placeholder="e.g. Purchased AWS Production Server, Senior Engineer Resource Allocation"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vendor or Resource Name
            </label>
            <input
              type="text"
              value={costForm.vendor_or_resource}
              onChange={(e) => setCostForm({ ...costForm, vendor_or_resource: e.target.value })}
              placeholder="e.g. Amazon Web Services (AWS), DevOps Team"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cost Amount ({costTargetProject?.currency || 'INR'}) *
            </label>
            <input
              type="number"
              required
              min={0}
              step="any"
              value={costForm.amount}
              onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
              placeholder="e.g. 45000"
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Date Incurred
            </label>
            <input
              type="date"
              value={costForm.incurred_date}
              onChange={(e) => setCostForm({ ...costForm, incurred_date: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Live Profit Preview Box inside Modal */}
          {costTargetProject && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
              {(() => {
                const fin = getProjectFinancials(costTargetProject);
                const enteredAmt = Number(costForm.amount || 0);
                const oldAmt = editingCost ? Number(editingCost.amount || 0) : 0;
                const projectedTotalCost = fin.totalCost - oldAmt + enteredAmt;
                const projectedProfit = fin.budget - projectedTotalCost;
                return (
                  <div className="text-xs space-y-0.5">
                    <div className="text-slate-500 dark:text-slate-400">
                      Projected Profit after this cost:
                    </div>
                    <div
                      className={`text-sm font-extrabold ${
                        projectedProfit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(projectedProfit, costTargetProject.currency)}{' '}
                      <span className="text-[11px] font-medium text-slate-500">
                        (of {formatCurrency(fin.budget, costTargetProject.currency)} budget)
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes / Invoice Reference
            </label>
            <textarea
              rows={2}
              value={costForm.notes}
              onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })}
              placeholder="Invoice #, AWS account ID, sprint allocation details..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCostModalOpen(false)}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={costSubmitting}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          >
            {costSubmitting
              ? 'Saving Cost...'
              : editingCost
              ? 'Update Cost'
              : 'Add Cost & Update Profit'}
          </button>
        </div>
      </form>
    </Modal>
  );

  /* Project Detail Page with Tabs: Overview | Costs & Profit | Timeline */
  if (selectedProject) {
    const tags = selectedProject.tech_stack
      ? selectedProject.tech_stack
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const fin = getProjectFinancials(selectedProject);
    const vendorPct =
      fin.budget > 0 ? Math.min(100, Math.round((fin.vendorCost / fin.budget) * 100)) : 0;
    const resourcePct =
      fin.budget > 0
        ? Math.min(100 - vendorPct, Math.round((fin.resourceCost / fin.budget) * 100))
        : 0;

    const renderProjectCostsLedgerSection = () => (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Vendor Payments &amp; Resource Allocation Costs ({fin.costs.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every vendor payment (e.g. Purchased AWS) and resource allocation cost added here
              automatically deducts from the project budget ({formatCurrency(fin.budget, selectedProject.currency)}) to calculate net profit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddCostModal(selectedProject)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Vendor / Resource Cost
          </button>
        </div>

        {/* Quick-Add Buttons for Common Costs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Add:
          </span>
          {QUICK_COST_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => openAddCostModal(selectedProject, preset)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              + {preset.label}
            </button>
          ))}
        </div>

        {/* Costs Table */}
        {fin.costs.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No vendor payments or resource allocation costs recorded yet.
            </div>
            <p className="text-xs text-slate-400">
              Click <strong>+ Purchased AWS</strong>, <strong>+ Resource Allocation Cost</strong>,
              or <strong>Add Vendor / Resource Cost</strong> above to deduct expenses from the
              budget and track profit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Cost Item / Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Vendor / Resource</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Cost (Deducted)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {fin.costs.map((cost) => (
                  <tr
                    key={cost.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {cost.title}
                      </div>
                      {cost.notes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {cost.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${getCategoryBadgeStyle(
                          cost.category
                        )}`}
                      >
                        {cost.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {cost.vendor_or_resource || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(cost.incurred_date)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      - {formatCurrency(cost.amount, selectedProject.currency)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditCostModal(selectedProject, cost)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Cost"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeletingCost({ project: selectedProject, cost })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Cost"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-t-2 border-slate-200 dark:border-slate-700 text-xs font-bold">
                  <td colSpan={4} className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    Total Deducted Costs (Vendor Payments + Resource Allocations)
                  </td>
                  <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                    - {formatCurrency(fin.totalCost, selectedProject.currency)}
                  </td>
                  <td />
                </tr>
                <tr className="bg-emerald-50/70 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800/70 text-sm font-extrabold">
                  <td colSpan={4} className="py-3.5 px-4 text-slate-900 dark:text-slate-100">
                    Net Project Profit (Budget {formatCurrency(fin.budget, selectedProject.currency)}{' '}
                    &minus; Costs {formatCurrency(fin.totalCost, selectedProject.currency)})
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right ${
                      fin.profit >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(fin.profit, selectedProject.currency)} ({fin.marginPct}%)
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedProject.name}
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getProjectStatusBadge(
                    selectedProject.status
                  )}`}
                >
                  {selectedProject.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Client:{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('clients', selectedProject.client_id)}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {selectedProject.client?.company}
                </button>{' '}
                &bull; {selectedProject.service_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('client_payments', selectedProject.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Client Payments
            </button>
            <button
              type="button"
              onClick={() => openAddCostModal(selectedProject)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Vendor / Resource Cost
            </button>
            <button
              type="button"
              onClick={() => openEditModal(selectedProject)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Project
            </button>
          </div>
        </div>

        {/* 4-Card Project Budget, Vendor Cost, Resource Cost & Net Profit Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Project Budget</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(fin.budget, selectedProject.currency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Total contracted client budget
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-sky-900/60 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <span>Vendor &amp; Cloud Costs</span>
              <Server className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              - {formatCurrency(fin.vendorCost, selectedProject.currency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Purchased AWS, APIs, SaaS &amp; vendors
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-900/60 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              <span>Resource Allocation Cost</span>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              - {formatCurrency(fin.resourceCost, selectedProject.currency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Allocated engineering &amp; team cost
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-xs ${
              fin.profit >= 0
                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <span>Net Project Profit</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                fin.profit >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(fin.profit, selectedProject.currency)}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-600 dark:text-slate-400">
                Total Cost: {formatCurrency(fin.totalCost, selectedProject.currency)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold ${
                  fin.profit >= 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                }`}
              >
                {fin.marginPct}% margin
              </span>
            </div>
          </div>
        </div>

        {/* Visual Budget vs Cost vs Profit Breakdown Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between text-xs gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Budget Utilization &amp; Profit Breakdown
            </span>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                Vendor / AWS Cost: {formatCurrency(fin.vendorCost, selectedProject.currency)} ({vendorPct}%)
              </span>
              <span className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                Resource Allocation: {formatCurrency(fin.resourceCost, selectedProject.currency)} ({resourcePct}%)
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Remaining Profit: {formatCurrency(fin.profit, selectedProject.currency)} ({fin.marginPct}%)
              </span>
            </div>
          </div>
          <div className="w-full h-3 bg-emerald-500/20 dark:bg-emerald-950 rounded-full overflow-hidden flex">
            {vendorPct > 0 && (
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${vendorPct}%` }}
                title={`Vendor Cost: ${vendorPct}%`}
              />
            )}
            {resourcePct > 0 && (
              <div
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${resourcePct}%` }}
                title={`Resource Cost: ${resourcePct}%`}
              />
            )}
            <div
              className="h-full bg-emerald-500 transition-all flex-1"
              title={`Profit: ${fin.marginPct}%`}
            />
          </div>
        </div>

        {/* Detail Tabs: Overview | Costs & Profit | Timeline */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setDetailTab('overview')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              detailTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Overview &amp; Costs
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('costs')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              detailTab === 'costs'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Vendor &amp; Resource Costs ({fin.costs.length})
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('timeline')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              detailTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Timeline ({selectedProject.timeline_entries?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('amc')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              detailTab === 'amc'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            AMC &amp; Maintenance
            {selectedProject.amc_active && (
              <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                {formatCurrency(selectedProject.amc_amount || 0, selectedProject.currency)}/yr
              </span>
            )}
          </button>
        </div>

        {detailTab === 'overview' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Project Scope &amp; Description
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedProject.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">
                      Budget &rarr; Profit
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {formatCurrency(fin.budget, selectedProject.currency)} &rarr;{' '}
                      <span
                        className={
                          fin.profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {formatCurrency(fin.profit, selectedProject.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">
                      Start &rarr; Expected End
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {formatDate(selectedProject.start_date)} &rarr;{' '}
                      {formatDate(selectedProject.end_date)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">
                      Project Manager
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1.5 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                      {selectedProject.manager?.name || 'Unassigned'}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Tech Stack Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.length === 0 ? (
                      <span className="text-xs text-slate-400">No tech stack tags specified.</span>
                    ) : (
                      tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800"
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Internal Project Notes
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedProject.notes || 'No project notes added.'}
                  </p>
                </div>
              </div>

              {/* Right Column: Manual Status & Progress Control Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Manual Status &amp; Progress Control
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Project Status
                  </label>
                  <select
                    value={selectedProject.status}
                    onChange={(e) =>
                      handleQuickStatusOrProgressUpdate(selectedProject, {
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Completion Progress
                    </span>
                    <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedProject.progress}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedProject.progress}
                    onChange={(e) =>
                      handleQuickStatusOrProgressUpdate(selectedProject, {
                        progress: Number(e.target.value),
                        progress_override: true,
                      })
                    }
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Drag slider to set manual progress %, or manage milestones in the{' '}
                    <button
                      type="button"
                      onClick={() => setDetailTab('timeline')}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      Timeline tab
                    </button>
                    .
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Payments & Resource Allocation Costs Ledger directly visible in Overview */}
            {renderProjectCostsLedgerSection()}
          </div>
        ) : detailTab === 'costs' ? (
          renderProjectCostsLedgerSection()
        ) : detailTab === 'timeline' ? (
          /* Embedded Timeline Tab for this Project */
          <TimelinePage
            users={users}
            embeddedProjectId={selectedProject.id}
            onProjectUpdated={fetchAll}
          />
        ) : (
          renderProjectAmcSection()
        )}

        {renderCostModal()}

        <ConfirmDialog
          open={Boolean(deletingCost)}
          onClose={() => setDeletingCost(null)}
          onConfirm={handleConfirmDeleteCost}
          loading={deletingCostLoading}
          title="Remove Project Cost"
          description={`Are you sure you want to remove "${deletingCost?.cost.title}"? This will restore ${
            deletingCost
              ? formatCurrency(deletingCost.cost.amount, deletingCost.project.currency)
              : ''
          } back to the project's profit.`}
          confirmLabel="Remove Cost"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Active &amp; Delivered Projects
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredProjects.length === 0}
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
            Add Project
          </button>
        </div>
      </div>

      {/* Annual Maintenance Contract (AMC) Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total AMC ARR
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#3596B0]">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatCurrency(amcMetrics.totalAmcArr, 'INR')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Across {amcMetrics.activeAmcCount} active maintenance contract{amcMetrics.activeAmcCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Delivered AMC Coverage
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {amcMetrics.coverageRate}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {amcMetrics.activeAmcCount} of {amcMetrics.deliveredCount} delivered projects covered
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Renewals Due (&lt; 45 Days)
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {amcMetrics.expiringSoonCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {amcMetrics.expiringSoonCount > 0
              ? 'Action required: outreach renewal'
              : 'All active contracts in good standing'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Delivered Without AMC
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {amcMetrics.deliveredWithoutAmcCount}
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
            Opportunity: contract maintenance
          </div>
        </div>
      </div>

      {/* View Filter Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewFilter('ALL')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
            viewFilter === 'ALL'
              ? 'bg-[#0F2547] text-white border-[#0F2547] dark:bg-indigo-600 dark:border-indigo-600 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          All Projects ({projects.length})
        </button>

        <button
          type="button"
          onClick={() => setViewFilter('ACTIVE_DELIVERY')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
            viewFilter === 'ACTIVE_DELIVERY'
              ? 'bg-[#0F2547] text-white border-[#0F2547] dark:bg-indigo-600 dark:border-indigo-600 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          In Delivery ({projects.filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled').length})
        </button>

        <button
          type="button"
          onClick={() => setViewFilter('DELIVERED_AMC')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
            viewFilter === 'DELIVERED_AMC'
              ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-600 shadow-sm'
              : 'border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300 hover:bg-teal-100/60'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Delivered &amp; AMC Track ({projects.filter((p) => p.status === 'Completed' || p.amc_active).length})
        </button>

        {amcMetrics.expiringSoonCount > 0 && (
          <button
            type="button"
            onClick={() => setViewFilter('EXPIRING_AMC')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              viewFilter === 'EXPIRING_AMC'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            AMC Expiring Soon ({amcMetrics.expiringSoonCount})
          </button>
        )}
      </div>

      {/* Filters Bar: Search, Client, Status, Project Manager */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name or tech stack..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Managers</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects match your filters"
            description="Create a new client project or reset your current filters."
            actionLabel="Add Project"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Project Name &amp; Tech Stack</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Budget</th>
                    <th className="py-3.5 px-4">AMC Support</th>
                    <th className="py-3.5 px-4">Vendor &amp; Resource Costs</th>
                    <th className="py-3.5 px-4">Net Profit</th>
                    <th className="py-3.5 px-4">Progress %</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                  {paginatedProjects.map((proj) => {
                    const fin = getProjectFinancials(proj);
                    return (
                      <tr
                        key={proj.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProject(proj);
                              setDetailTab('overview');
                            }}
                            className="text-left group cursor-pointer"
                          >
                            <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {proj.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {proj.service_type} &bull; {formatDate(proj.start_date)} to{' '}
                              {formatDate(proj.end_date)}
                            </div>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => onNavigate('clients', proj.client_id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600"
                          >
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {proj.client?.company}
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={proj.status}
                            onChange={(e) =>
                              handleQuickStatusOrProgressUpdate(proj, {
                                status: e.target.value as ProjectStatus,
                              })
                            }
                            aria-label={`Status for ${proj.name}`}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${getProjectStatusBadge(
                              proj.status
                            )}`}
                          >
                            {PROJECT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatCurrency(fin.budget, proj.currency)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {proj.amc_active && proj.amc_status === 'Active' ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <ShieldCheck className="w-3 h-3" />
                                  Active AMC
                                </span>
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                  {formatCurrency(proj.amc_amount || 0, proj.currency)}/yr
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="truncate max-w-[110px]">{proj.amc_sla_tier || 'Standard'}</span>
                                {proj.amc_days_remaining !== undefined && proj.amc_days_remaining !== null && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-semibold ${
                                      proj.amc_days_remaining <= 0
                                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700'
                                        : proj.amc_days_remaining <= 45
                                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {proj.amc_days_remaining <= 0
                                      ? 'Expired'
                                      : `${proj.amc_days_remaining}d left`}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : proj.amc_active && proj.amc_status === 'Pending Renewal' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3 h-3" />
                                Renewal Due
                              </span>
                              <div className="text-[10px] text-slate-500">
                                {formatCurrency(proj.amc_amount || 0, proj.currency)}/yr
                              </div>
                            </div>
                          ) : proj.status === 'Completed' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <ShieldAlert className="w-3 h-3 text-slate-400" />
                                No AMC
                              </span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openAmcModal(proj)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                >
                                  + Track AMC
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Post-Delivery
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                - {formatCurrency(fin.totalCost, proj.currency)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {fin.costs.length} cost item{fin.costs.length === 1 ? '' : 's'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddCostModal(proj)}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                              title="Add Vendor Payment (AWS, etc.) or Resource Allocation Cost"
                            >
                              + Cost
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div
                            className={`text-xs font-extrabold ${
                              fin.profit >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatCurrency(fin.profit, proj.currency)}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500">
                            {fin.marginPct}% profit margin
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"
                                style={{ width: `${proj.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {proj.progress}%
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openAmcModal(proj)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                              title="Manage Annual Maintenance Contract (AMC)"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              AMC
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigate('client_payments', proj.id)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                              title="View Client Payment Phases"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Payments
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProject(proj);
                                setDetailTab('overview');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(proj)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProject(proj)}
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
              totalItems={filteredProjects.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Vendor Payment & Resource Allocation Cost Modal */}
      {renderCostModal()}

      {/* Add / Edit Project Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProject ? `Edit Project — ${editingProject.name}` : 'Add New Project'}
        subtitle="Configure project client, service type, schedule, budget, tech stack, and manager."
      >
        <form onSubmit={handleSaveProject} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cloud Migration & Kubernetes Platform"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client *
              </label>
              <select
                required
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.contact_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Service Type *
              </label>
              <select
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value as ServiceType })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                Project Manager
              </label>
              <select
                value={form.manager_id}
                onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
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
                Expected End Date *
              </label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget
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
                Progress % ({form.progress}%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) =>
                  setForm({ ...form, progress: e.target.value, progress_override: true })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tech Stack (Tags separated by commas)
              </label>
              <input
                type="text"
                value={form.tech_stack}
                onChange={(e) => setForm({ ...form, tech_stack: e.target.value })}
                placeholder="React, TypeScript, Node.js, AWS, Docker"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Project scope, key deliverables..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Staging links, repository notes, deployment risks..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* AMC Configuration Card inside Add/Edit Modal */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Annual Maintenance Contract (AMC)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Track post-delivery SLA maintenance, recurring retainer, and renewal cycle.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.amc_active}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amc_active: e.target.checked,
                      amc_status: e.target.checked
                        ? form.amc_status === 'Not Contracted'
                          ? 'Active'
                          : form.amc_status
                        : 'Not Contracted',
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600" />
              </label>
            </div>

            {form.amc_active && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      AMC Status
                    </label>
                    <select
                      value={form.amc_status}
                      onChange={(e) =>
                        setForm({ ...form, amc_status: e.target.value as AmcStatus })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Active">Active</option>
                      <option value="Pending Renewal">Pending Renewal</option>
                      <option value="Expired">Expired</option>
                      <option value="Not Contracted">Not Contracted</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Annual Fee (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={form.amc_amount}
                      onChange={(e) => setForm({ ...form, amc_amount: e.target.value })}
                      placeholder="e.g. 90000"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Billing Cycle
                    </label>
                    <select
                      value={form.amc_billing_cycle}
                      onChange={(e) =>
                        setForm({ ...form, amc_billing_cycle: e.target.value as AmcBillingCycle })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Annual">Annual</option>
                      <option value="Semi-Annual">Semi-Annual</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      AMC Start Date
                    </label>
                    <input
                      type="date"
                      value={form.amc_start_date}
                      onChange={(e) => setForm({ ...form, amc_start_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      AMC End Date
                    </label>
                    <input
                      type="date"
                      value={form.amc_end_date}
                      onChange={(e) => setForm({ ...form, amc_end_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SLA Tier
                    </label>
                    <select
                      value={form.amc_sla_tier}
                      onChange={(e) =>
                        setForm({ ...form, amc_sla_tier: e.target.value as AmcSlaTier })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Standard 9x5">Standard 9x5 Support</option>
                      <option value="24/7 Mission Critical">24/7 Mission Critical</option>
                      <option value="Basic Support">Basic Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client AMC SPOC
                    </label>
                    <input
                      type="text"
                      value={form.amc_contact}
                      onChange={(e) => setForm({ ...form, amc_contact: e.target.value })}
                      placeholder="e.g. Ramesh Kumar (CTO)"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Maintenance Scope / Deliverables
                  </label>
                  <input
                    type="text"
                    value={form.amc_scope}
                    onChange={(e) => setForm({ ...form, amc_scope: e.target.value })}
                    placeholder="Uptime monitoring, security patch management, bug fixes up to 20h/mo..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
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
              {submitting ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick AMC Contract & Renewal Modal */}
      <Modal
        open={amcModalOpen}
        onClose={() => setAmcModalOpen(false)}
        title={amcTargetProject ? `AMC Support — ${amcTargetProject.name}` : 'AMC Support Contract'}
        subtitle="Manage Annual Maintenance Contract, renewals, SLA tier, and maintenance terms."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveAmc} className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Active Maintenance Contract
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Enable post-delivery AMC tracking, SLA guarantees, and recurring annual retainer.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={amcForm.amc_active}
                onChange={(e) =>
                  setAmcForm({
                    ...amcForm,
                    amc_active: e.target.checked,
                    amc_status: e.target.checked
                      ? amcForm.amc_status === 'Not Contracted'
                        ? 'Active'
                        : amcForm.amc_status
                      : 'Not Contracted',
                  })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contract Status
              </label>
              <select
                value={amcForm.amc_status}
                onChange={(e) =>
                  setAmcForm({
                    ...amcForm,
                    amc_status: e.target.value as AmcStatus,
                    amc_active: e.target.value !== 'Not Contracted',
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              >
                <option value="Active">Active</option>
                <option value="Pending Renewal">Pending Renewal</option>
                <option value="Expired">Expired</option>
                <option value="Not Contracted">Not Contracted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual AMC Fee ({amcTargetProject?.currency || 'INR'})
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={amcForm.amc_amount}
                onChange={(e) => setAmcForm({ ...amcForm, amc_amount: e.target.value })}
                placeholder="e.g. 150000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Billing Cycle
              </label>
              <select
                value={amcForm.amc_billing_cycle}
                onChange={(e) =>
                  setAmcForm({ ...amcForm, amc_billing_cycle: e.target.value as AmcBillingCycle })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Annual">Annual (100% upfront)</option>
                <option value="Semi-Annual">Semi-Annual (50% x 2)</option>
                <option value="Quarterly">Quarterly (25% x 4)</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                AMC Start Date
              </label>
              <input
                type="date"
                value={amcForm.amc_start_date}
                onChange={(e) => setAmcForm({ ...amcForm, amc_start_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  AMC End Date
                </label>
                <button
                  type="button"
                  onClick={handleExtendAmcOneYear}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  +1 Year From Current
                </button>
              </div>
              <input
                type="date"
                value={amcForm.amc_end_date}
                onChange={(e) => setAmcForm({ ...amcForm, amc_end_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Support &amp; SLA Commitment Tier
              </label>
              <select
                value={amcForm.amc_sla_tier}
                onChange={(e) =>
                  setAmcForm({ ...amcForm, amc_sla_tier: e.target.value as AmcSlaTier })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Standard 9x5">Standard 9x5 Support (&lt;4h response)</option>
                <option value="24/7 Mission Critical">24/7 Mission Critical (&lt;1h response, dedicated on-call)</option>
                <option value="Basic Support">Basic Support (Email only, best-effort)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client AMC SPOC / Contact
              </label>
              <input
                type="text"
                value={amcForm.amc_contact}
                onChange={(e) => setAmcForm({ ...amcForm, amc_contact: e.target.value })}
                placeholder="e.g. Ramesh Kumar (CTO) — +91 98765 43210"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deliverables &amp; Maintenance Scope
            </label>
            <textarea
              rows={3}
              value={amcForm.amc_scope}
              onChange={(e) => setAmcForm({ ...amcForm, amc_scope: e.target.value })}
              placeholder="e.g. Bug fixes up to 20h/mo, cloud infrastructure monitoring, security updates, SSL renewals..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleExtendAmcOneYear}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Quick +1 Year Renewal
            </button>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAmcModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={amcSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {amcSubmitting ? 'Saving AMC...' : 'Save AMC Contract'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDeleteProject}
        loading={deletingLoading}
        title="Delete Project"
        description={`Are you sure you want to delete "${deletingProject?.name}" and all its timeline entries?`}
        confirmLabel="Delete Project"
      />
    </div>
  );
};
