export type UserRole = 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export type LeadSource =
  | 'Website'
  | 'Referral'
  | 'LinkedIn'
  | 'Cold outreach'
  | 'Event'
  | 'Other';

export type ServiceType =
  | 'AI services'
  | 'Data Engineering'
  | 'Idea to Launch'
  | 'Others';

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Meeting scheduled'
  | 'Proposal sent'
  | 'Negotiation'
  | 'Converted'
  | 'Not converted';

export interface LeadNote {
  id: string;
  lead_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
  author?: { id: string; name: string; email?: string; role?: string } | null;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  service: ServiceType;
  budget: number;
  currency: string;
  status: LeadStatus;
  owner_id: string | null;
  next_followup: string | null;
  followup_resource?: string;
  notes: string;
  created_at: string;
  owner?: User | null;
  conversion?: Conversion | null;
  client?: { id: string; company: string; status: string } | null;
  lead_notes?: LeadNote[];
}

export type ConversionOutcome = 'in_progress' | 'converted' | 'not_converted';

export type NotConvertedReason =
  | 'Budget'
  | 'Went to competitor'
  | 'No response'
  | 'Timing'
  | 'Requirements mismatch'
  | 'Other';

export interface ConversionHistoryItem {
  timestamp: string;
  from_outcome: string | null;
  to_outcome: string;
  deal_value?: number | null;
  currency?: string;
  reason?: string | null;
  comment?: string | null;
  changed_by?: string;
  note?: string;
}

export interface Conversion {
  id: string;
  lead_id: string;
  outcome: ConversionOutcome;
  reason: string | null;
  comment: string | null;
  deal_value: number | null;
  currency: string;
  decided_at: string | null;
  history: string;
  created_at: string;
  lead: Lead;
}

export interface ConversionSummary {
  total: number;
  converted: number;
  not_converted: number;
  in_progress: number;
  conversion_rate: number;
}

export type ClientStatus = 'Active' | 'On hold' | 'Completed' | 'Inactive';

export interface ClientNote {
  id: string;
  client_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
  author?: { id: string; name: string } | null;
}

export interface Client {
  id: string;
  lead_id: string | null;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  industry: string;
  status: ClientStatus;
  notes: string;
  became_client_at: string;
  created_at: string;
  lead?: Lead | null;
  projects?: Project[];
  client_notes?: ClientNote[];
}

export type ProjectStatus =
  | 'Planned'
  | 'In progress'
  | 'On hold'
  | 'Completed'
  | 'Cancelled';

export type ProjectCostCategory =
  | 'Cloud / Infrastructure'
  | 'Resource Allocation'
  | 'Third-Party Vendor / API'
  | 'Software License / SaaS'
  | 'Contractor / Freelancer'
  | 'Other';

export interface ProjectCost {
  id: string;
  project_id: string;
  title: string;
  category: ProjectCostCategory;
  vendor_or_resource: string;
  amount: number;
  incurred_date: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  author?: { id: string; name: string } | null;
}

export type AmcStatus = 'Not Contracted' | 'Active' | 'Pending Renewal' | 'Expired';
export type AmcBillingCycle = 'Annual' | 'Semi-Annual' | 'Quarterly' | 'Monthly';
export type AmcSlaTier = 'Standard 9x5' | '24/7 Mission Critical' | 'Basic Support';

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string;
  service_type: ServiceType;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
  manager_id: string | null;
  tech_stack: string;
  progress: number;
  progress_override: boolean;
  notes: string;
  created_at: string;
  client?: { id: string; company: string; contact_name?: string; status?: string };
  manager?: { id: string; name: string; email?: string } | null;
  timeline_entries?: TimelineEntry[];
  project_costs?: ProjectCost[];
  total_cost?: number;
  vendor_cost?: number;
  resource_cost?: number;
  profit?: number;
  profit_margin_pct?: number;
  amc_active?: boolean;
  amc_status?: AmcStatus;
  amc_amount?: number;
  amc_start_date?: string | null;
  amc_end_date?: string | null;
  amc_billing_cycle?: AmcBillingCycle;
  amc_sla_tier?: AmcSlaTier;
  amc_scope?: string;
  amc_contact?: string;
  amc_days_remaining?: number | null;
  amc_is_expiring_soon?: boolean;
  amc_is_expired?: boolean;
}

export type TimelineType =
  | 'Milestone'
  | 'Task'
  | 'Meeting'
  | 'Delivery'
  | 'Issue'
  | 'Note';

export type TimelineStatus = 'Planned' | 'In progress' | 'Done' | 'Delayed';

export interface TimelineEntry {
  id: string;
  project_id: string;
  title: string;
  description: string;
  type: TimelineType;
  start_date: string;
  end_date: string | null;
  status: TimelineStatus;
  assignee_id: string | null;
  sort_order: number;
  created_at: string;
  project?: {
    id: string;
    name: string;
    progress?: number;
    progress_override?: boolean;
    client?: { id: string; company: string };
  };
  assignee?: { id: string; name: string; email?: string } | null;
}

export interface DashboardData {
  cards: {
    totalLeads: number;
    activeClients: number;
    projectsInProgress: number;
    conversionRate: number;
    totalClients: number;
    totalProjects: number;
    convertedCount: number;
    totalConversions: number;
  };
  followupsDueThisWeek: Lead[];
  projectsEndingSoon: Project[];
  recentTimeline: TimelineEntry[];
  charts: {
    leadsByStatus: Array<{ status: string; count: number; totalBudget: number }>;
    conversionsByMonth: Array<{
      month: string;
      converted: number;
      not_converted: number;
      in_progress: number;
    }>;
  };
}

export type FeedbackSentiment = 'Positive' | 'Neutral' | 'Constructive' | 'Critical';

export type FeedbackCategory =
  | 'Delivery Quality'
  | 'Communication'
  | 'Timeline & Speed'
  | 'Technical Expertise'
  | 'Support & SLA'
  | 'General';

export type FeedbackStatus = 'New' | 'Reviewed' | 'Action in progress' | 'Resolved';

export interface Feedback {
  id: string;
  client_id: string;
  project_id: string | null;
  rating: number;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  comment: string;
  action_taken: string;
  status: FeedbackStatus;
  submitted_by: string;
  feedback_date: string;
  recorded_by: string | null;
  is_testimonial: boolean;
  created_at: string;
  client?: { id: string; company: string; contact_name?: string; industry?: string };
  project?: { id: string; name: string; service_type?: string; status?: string } | null;
  recorder?: { id: string; name: string; email?: string } | null;
}

export interface FeedbackSummary {
  totalCount: number;
  averageRating: number;
  positiveCount: number;
  positivePct: number;
  pendingActionsCount: number;
  testimonialCount: number;
  ratingDistribution: Array<{ star: number; count: number }>;
}

export type BauTicketState = 'New' | 'Work in progress' | 'Pending' | 'Resolved';

export type BauPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type BauCategory =
  | 'Bug / Defect'
  | 'Change Request'
  | 'Performance'
  | 'Access & Security'
  | 'Environment / Infra'
  | 'Data / Reporting';

export interface BauTicket {
  id: string;
  ticket_number: string;
  client_id: string;
  project_id: string;
  title: string;
  description: string;
  category: BauCategory;
  priority: BauPriority;
  state: BauTicketState;
  reported_by: string;
  assignee_id: string | null;
  resolution_notes: string;
  sla_due_date: string | null;
  resolved_at: string | null;
  created_at: string;
  client?: { id: string; company: string; contact_name?: string; status?: string };
  project?: { id: string; name: string; status?: string; service_type?: string };
  assignee?: { id: string; name: string; email?: string } | null;
}

export interface BauSummary {
  total: number;
  newCount: number;
  wipCount: number;
  pendingCount: number;
  resolvedCount: number;
  criticalCount: number;
}

export type ResourceDepartment =
  | 'Engineering'
  | 'Cloud & DevOps'
  | 'AI & Data'
  | 'Design & UX'
  | 'Delivery & QA';

export type ResourceSeniority = 'Principal' | 'Senior' | 'Mid-Level' | 'Junior';

export type ResourceAvailabilityStatus =
  | 'Available'
  | 'Partially Available'
  | 'Fully Booked'
  | 'On Leave';

export type AssignmentStatus = 'Active' | 'Planned' | 'Completed';

export interface ResourceAssignment {
  id: string;
  resource_id: string;
  project_id: string;
  assignment_role: string;
  allocation_pct: number;
  start_date: string;
  end_date: string;
  status: AssignmentStatus;
  notes: string;
  created_at: string;
  project?: {
    id: string;
    name: string;
    status?: string;
    service_type?: string;
    client?: { id: string; company: string };
  } | null;
}

export interface Resource {
  id: string;
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
  created_at: string;
  allocated_pct: number;
  available_pct: number;
  availability_status: ResourceAvailabilityStatus;
  assignments?: ResourceAssignment[];
}

export interface ResourceSummary {
  totalResources: number;
  availableCount: number;
  partiallyAvailableCount: number;
  fullyBookedCount: number;
  onLeaveCount: number;
  avgUtilizationPct: number;
}

export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';

export interface Proposal {
  id: string;
  proposal_number: string;
  lead_id: string | null;
  client_id: string | null;
  company_name: string;
  recipient_name: string;
  recipient_email: string;
  project_title: string;
  service_type: ServiceType;
  budget: number;
  currency: string;
  timeline_weeks: number;
  key_requirements: string;
  email_subject: string;
  email_body: string;
  html_proposal: string;
  ai_model: string;
  status: ProposalStatus;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  lead?: { id: string; name: string; company: string; email?: string; status?: string } | null;
  client?: { id: string; company: string; contact_name?: string; email?: string; status?: string } | null;
  author?: { id: string; name: string; email?: string } | null;
}

export interface ProposalSummary {
  total: number;
  sentCount: number;
  draftCount: number;
  acceptedCount: number;
}

export interface ProjectRevenueItem {
  id: string;
  name: string;
  client_id: string;
  client_company: string;
  service_type: ServiceType;
  status: ProjectStatus;
  source: string;
  start_date: string;
  end_date: string;
  year: number;
  month_index: number;
  month_key: string;
  native_currency: string;
  native_budget: number;
  native_total_cost: number;
  native_profit: number;
  currency: string;
  gross_revenue: number;
  total_cost: number;
  vendor_cost: number;
  resource_cost: number;
  net_profit: number;
  margin_pct: number;
  costs_count: number;
}

export type PaymentStatus =
  | 'Pending'
  | 'Invoiced'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue';

export type PaymentMethod =
  | 'Bank Transfer / NEFT'
  | 'Wire Transfer'
  | 'UPI'
  | 'Cheque'
  | 'Credit Card'
  | 'Other';

export interface ClientPayment {
  id: string;
  client_id: string;
  project_id: string;
  phase_name: string;
  phase_number: number;
  amount: number;
  currency: string;
  percentage: number;
  status: PaymentStatus;
  due_date: string;
  paid_date: string | null;
  paid_amount: number;
  invoice_number: string;
  payment_method: PaymentMethod;
  transaction_ref: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  is_overdue?: boolean;
  client?: { id: string; company: string; contact_name?: string; email?: string } | null;
  project?: { id: string; name: string; budget?: number; currency?: string; status?: string; service_type?: string } | null;
  author?: { id: string; name: string; email?: string } | null;
}

export interface ProjectPaymentGroup {
  project_id: string;
  project_name: string;
  client_id: string;
  client_name: string;
  service_type: string;
  project_status: string;
  project_budget: number;
  currency: string;
  total_phases_amount: number;
  total_collected: number;
  collection_progress_pct: number;
  phases: ClientPayment[];
}

export interface PaymentsSummary {
  total_contract_value: number;
  total_collected: number;
  total_pending: number;
  total_overdue: number;
  collection_rate: number;
  total_phases: number;
  paid_phases: number;
  pending_phases: number;
}

export interface PaymentInvoice {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  client: {
    id?: string;
    company: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    industry?: string;
  };
  project: {
    id?: string;
    name: string;
    service_type?: string;
    budget?: number;
    currency?: string;
  };
  phase: {
    id?: string;
    phase_name: string;
    phase_number: number;
    percentage: number;
    amount: number;
    currency: string;
  };
  subtotal: number;
  tax_rate: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_method: string;
  transaction_ref?: string;
  notes?: string;
  company: {
    name: string;
    tagline?: string;
    address: string;
    gstin?: string;
    pan?: string;
    cin?: string;
    email: string;
    phone: string;
    website: string;
    bank_details?: {
      bank_name: string;
      account_name: string;
      account_number: string;
      ifsc: string;
      branch: string;
      upi_id?: string;
    };
  };
}

export type NavTab =
  | 'dashboard'
  | 'leads'
  | 'conversions'
  | 'proposals'
  | 'clients'
  | 'client_payments'
  | 'projects'
  | 'revenue'
  | 'expenses'
  | 'timeline'
  | 'resources'
  | 'feedback'
  | 'bau'
  | 'auto_email'
  | 'reports';

export type ExpenseCategory =
  | 'Cloud & Hosting'
  | 'Software & SaaS'
  | 'Salaries & Freelancers'
  | 'Office & Rent'
  | 'Marketing & Ads'
  | 'Travel & Meals'
  | 'Legal & Accounting'
  | 'Hardware & Assets'
  | 'Miscellaneous';

export type ExpenseStatus = 'Paid' | 'Pending' | 'Scheduled' | 'Cancelled';

export type ExpensePaymentMethod =
  | 'Bank Transfer / NEFT'
  | 'Corporate Credit Card'
  | 'UPI'
  | 'Net Banking'
  | 'Cash'
  | 'Cheque';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expense_date: string;
  status: ExpenseStatus;
  payment_method: ExpensePaymentMethod;
  vendor: string;
  invoice_number: string;
  receipt_url: string;
  project_id: string | null;
  paid_by: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  project?: { id: string; name: string; currency?: string } | null;
  author?: { id: string; name: string } | null;
}

export interface ExpenseSummary {
  total_expenses: number;
  total_paid: number;
  total_pending: number;
  total_scheduled: number;
  overhead_total: number;
  project_linked_total: number;
  category_breakdown: Record<string, number>;
  top_category: { category: string; amount: number } | null;
}

export interface AutoEmailSettings {
  preferred_provider: 'resend' | 'brevo' | 'smtp' | 'simulated';
  active_provider: string;
  resend_api_key?: string;
  brevo_api_key?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  mail_from?: string;
  from_name?: string;
  default_followup_interval_days: number;
  auto_advance_status: boolean;
  auto_log_note: boolean;
  note_author_name: string;
  ai_generator_status?: string;
  smtp_configured?: boolean;
  resend_configured?: boolean;
}

export type FollowupTemplateType =
  | 'proposal_checkin'
  | 'initial_inquiry'
  | 'meeting_reminder'
  | 'gentle_nudge'
  | 'reengagement'
  | 'negotiation_close';

export interface EmailLog {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  status: 'Sent' | 'Simulated' | 'Failed';
  provider: string;
  error_message?: string;
  sent_by: string | null;
  sent_at: string;
}

export interface FollowupDraft {
  subject: string;
  body: string;
  recipient_email: string;
  recipient_name: string;
  company: string;
  lead_status: string;
  suggested_next_followup: string;
}

export interface ResourcePerformanceItem {
  resource_name: string;
  role: string;
  assigned_leads: number;
  converted_leads: number;
  lost_leads: number;
  in_progress_leads: number;
  conversion_rate_pct: number;
  total_deal_value_won: number;
  avg_deal_size: number;
}

export interface ExpenseCategoryReportItem {
  category: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
  share_pct: number;
}

export interface LeadSourceReportItem {
  source: string;
  total_leads: number;
  converted_count: number;
  conversion_rate_pct: number;
  total_value_won: number;
}

export interface ServiceTypeReportItem {
  service_type: string;
  total_leads: number;
  converted_count: number;
  conversion_rate_pct: number;
  total_value_won: number;
}

export interface LostReasonReportItem {
  reason: string;
  count: number;
  pct: number;
}

export interface MonthlyTrendReportItem {
  month_key: string;
  label: string;
  income: number;
  expenses: number;
  net_profit: number;
  leads_converted: number;
}

export interface SupportPriorityItem {
  priority: string;
  total: number;
  resolved: number;
  resolution_rate_pct: number;
  avg_resolution_hours: number;
  avg_resolution_formatted: string;
  sla_target: string;
}

export interface SupportCategoryItem {
  category: string;
  total: number;
  resolved: number;
  avg_resolution_hours: number;
  avg_resolution_formatted: string;
}

export interface SupportAndResolutionReport {
  total_received: number;
  total_resolved: number;
  open_tickets: number;
  in_progress_tickets: number;
  pending_tickets: number;
  resolution_rate_pct: number;
  avg_resolution_time_hours: number;
  avg_resolution_time_formatted: string;
  fastest_resolution_formatted: string;
  longest_resolution_formatted: string;
  sla_adherence_rate_pct: number;
  within_sla_count: number;
  breached_sla_count: number;
  priority_breakdown: SupportPriorityItem[];
  category_breakdown: SupportCategoryItem[];
}

export interface ExecutiveReportData {
  period: string;
  financials: {
    total_income_received: number;
    total_receivables_pending: number;
    total_expenses_made: number;
    total_expenses_pending: number;
    net_profit: number;
    net_margin_pct: number;
    overhead_expenses: number;
    project_linked_expenses: number;
    total_contract_value: number;
  };
  conversions: {
    total_leads_count: number;
    converted_leads_count: number;
    conversion_rate_pct: number;
    lost_leads_count: number;
    in_pipeline_count: number;
    total_deal_value_converted: number;
  };
  resources_leaderboard: ResourcePerformanceItem[];
  expense_categories: ExpenseCategoryReportItem[];
  lead_sources: LeadSourceReportItem[];
  service_types: ServiceTypeReportItem[];
  lost_reasons: LostReasonReportItem[];
  projects_and_amc: {
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    on_hold_projects: number;
    total_contract_value: number;
    amc_active_count: number;
    amc_annual_recurring_revenue: number;
    amc_expiring_soon_count: number;
    amc_tiers: Array<{ tier: string; active_contracts: number; annual_revenue: number }>;
  };
  csat_and_quality: {
    avg_csat_rating: number;
    feedback_count: number;
    sentiment: {
      positive: number;
      constructive: number;
      critical: number;
    };
    bau_tickets: {
      total: number;
      resolved: number;
      resolution_rate_pct: number;
    };
  };
  support_and_resolution: SupportAndResolutionReport;
  monthly_trend: MonthlyTrendReportItem[];
}



