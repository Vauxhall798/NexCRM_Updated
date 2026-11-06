import {
  AssignmentStatus,
  BauCategory,
  BauPriority,
  BauTicketState,
  ClientStatus,
  ConversionOutcome,
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
  FeedbackCategory,
  FeedbackSentiment,
  FeedbackStatus,
  LeadSource,
  LeadStatus,
  NotConvertedReason,
  PaymentMethod,
  PaymentStatus,
  ProjectStatus,
  ResourceAvailabilityStatus,
  ResourceDepartment,
  ResourceSeniority,
  ServiceType,
  TimelineStatus,
  TimelineType,
} from '../types/crm';

export const LEAD_SOURCES: LeadSource[] = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold outreach',
  'Event',
  'Other',
];

export const SERVICE_TYPES: ServiceType[] = [
  'AI services',
  'Data Engineering',
  'Idea to Launch',
  'Others',
];

export const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Meeting scheduled',
  'Proposal sent',
  'Negotiation',
  'Converted',
  'Not converted',
];

export const NOT_CONVERTED_REASONS: NotConvertedReason[] = [
  'Budget',
  'Went to competitor',
  'No response',
  'Timing',
  'Requirements mismatch',
  'Other',
];

export const CLIENT_STATUSES: ClientStatus[] = [
  'Active',
  'On hold',
  'Completed',
  'Inactive',
];

export const PROJECT_STATUSES: ProjectStatus[] = [
  'Planned',
  'In progress',
  'On hold',
  'Completed',
  'Cancelled',
];

export const TIMELINE_TYPES: TimelineType[] = [
  'Milestone',
  'Task',
  'Meeting',
  'Delivery',
  'Issue',
  'Note',
];

export const TIMELINE_STATUSES: TimelineStatus[] = [
  'Planned',
  'In progress',
  'Done',
  'Delayed',
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending',
  'Invoiced',
  'Partially Paid',
  'Paid',
  'Overdue',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Bank Transfer / NEFT',
  'Wire Transfer',
  'UPI',
  'Cheque',
  'Credit Card',
  'Other',
];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD'];

export function formatCurrency(amount: number | null | undefined, currency = 'INR'): string {
  const val = Number(amount || 0);
  const curr = !currency || currency === 'USD' ? 'INR' : currency;
  const locale = curr === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(val);
  } catch {
    return `₹${val.toLocaleString('en-IN')}`;
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function isFollowupOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target < today;
}

export function exportToCsv(filename: string, rows: Array<Record<string, unknown>>): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const raw = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          const escaped = raw.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getLeadStatusBadge(status: string): string {
  switch (status) {
    case 'New':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    case 'Contacted':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Meeting scheduled':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    case 'Proposal sent':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Negotiation':
      return 'bg-[#EEF8FA] text-[#0F2547] border-[#B0E0EC] dark:bg-cyan-950/60 dark:text-[#7BC8DC] dark:border-cyan-800';
    case 'Converted':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Not converted':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getConversionBadge(outcome: ConversionOutcome | string): string {
  switch (outcome) {
    case 'converted':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'not_converted':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    case 'in_progress':
    case 'negotiation':
    default:
      return 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800';
  }
}

export function getClientStatusBadge(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'On hold':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Completed':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

export function getPaymentStatusBadge(status: string): string {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Invoiced':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'Partially Paid':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Overdue':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-semibold';
    case 'Pending':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getProjectStatusBadge(status: string): string {
  switch (status) {
    case 'In progress':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Planned':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'On hold':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getTimelineStatusBadge(status: string): string {
  switch (status) {
    case 'Done':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'In progress':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Delayed':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getTimelineTypeBadge(type: string): string {
  switch (type) {
    case 'Milestone':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    case 'Delivery':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Issue':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    case 'Meeting':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Note':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    default:
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
  }
}

export const FEEDBACK_SENTIMENTS: FeedbackSentiment[] = [
  'Positive',
  'Constructive',
  'Neutral',
  'Critical',
];

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'Delivery Quality',
  'Technical Expertise',
  'Communication',
  'Timeline & Speed',
  'Support & SLA',
  'General',
];

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  'New',
  'Reviewed',
  'Action in progress',
  'Resolved',
];

export function getFeedbackSentimentBadge(sentiment: string): string {
  switch (sentiment) {
    case 'Positive':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Constructive':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Critical':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getFeedbackStatusBadge(status: string): string {
  switch (status) {
    case 'Resolved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Action in progress':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Reviewed':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
  }
}

export const BAU_STATES: BauTicketState[] = [
  'New',
  'Work in progress',
  'Pending',
  'Resolved',
];

export const BAU_PRIORITIES: BauPriority[] = [
  'Critical',
  'High',
  'Medium',
  'Low',
];

export const BAU_CATEGORIES: BauCategory[] = [
  'Bug / Defect',
  'Change Request',
  'Performance',
  'Access & Security',
  'Environment / Infra',
  'Data / Reporting',
];

export function getBauStateBadge(state: string): string {
  switch (state) {
    case 'New':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    case 'Work in progress':
      return 'bg-[#EEF8FA] text-[#0F2547] border-[#B0E0EC] dark:bg-cyan-950/60 dark:text-[#7BC8DC] dark:border-cyan-800';
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Resolved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getBauPriorityBadge(priority: string): string {
  switch (priority) {
    case 'Critical':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    case 'High':
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800';
    case 'Medium':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

export const RESOURCE_DEPARTMENTS: ResourceDepartment[] = [
  'Executive Leadership',
  'Engineering',
  'Cloud & DevOps',
  'AI & Data',
  'Design & UX',
  'Delivery & QA',
];

export const RESOURCE_SENIORITIES: ResourceSeniority[] = [
  'Executive',
  'Principal',
  'Senior',
  'Mid-Level',
  'Junior',
];

export const RESOURCE_AVAILABILITY_STATUSES: ResourceAvailabilityStatus[] = [
  'Available',
  'Partially Available',
  'Fully Booked',
  'On Leave',
];

export const ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  'Active',
  'Planned',
  'Completed',
];

export function getResourceAvailabilityBadge(status: string): string {
  switch (status) {
    case 'Available':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Partially Available':
      return 'bg-[#EEF8FA] text-[#0F2547] border-[#B0E0EC] dark:bg-cyan-950/60 dark:text-[#7BC8DC] dark:border-cyan-800';
    case 'Fully Booked':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'On Leave':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Cloud & Hosting',
  'Software & SaaS',
  'Salaries & Freelancers',
  'Office & Rent',
  'Marketing & Ads',
  'Travel & Meals',
  'Legal & Accounting',
  'Hardware & Assets',
  'Miscellaneous',
];

export const EXPENSE_STATUSES: ExpenseStatus[] = [
  'Paid',
  'Pending',
  'Scheduled',
  'Cancelled',
];

export const EXPENSE_PAYMENT_METHODS: ExpensePaymentMethod[] = [
  'Bank Transfer / NEFT',
  'Corporate Credit Card',
  'UPI',
  'Net Banking',
  'Cash',
  'Cheque',
];

export function getExpenseStatusBadge(status: string): string {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Scheduled':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'Cancelled':
      return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getExpenseCategoryBadge(cat: string): string {
  switch (cat) {
    case 'Cloud & Hosting':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Software & SaaS':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    case 'Salaries & Freelancers':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    case 'Office & Rent':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Marketing & Ads':
      return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800';
    case 'Travel & Meals':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Legal & Accounting':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    case 'Hardware & Assets':
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}




