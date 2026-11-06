import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Tag,
  CreditCard,
  Server,
  Briefcase,
  Laptop,
  Plane,
  Scale,
  Sparkles,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
  ExpenseSummary,
  NavTab,
  Project,
  User,
} from '../types/crm';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_STATUSES,
  exportToCsv,
  formatCurrency,
  formatDate,
  getExpenseCategoryBadge,
  getExpenseStatusBadge,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface ExpensesPageProps {
  users?: User[];
  onNavigate?: (tab: NavTab, contextId?: string) => void;
}

interface ExpenseFormState {
  title: string;
  category: ExpenseCategory;
  amount: string;
  currency: string;
  expense_date: string;
  status: ExpenseStatus;
  payment_method: ExpensePaymentMethod;
  vendor: string;
  invoice_number: string;
  receipt_url: string;
  project_id: string;
  paid_by: string;
  notes: string;
}

const emptyForm: ExpenseFormState = {
  title: '',
  category: 'Cloud & Hosting',
  amount: '',
  currency: 'INR',
  expense_date: toInputDate(new Date().toISOString()),
  status: 'Paid',
  payment_method: 'Bank Transfer / NEFT',
  vendor: '',
  invoice_number: '',
  receipt_url: '',
  project_id: '',
  paid_by: 'Finance Operations',
  notes: '',
};

const COMMON_EXPENSE_PRESETS = [
  {
    label: 'AWS Cloud Compute',
    title: 'AWS Cloud Infrastructure & EC2 Cluster',
    category: 'Cloud & Hosting' as ExpenseCategory,
    amount: '85000',
    vendor: 'Amazon Web Services India',
    payment_method: 'Corporate Credit Card' as ExpensePaymentMethod,
    paid_by: 'DevOps Lead',
    notes: 'Production & staging infrastructure, auto-scaling compute and backup snapshots.',
  },
  {
    label: 'Google Workspace',
    title: 'Google Workspace & Meet (25 Business Licenses)',
    category: 'Software & SaaS' as ExpenseCategory,
    amount: '22500',
    vendor: 'Google Cloud India',
    payment_method: 'Corporate Credit Card' as ExpensePaymentMethod,
    paid_by: 'IT Admin',
    notes: 'Corporate email, 2TB Drive per user, Meet enterprise recording licenses.',
  },
  {
    label: 'WeWork Office Rent',
    title: 'WeWork Dedicated 20-Seat Office Space',
    category: 'Office & Rent' as ExpenseCategory,
    amount: '145000',
    vendor: 'WeWork India Management',
    payment_method: 'Bank Transfer / NEFT' as ExpensePaymentMethod,
    paid_by: 'CEO Office',
    notes: 'Monthly corporate tech office rent, 1Gbps dedicated leased line, meeting room credits.',
  },
  {
    label: 'Freelance Developer',
    title: 'Freelance Lead React Native Mobile Architect',
    category: 'Salaries & Freelancers' as ExpenseCategory,
    amount: '60000',
    vendor: 'Upwork Contractor',
    payment_method: 'Bank Transfer / NEFT' as ExpensePaymentMethod,
    paid_by: 'Engineering Lead',
    notes: 'Sprint 4 mobile UI architecture and native bridge integration for client delivery.',
  },
  {
    label: 'Legal & GST Audit',
    title: 'Corporate Legal & GST Quarterly Audit Retainer',
    category: 'Legal & Accounting' as ExpenseCategory,
    amount: '35000',
    vendor: 'Singhania & Partners LLP',
    payment_method: 'Bank Transfer / NEFT' as ExpensePaymentMethod,
    paid_by: 'Finance Operations',
    notes: 'Quarterly compliance filing, client contract reviews, and statutory tax filing.',
  },
  {
    label: 'Client Dinner / Meeting',
    title: 'Client Dinner & Strategy Meeting',
    category: 'Travel & Meals' as ExpenseCategory,
    amount: '8200',
    vendor: 'Corporate Credit Card / Marriott',
    payment_method: 'Corporate Credit Card' as ExpensePaymentMethod,
    paid_by: 'Business Development',
    notes: 'Contract extension dinner and roadmap discussion with client executive team.',
  },
];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ users = [], onNavigate }) => {
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [viewTab, setViewTab] = useState<'ALL' | 'PENDING' | 'OVERHEAD' | 'PROJECT_LINKED'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete State
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, projRes] = await Promise.all([
        apiFetch<{ expenses: Expense[]; summary: ExpenseSummary }>('/expenses'),
        apiFetch<{ projects: Project[] }>('/projects'),
      ]);

      if (expRes?.expenses) {
        setExpenses(expRes.expenses);
        setSummary(expRes.summary);
      }
      if (projRes?.projects) {
        setProjects(projRes.projects);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch company expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Tab switcher
      if (viewTab === 'PENDING' && e.status !== 'Pending') return false;
      if (viewTab === 'OVERHEAD' && Boolean(e.project_id)) return false;
      if (viewTab === 'PROJECT_LINKED' && !e.project_id) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;

      // Project filter
      if (projectFilter === 'OVERHEAD' && Boolean(e.project_id)) return false;
      if (projectFilter !== 'ALL' && projectFilter !== 'OVERHEAD' && e.project_id !== projectFilter) {
        return false;
      }

      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = e.title?.toLowerCase().includes(q);
        const matchVendor = e.vendor?.toLowerCase().includes(q);
        const matchInvoice = e.invoice_number?.toLowerCase().includes(q);
        const matchNotes = e.notes?.toLowerCase().includes(q);
        const matchPaidBy = e.paid_by?.toLowerCase().includes(q);
        const matchProject = e.project?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchVendor && !matchInvoice && !matchNotes && !matchPaidBy && !matchProject) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, viewTab, categoryFilter, statusFilter, projectFilter, search]);

  // Paginated list
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  // Dynamic Metrics based on all loaded expenses
  const metrics = useMemo(() => {
    if (summary) return summary;
    let total_expenses = 0;
    let total_paid = 0;
    let total_pending = 0;
    let total_scheduled = 0;
    let overhead_total = 0;
    let project_linked_total = 0;
    const category_breakdown: Record<string, number> = {};

    for (const e of expenses) {
      const amt = Number(e.amount || 0);
      total_expenses += amt;
      if (e.status === 'Paid') total_paid += amt;
      else if (e.status === 'Pending') total_pending += amt;
      else if (e.status === 'Scheduled') total_scheduled += amt;

      if (!e.project_id) overhead_total += amt;
      else project_linked_total += amt;

      const cat = e.category || 'Miscellaneous';
      category_breakdown[cat] = (category_breakdown[cat] || 0) + amt;
    }

    return {
      total_expenses,
      total_paid,
      total_pending,
      total_scheduled,
      overhead_total,
      project_linked_total,
      category_breakdown,
      top_category: null,
    };
  }, [summary, expenses]);

  const openAddModal = () => {
    setEditingExpense(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount),
      currency: exp.currency || 'INR',
      expense_date: toInputDate(exp.expense_date),
      status: exp.status,
      payment_method: exp.payment_method,
      vendor: exp.vendor || '',
      invoice_number: exp.invoice_number || '',
      receipt_url: exp.receipt_url || '',
      project_id: exp.project_id || '',
      paid_by: exp.paid_by || '',
      notes: exp.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const applyPreset = (preset: typeof COMMON_EXPENSE_PRESETS[0]) => {
    setForm((prev) => ({
      ...prev,
      title: preset.title,
      category: preset.category,
      amount: preset.amount,
      vendor: preset.vendor,
      payment_method: preset.payment_method,
      paid_by: preset.paid_by,
      notes: preset.notes,
    }));
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amt = Number(form.amount);
    if (isNaN(amt) || amt < 0) {
      setFormError('Please enter a valid expense amount');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        amount: amt,
        currency: form.currency || 'INR',
        expense_date: form.expense_date,
        status: form.status,
        payment_method: form.payment_method,
        vendor: form.vendor.trim(),
        invoice_number: form.invoice_number.trim(),
        receipt_url: form.receipt_url.trim(),
        project_id: form.project_id || null,
        paid_by: form.paid_by.trim(),
        notes: form.notes.trim(),
      };

      if (editingExpense) {
        const res = await apiFetch<{ expense: Expense }>(`/expenses/${editingExpense.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Expense updated successfully!');
        setExpenses((prev) => prev.map((item) => (item.id === res.expense.id ? res.expense : item)));
      } else {
        const res = await apiFetch<{ expense: Expense }>('/expenses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Expense recorded successfully!');
        setExpenses((prev) => [res.expense, ...prev]);
      }

      setModalOpen(false);
      fetchData(); // refresh full summaries
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickMarkPaid = async (exp: Expense) => {
    try {
      const res = await apiFetch<{ expense: Expense }>(`/expenses/${exp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Paid' }),
      });
      showToast(`Marked "${exp.title}" as Paid!`);
      setExpenses((prev) => prev.map((item) => (item.id === res.expense.id ? res.expense : item)));
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update expense status', 'error');
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/expenses/${deletingExpense.id}`, { method: 'DELETE' });
      showToast(`Deleted expense "${deletingExpense.title}"`);
      setExpenses((prev) => prev.filter((item) => item.id !== deletingExpense.id));
      setDeletingExpense(null);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete expense', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredExpenses.map((e) => ({
      Title: e.title,
      Category: e.category,
      Amount: e.amount,
      Currency: e.currency,
      Status: e.status,
      Expense_Date: formatDate(e.expense_date),
      Vendor: e.vendor || '',
      Invoice_Number: e.invoice_number || '',
      Payment_Method: e.payment_method,
      Project: e.project?.name || 'Company Overhead',
      Paid_By: e.paid_by || '',
      Notes: e.notes || '',
    }));
    exportToCsv(`company_expenses_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Company Expenses &amp; Operational Spend
              </h2>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredExpenses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* 5 Vital Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Expenses
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(metrics.total_expenses, 'INR')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Across {expenses.length} corporate expenditures
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>Settled / Paid</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {formatCurrency(metrics.total_paid, 'INR')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {metrics.total_expenses > 0
              ? `${Math.round((metrics.total_paid / metrics.total_expenses) * 100)}% of total spend`
              : 'Cleared'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span>Action Due / Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {formatCurrency(metrics.total_pending, 'INR')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Pending invoice approvals
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Company Overhead
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(metrics.overhead_total, 'INR')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Office, Legal, SaaS, Tools
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Project Linked
          </div>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">
            {formatCurrency(metrics.project_linked_total, 'INR')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Direct client delivery costs
          </div>
        </div>
      </div>

      {/* Interactive Category Breakdown Banner */}
      {metrics.category_breakdown && Object.keys(metrics.category_breakdown).length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Expenditure Breakdown by Cost Center
            </span>
            <span className="text-[11px] text-slate-400">Click a category to filter</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {EXPENSE_CATEGORIES.map((cat) => {
              const amount = metrics.category_breakdown[cat] || 0;
              if (amount === 0) return null;
              const isSelected = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(isSelected ? 'ALL' : cat);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`font-bold ${isSelected ? 'text-indigo-100' : 'text-slate-900 dark:text-slate-100'}`}>
                    {formatCurrency(amount, 'INR')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => {
            setViewTab('ALL');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            viewTab === 'ALL'
              ? 'bg-[#0F2547] text-white dark:bg-rose-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Expenses ({expenses.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setViewTab('PENDING');
            setCurrentPage(1);
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            viewTab === 'PENDING'
              ? 'bg-[#0F2547] text-white dark:bg-rose-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3 h-3 text-amber-500" />
          Pending Approval ({expenses.filter((e) => e.status === 'Pending').length})
        </button>

        <button
          type="button"
          onClick={() => {
            setViewTab('OVERHEAD');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            viewTab === 'OVERHEAD'
              ? 'bg-[#0F2547] text-white dark:bg-rose-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Company Overhead ({expenses.filter((e) => !e.project_id).length})
        </button>

        <button
          type="button"
          onClick={() => {
            setViewTab('PROJECT_LINKED');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            viewTab === 'PROJECT_LINKED'
              ? 'bg-[#0F2547] text-white dark:bg-rose-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Project Linked ({expenses.filter((e) => Boolean(e.project_id)).length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by title, vendor, invoice #, or notes..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Statuses</option>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Scopes (Overhead &amp; Projects)</option>
            <option value="OVERHEAD">Company Overhead Only</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            Loading company expenditures...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses found"
            description="Record a new company expense or reset your current filters."
            actionLabel="Record Expense"
            onAction={openAddModal}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Title &amp; Vendor</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Project / Scope</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Payment Method</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                  {paginatedExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                          {exp.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {exp.vendor && (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {exp.vendor}
                            </span>
                          )}
                          {exp.invoice_number && (
                            <>
                              <span>&bull;</span>
                              <span className="font-mono text-slate-500">#{exp.invoice_number}</span>
                            </>
                          )}
                          {exp.paid_by && (
                            <>
                              <span>&bull;</span>
                              <span className="text-slate-400">{exp.paid_by}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getExpenseCategoryBadge(
                            exp.category
                          )}`}
                        >
                          {exp.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {exp.project ? (
                          <button
                            type="button"
                            onClick={() => onNavigate?.('projects', exp.project?.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            title="View project details"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[140px]">{exp.project.name}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Company Overhead
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(exp.expense_date)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exp.payment_method}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getExpenseStatusBadge(
                            exp.status
                          )}`}
                        >
                          {exp.status === 'Paid' && <CheckCircle2 className="w-3 h-3" />}
                          {exp.status === 'Pending' && <Clock className="w-3 h-3" />}
                          {exp.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(exp.amount, exp.currency || 'INR')}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {exp.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => handleQuickMarkPaid(exp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                              title="Mark invoice as Paid"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingExpense(exp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete Expense"
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
              totalItems={filteredExpenses.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Record Company Expense'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* Quick Preset Chips for Faster Entry */}
          {!editingExpense && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Quick Autofill Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_EXPENSE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expense Title / Description *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. AWS Cloud Compute & Database Hosting"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                min={0}
                step={50}
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 45000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ExpenseStatus })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              >
                {EXPENSE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vendor / Payee
              </label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Amazon Web Services, WeWork, Contractor"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={form.payment_method}
                onChange={(e) =>
                  setForm({ ...form, payment_method: e.target.value as ExpensePaymentMethod })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice / Bill #
              </label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="e.g. INV-2026-9812"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Linked Project (Optional)
              </label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">None (Company Operational Overhead)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Paid By / Incurred By
              </label>
              <input
                type="text"
                value={form.paid_by}
                onChange={(e) => setForm({ ...form, paid_by: e.target.value })}
                placeholder="e.g. Finance Operations, Rohan"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deliverables &amp; Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Scope details, items purchased, cloud compute configuration, approval notes..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              {submitting ? 'Saving...' : editingExpense ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDeleteExpense}
        loading={deletingLoading}
        title="Delete Expense Record"
        description={`Are you sure you want to delete "${deletingExpense?.title}" (${formatCurrency(
          deletingExpense?.amount || 0,
          deletingExpense?.currency || 'INR'
        )})?`}
        confirmLabel="Delete Expense"
      />
    </div>
  );
};
