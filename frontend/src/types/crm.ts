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
  author?: { id: string; name: string; email?: string } | null;
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

export type NavTab =
  | 'dashboard'
  | 'leads'
  | 'conversions'
  | 'proposals'
  | 'clients'
  | 'projects'
  | 'revenue'
  | 'timeline'
  | 'resources'
  | 'feedback'
  | 'bau';


