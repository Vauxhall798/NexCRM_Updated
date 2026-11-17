import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Send,
  Save,
  Code2,
  Eye,
  Mail,
  Copy,
  Download,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
  RefreshCw,
  Building2,
  UserCheck,
  Wand2,
  Maximize2,
  ClipboardList,
  Layers,
  Cpu,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Client,
  Lead,
  NavTab,
  Proposal,
  ProposalStatus,
  ProposalSummary,
  ServiceType,
} from '../types/crm';
import { CURRENCIES, formatCurrency, formatDateTime, SERVICE_TYPES } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';

interface ProposalsPageProps {
  onNavigate?: (tab: NavTab, contextId?: string) => void;
}

export interface DiscoveryAnswers {
  industry_and_model: string;
  pain_points_bottlenecks: string;
  target_personas: string;
  core_modules_portals: string;
  user_journey_workflow: string;
  approvals_governance: string;
  ai_automation_needs: string;
  integrations_ecosystem: string;
  data_migration_volume: string;
  security_compliance_cloud: string;
  success_metrics_roi: string;
  rollout_sla_amc: string;
}

type DiscoveryCategoryKey = 'business' | 'functional' | 'ai_data' | 'architecture';

interface DiscoveryQuestionConfig {
  key: keyof DiscoveryAnswers;
  number: string;
  category: DiscoveryCategoryKey;
  question: string;
  subtext: string;
  placeholder: string;
  chips: string[];
}

const DISCOVERY_QUESTIONS: DiscoveryQuestionConfig[] = [
  // Pillar 1: Business Context & Pain Points
  {
    key: 'industry_and_model',
    number: 'Q1',
    category: 'business',
    question: 'What is the client’s industry vertical, core business model, and operational scale?',
    subtext: 'Helps the AI calibrate domain terminology, regulatory posture, and transaction complexity.',
    placeholder: 'e.g., Multi-specialty Healthcare network operating 12 clinics with 1,500+ daily patient consultations and telehealth services...',
    chips: [
      'Multi-clinic Healthcare & Telemedicine',
      'B2B Enterprise SaaS & Operations',
      'FinTech, Lending & Payment Processing',
      'Omni-channel Retail & E-Commerce Marketplace',
      'Supply Chain, 3PL & Fleet Logistics',
      'Creative Agency & Vendor Procurement Network',
    ],
  },
  {
    key: 'pain_points_bottlenecks',
    number: 'Q2',
    category: 'business',
    question: 'What critical bottlenecks, manual workflows, or legacy silos are broken today?',
    subtext: 'Directly feeds the "What We Heard" diagnostic matrix and before/after workflow comparisons.',
    placeholder: 'e.g., Patient intake relies on paper forms and phone queues; 22% appointment no-show rate; doctors spend 20 mins per visit typing notes into disconnected EHRs...',
    chips: [
      'Fragmented multi-tab Excel spreadsheets',
      'Manual data re-entry across disconnected tools',
      'No real-time visibility into stage status or margins',
      'Slow manual email approvals causing bottlenecks',
      'High error rates in invoice & PO reconciliation',
      'Unstructured customer intake & delayed follow-ups',
    ],
  },
  {
    key: 'target_personas',
    number: 'Q3',
    category: 'business',
    question: 'Who are the primary user personas (internal teams & external stakeholders) and their daily actions?',
    subtext: 'Defines role-specific workspaces, self-service portals, and permission boundaries.',
    placeholder: 'e.g., 1) Patients (self-triage & booking), 2) Triage Nurses (queue prioritization), 3) Physicians (SOAP notes & e-Rx), 4) Clinic Admins (billing & analytics)...',
    chips: [
      'C-Suite & Executive Leadership (KPI Dashboards)',
      'Operations & Project Managers (Workflow Orchestration)',
      'Finance & Accounts Team (POs, Invoices & Margins)',
      'External Clients / Customers (Self-Service Portal)',
      'Vendors / Partners / Freelancers (Onboarding & Bidding)',
      'Field Agents / Clinical Staff (Mobile-First Execution)',
    ],
  },
  // Pillar 2: Functional Scope, Core Modules & Workflows
  {
    key: 'core_modules_portals',
    number: 'Q4',
    category: 'functional',
    question: 'What must-have core modules, dashboards, and external portals need to be built?',
    subtext: 'Structures the 10-module functional architecture and deliverable breakdown.',
    placeholder: 'e.g., Patient Mobile/Web Portal, AI Symptom Triage Engine, Multi-Doctor Smart Scheduler, Telehealth Video Studio, Digital Rx Generator, and Revenue Analytics Hub...',
    chips: [
      'Responsive Web App + Mobile-Optimized Portal',
      'Self-Service External Client / Vendor Portal',
      'Interactive Kanban & Milestone Command Center',
      'Automated RFQ, Quote Comparison & PO Builder',
      'Real-Time Financial & Margin Ledger',
      'Document Vault with E-Signature Routing',
    ],
  },
  {
    key: 'user_journey_workflow',
    number: 'Q5',
    category: 'functional',
    question: 'What is the end-to-end step-by-step lifecycle of a core transaction from trigger to closure?',
    subtext: 'Populates the 8-step End-to-End Delivery Flow and automated state transitions.',
    placeholder: 'e.g., 1) Patient describes symptoms -> 2) AI classifies urgency -> 3) Smart slot booking -> 4) Pre-visit insurance check -> 5) Consultation & AI SOAP note -> 6) E-Prescription & WhatsApp follow-up...',
    chips: [
      'Self-Onboarding -> AI Verification -> NDA E-Sign',
      'Brief Intake -> AI Matching -> RFQ Dispatch -> Quote Compare',
      'Order / Booking -> Automated Triage -> Fulfillment -> Invoicing',
      'Milestone Delivery -> Quality Pre-Check -> Invoice vs PO Match',
      'Post-Delivery CSAT Survey -> Sentiment Analysis -> Executive Digest',
    ],
  },
  {
    key: 'approvals_governance',
    number: 'Q6',
    category: 'functional',
    question: 'What multi-stage approvals, business rules, escalations, and audit trails are required?',
    subtext: 'Defines human-in-the-loop checkpoints, SLA timers, and governance controls.',
    placeholder: 'e.g., Dual sign-off for POs > ₹2,00,000; mandatory physician sign-off on AI-drafted clinical notes; automated escalation if SLA breaches 4 hours...',
    chips: [
      'Multi-tier budget & PO approval matrix',
      'Human-in-the-loop sign-off on all AI recommendations',
      'Automated SLA breach escalation to department heads',
      'Immutable audit log of every status & document change',
      'Role-based field masking for sensitive financial data',
    ],
  },
  // Pillar 3: AI Intelligence, Data & Ecosystem Integrations
  {
    key: 'ai_automation_needs',
    number: 'Q7',
    category: 'ai_data',
    question: 'Which specific AI, LLM, RAG, or autonomous automation capabilities should be embedded?',
    subtext: 'Drives the 14 AI Capabilities and 14 Automated Workflows sections in the proposal.',
    placeholder: 'e.g., Conversational symptom triage agent, Whisper medical speech-to-SOAP notes, OCR prescription scanner, drug-interaction sentinel, and no-show risk predictor...',
    chips: [
      'RAG Enterprise Knowledge Search ("Ask AI" Copilot)',
      'Intelligent Document / PDF / Invoice OCR Parser',
      'AI Brief Reader & Top-3 Partner/Resource Matchmaker',
      'Conversational Intake & Triage Assistant (Web + WhatsApp)',
      'Automated Quote Comparison & Rate-Card Outlier Detection',
      'Automated Weekly Executive Summary & Anomaly Alerts',
    ],
  },
  {
    key: 'integrations_ecosystem',
    number: 'Q8',
    category: 'ai_data',
    question: 'Which existing third-party softwares, ERPs, CRMs, or gateways must integrate bidirectionally?',
    subtext: 'Populates the System Integrations table with API design patterns and fallback strategies.',
    placeholder: 'e.g., HL7/FHIR EHR sync (Epic/Practo), WhatsApp Business Cloud API, Razorpay payment gateway, Google Calendar, and Zoho Books...',
    chips: [
      'CRM (Salesforce / HubSpot / Folk / Zoho)',
      'Project Management (ClickUp / Jira / Asana)',
      'Finance & ERP (SAP / Tally / Zoho Books / Focus)',
      'Messaging (WhatsApp Business API / Slack / Resend Email)',
      'Payments & E-Sign (Razorpay / Stripe / DocuSign / Zoho Sign)',
      'Data & Healthcare (Snowflake / Kafka / HL7 FHIR EHR)',
    ],
  },
  {
    key: 'data_migration_volume',
    number: 'Q9',
    category: 'ai_data',
    question: 'What legacy data sources must be migrated/cleaned, and what is the expected transaction volume?',
    subtext: 'Shapes Phase 0/Phase 1 data engineering, deduplication, and schema design.',
    placeholder: 'e.g., Migrate 50,000+ patient records from legacy SQL + Excel sheets, deduplicate phone/email identifiers, and index 120,000 PDF lab reports...',
    chips: [
      'Clean & migrate multi-tab Excel / Google Sheets master data',
      'AI-assisted deduplication & schema mapping during import',
      'Ingest & vector-index historical PDFs, contracts & briefs',
      'High-throughput real-time event streaming (10k+ events/day)',
      'Automated quarterly web/profile enrichment of master records',
    ],
  },
  // Pillar 4: Architecture, Security, Compliance & Commercial ROI
  {
    key: 'security_compliance_cloud',
    number: 'Q10',
    category: 'architecture',
    question: 'What cloud hosting, security posture, data ownership, and compliance standards are mandatory?',
    subtext: 'Configures the Security, Governance, Cloud Architecture, and 100% IP Ownership clauses.',
    placeholder: 'e.g., AWS Mumbai region (ap-south-1) deployment, HIPAA & India DPDP Act compliance, AES-256 encryption at rest, SSO/2FA, and 100% client IP ownership...',
    chips: [
      '100% Client Ownership of Source Code, Data & Cloud Keys',
      'AWS / GCP India Region (ap-south-1) Data Residency',
      'Strict RBAC, SSO (Google/Microsoft) & Two-Factor Auth',
      'HIPAA / SOC2 / ISO 27001 / India DPDP Act Compliance',
      'Zero LLM Training on Private Client Data (Enterprise APIs)',
    ],
  },
  {
    key: 'success_metrics_roi',
    number: 'Q11',
    category: 'architecture',
    question: 'What measurable KPIs, turnaround improvements, or financial ROI define success post-launch?',
    subtext: 'Highlights executive business impact in the Hero summary and cover email.',
    placeholder: 'e.g., Reduce patient wait times by 60%, cut appointment no-shows by 40%, save 15 hours/week per doctor on clinical documentation, and achieve 99.9% uptime...',
    chips: [
      '70% faster turnaround from intake to approval',
      'Eliminate 90% of manual spreadsheet data entry',
      '100% real-time visibility across pipeline & margins',
      'Reduce operational leakage & billing errors by 50%',
      'First live operational value delivered by Week 4–5',
    ],
  },
  {
    key: 'rollout_sla_amc',
    number: 'Q12',
    category: 'architecture',
    question: 'What is the preferred phased rollout plan, go-live warranty, and post-launch AMC support tier?',
    subtext: 'Structures the 4-Phase Delivery Roadmap, 30-day hypercare warranty, and monthly running cost.',
    placeholder: 'e.g., 4 signed-off milestones over 10 weeks; 30-day free post-launch warranty; Priority 12x6 AMC support at ₹15,000/month with 4-hour critical response SLA...',
    chips: [
      '4 Signed-Off Phases (Foundation -> Core -> AI -> Go-Live)',
      '30-Day Free Post-Launch Bug-Fix & Hypercare Warranty',
      'Dedicated Annual Maintenance Contract (AMC) with 24x7 SLA',
      'Staff Training, Admin Runbooks & Recorded Video Walkthroughs',
      'Phase-2 Optional Expansion Roadmap Pre-Architected',
    ],
  },
];

const PROMPT_PRESETS = [
  {
    label: 'Healthcare AI Patient Portal',
    company: 'CarePulse Health',
    recipient: 'Dr. Ramesh Kumar',
    email: 'dr.ramesh@carepulse.com',
    title: 'AI Patient Care & Clinic Triage Portal',
    service: 'AI services' as ServiceType,
    budget: '950000',
    weeks: '10',
    prompt:
      'Build an AI conversational agent for CarePulse Health for patient symptom triaging, smart doctor appointment booking, and real-time EHR integration.',
    discovery: {
      industry_and_model:
        'Multi-specialty Healthcare network operating 12 outpatient clinics and telehealth consultations (1,500+ patients/day).',
      pain_points_bottlenecks:
        'Paper-based intake forms, congested phone lines, 24% appointment no-show rate, and doctors spending 20+ mins typing manual SOAP notes.',
      target_personas:
        'Patients (mobile symptom intake & booking), Triage Nurses (priority queue), Attending Physicians (AI SOAP notes & e-Rx), and Clinic Admins.',
      core_modules_portals:
        'Patient Web & Mobile Portal, AI Symptom Triage Assistant, Smart Doctor Scheduler, Encrypted Telehealth Studio, Digital Rx Builder, and EHR Bridge.',
      user_journey_workflow:
        'Patient chats with AI Triage -> Urgency scored -> Smart specialty slot booked -> Automated insurance pre-check -> Consultation with AI SOAP scribe -> Digital Rx & WhatsApp follow-up.',
      approvals_governance:
        'Mandatory physician sign-off on all AI-generated SOAP notes and prescriptions; emergency red-flag symptom auto-escalation to on-call nurse.',
      ai_automation_needs:
        'Conversational symptom triaging, medical speech-to-SOAP note summarizer, drug-interaction sentinel, lab outlier highlighter, and no-show predictor.',
      integrations_ecosystem:
        'HL7 / FHIR EHR bidirectional sync, WhatsApp Business Cloud API, Razorpay payment gateway, Google Calendar, and pharmacy dispatch webhook.',
      data_migration_volume:
        'Migrate 65,000+ patient master profiles from legacy SQL database, deduplicate mobile numbers, and index historical PDF lab reports.',
      security_compliance_cloud:
        'AWS Mumbai (ap-south-1) HIPAA-grade cloud hosting, end-to-end AES-256 encryption, role-based access control, and 100% CarePulse IP ownership.',
      success_metrics_roi:
        '65% faster patient check-in, 45% reduction in appointment no-shows, and 2 hours saved per doctor daily on clinical documentation.',
      rollout_sla_amc:
        '10-week delivery across 4 signed-off milestones, 30-day free post-launch warranty, and Priority 24x7 AMC support for critical clinical systems.',
    } as DiscoveryAnswers,
  },
  {
    label: 'Enterprise AI & Operations Hub',
    company: 'Apex Technologies',
    recipient: 'Suresh Menon',
    email: 'suresh@apextech.com',
    title: 'Enterprise AI & Operations Hub',
    service: 'AI services' as ServiceType,
    budget: '1150000',
    weeks: '12',
    prompt:
      'Build an end-to-end AI-powered operations hub for Apex Technologies with automated customer intake, intelligent RAG document search, multi-stage approvals, ERP sync, and executive command center.',
    discovery: {
      industry_and_model:
        'B2B Enterprise Technology & Managed Services organization handling 400+ concurrent enterprise accounts and multi-department delivery.',
      pain_points_bottlenecks:
        'Customer requests arrive via unstructured emails; knowledge sits trapped in 10,000+ PDFs; multi-level approvals stall in inboxes; ERP and CRM are out of sync.',
      target_personas:
        'C-Suite Executives (P&L Command Center), Operations Leads (Workflow Orchestration), Delivery Engineers (RAG Copilot), and Enterprise Clients (Self-Service Portal).',
      core_modules_portals:
        'Omnichannel Customer Intake Portal, Enterprise RAG Knowledge Copilot, Multi-Stage Approval Matrix, Commercial Margin Tracker, and Executive Analytics Hub.',
      user_journey_workflow:
        'Client submits request -> AI extracts scope & SLAs -> Auto-routed for manager approval -> Synced to Jira/ClickUp -> Delivered with AI quality check -> ERP invoice sync.',
      approvals_governance:
        '3-tier budget approval matrix (<₹1L auto, ₹1L–5L Dept Head, >₹5L CFO); full audit trail on every approval and document access.',
      ai_automation_needs:
        'Enterprise RAG semantic search with citations, automated brief-to-scope extractor, SLA breach anomaly detector, and weekly Monday executive digest generator.',
      integrations_ecosystem:
        'Salesforce / HubSpot CRM, Jira & ClickUp task boards, SAP / Zoho Books ERP, Slack & WhatsApp alerts, and Microsoft Entra SSO.',
      data_migration_volume:
        'Ingest and vector-index 15,000+ historical SOPs, contracts, and engineering docs; migrate 5 years of active client & project records.',
      security_compliance_cloud:
        'SOC2 & ISO 27001 compliant AWS architecture, document-level RBAC vector filtering, zero LLM training on corporate data, 100% owned by Apex.',
      success_metrics_roi:
        '75% faster request-to-resolution cycle, 80% reduction in internal knowledge search time, and 100% real-time margin visibility.',
      rollout_sla_amc:
        '12-week phased rollout (4 phases), 30-day hypercare warranty, and dedicated SLA maintenance with quarterly AI model tuning.',
    } as DiscoveryAnswers,
  },
  {
    label: 'Cloud & Data Lakehouse',
    company: 'DataFlow Systems',
    recipient: 'Priya Sharma',
    email: 'priya@dataflow.com',
    title: 'Enterprise Streaming Lakehouse Platform',
    service: 'Data Engineering' as ServiceType,
    budget: '1400000',
    weeks: '12',
    prompt:
      'Architect a unified real-time data streaming pipeline for DataFlow Systems using Kafka, Snowflake data warehouse, dbt transformations, and data quality observability.',
    discovery: {
      industry_and_model:
        'High-growth FinTech & Analytics enterprise processing 25M+ daily transactional events across 18 operational databases and SaaS tools.',
      pain_points_bottlenecks:
        'Fragile nightly batch scripts fail frequently; executive reports are 48 hours stale; schema changes break downstream BI dashboards; skyrocketing cloud compute bills.',
      target_personas:
        'Data Engineers (pipeline orchestration), BI Analysts (curated Gold marts), Finance & Ops Leaders (real-time KPI dashboards), and Data Stewards (governance).',
      core_modules_portals:
        'CDC Streaming Ingestion Engine, Medallion Lakehouse (Bronze/Silver/Gold), Modular dbt Transformation Hub, Data Quality Sentinel, and Cost FinOps Monitor.',
      user_journey_workflow:
        'Source DB transaction -> Debezium/Kafka real-time stream -> Raw Bronze landing -> Automated PII masking & Silver deduplication -> dbt Gold dimensional mart -> Live BI.',
      approvals_governance:
        'Automated CI/CD schema-drift gates; column-level PII masking for non-privileged roles; FinOps query cost quota alerts.',
      ai_automation_needs:
        'Natural language Text-to-SQL analyst copilot, ML-driven data volume & freshness anomaly detection, automated root-cause lineage impact analysis.',
      integrations_ecosystem:
        'PostgreSQL/MySQL production DBs, Apache Kafka, Snowflake / Databricks, dbt Core, Apache Airflow, PowerBI / Tableau, and PagerDuty/Slack.',
      data_migration_volume:
        'Backfill 4.5 TB of historical transactional data (36 months) with zero production downtime and sub-5-second streaming latency.',
      security_compliance_cloud:
        'VPC-isolated cloud deployment, RBAC column-level encryption, SOC2 & GDPR right-to-erasure pipelines, 100% client-owned infrastructure.',
      success_metrics_roi:
        'Reduce data latency from 24 hours to <30 seconds, achieve 99.95% pipeline reliability, and cut warehouse compute spend by 35%.',
      rollout_sla_amc:
        '12-week engineering delivery across 4 milestones, full Terraform IaC handover, 30-day warranty, and 24x7 data ops AMC.',
    } as DiscoveryAnswers,
  },
  {
    label: 'Vendor Hub & Procurement Portal',
    company: 'Hotcult',
    recipient: 'Manjari Srivishnu',
    email: 'manjari@hotcult.com',
    title: 'Vendor Hub & Procurement Portal',
    service: 'Idea to Launch' as ServiceType,
    budget: '950000',
    weeks: '12',
    prompt:
      'From discovering and onboarding agencies, consultants, freelancers and influencers to matching them to briefs, comparing quotes, raising POs, approving invoices and collecting feedback — working alongside Folk, ClickUp and Focus.',
    discovery: {
      industry_and_model:
        'Brand Strategy, Creative & Influencer Marketing enterprise managing hundreds of agencies, consultants, freelancers, and creators across campaigns.',
      pain_points_bottlenecks:
        'Vendor repository lives in a multi-tab spreadsheet; shortlisting relies on memory; quotes arrive in inconsistent formats; manual NDA chasing; disconnected PO & invoice tracking.',
      target_personas:
        'Leadership (end-to-end commercial visibility), Strategy & Client Leads (briefing & matching), Finance Team (POs & invoices), and External Vendors (self-service portal).',
      core_modules_portals:
        'Master Vendor Directory, Self-Service Vendor Portal, NDA & Contract E-Sign Hub, AI Brief-to-Vendor Matchmaker, RFQ & Quote Comparator, and PO/Invoice Ledger.',
      user_journey_workflow:
        'Vendor self-onboards & e-signs NDA -> Client brief uploaded -> AI recommends top 3 vendors -> White-labelled RFQs sent -> Quotes normalized -> PO raised -> Invoice checked -> CSAT logged.',
      approvals_governance:
        'Designated signatory routing for NDAs; human approval on AI vendor shortlists; 3-way match between Quote, PO, and GST Invoice before finance payout.',
      ai_automation_needs:
        'Web profile enrichment, AI brief reader, Top-3 intelligent vendor matcher, multi-format quote equalizer, automated PO drafter, and invoice-vs-PO checker.',
      integrations_ecosystem:
        'Folk CRM (clients & pitches), ClickUp (delivery tasks), Focus / Finance system (POs & invoices), Zoho Sign / DocuSign, Resend Email, and WhatsApp.',
      data_migration_volume:
        'Clean, deduplicate, and migrate the entire multi-tab vendor master spreadsheet, historical rate cards, and past portfolio links in Week 1.',
      security_compliance_cloud:
        'Role-based access control (commercial rates hidden from unauthorized roles), encrypted document storage, and 100% Hotcult ownership of code & data.',
      success_metrics_roi:
        'Cut vendor shortlisting & RFQ turnaround from 4 days to 30 minutes, 100% NDA compliance, and zero duplicate or mismatched vendor invoices.',
      rollout_sla_amc:
        '12-week delivery (Quick-start data master in Week 1, first value in Week 5, full go-live Week 12), 30-day warranty, and ₹15,000/mo AMC support.',
    } as DiscoveryAnswers,
  },
];

export const ProposalsPage: React.FC<ProposalsPageProps> = () => {
  const { showToast } = useToast();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<ProposalSummary>({
    total: 0,
    sentCount: 0,
    draftCount: 0,
    acceptedCount: 0,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Proposal ID when editing an existing saved proposal
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

  // User Prompt State (for prompt-driven HTML proposal generation)
  const [userPrompt, setUserPrompt] = useState(
    'Build an AI conversational agent for CarePulse Health for patient symptom triaging, smart doctor appointment booking, and real-time EHR integration.'
  );

  // Generator Form State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [companyName, setCompanyName] = useState('CarePulse Health');
  const [recipientName, setRecipientName] = useState('Dr. Ramesh Kumar');
  const [recipientEmail, setRecipientEmail] = useState('dr.ramesh@carepulse.com');
  const [projectTitle, setProjectTitle] = useState('AI Patient Care & Clinic Triage Portal');
  const [serviceType, setServiceType] = useState<ServiceType>('AI services');
  const [budget, setBudget] = useState('950000');
  const [currency, setCurrency] = useState('INR');
  const [timelineWeeks, setTimelineWeeks] = useState('10');
  const [keyRequirements, setKeyRequirements] = useState(
    'Conversational symptom triaging with urgency classification\nReal-time doctor matching and automated appointment booking\nBidirectional sync with hospital EHR/EMR via HL7 / FHIR APIs\nAutomated medication reminders and post-consultation WhatsApp follow-ups'
  );
  const [tone, setTone] = useState('Executive & Consultative');
  const envArgonApiKey = String(import.meta.env.VITE_GEMINI_ARGON_API_KEY || '').trim();

  // Deep Discovery Questionnaire State (12 intensive questions across 4 architectural pillars)
  const [discoveryOpen, setDiscoveryOpen] = useState(true);
  const [activeDiscoveryCategory, setActiveDiscoveryCategory] = useState<
    DiscoveryCategoryKey | 'all'
  >('business');
  const [discoveryAnswers, setDiscoveryAnswers] = useState<DiscoveryAnswers>(
    PROMPT_PRESETS[0].discovery
  );

  const answeredQuestionCount = Object.values(discoveryAnswers).filter(
    (v) => v && v.trim().length > 0
  ).length;
  const discoveryDepthPct = Math.round((answeredQuestionCount / DISCOVERY_QUESTIONS.length) * 100);

  const handleDiscoveryChange = (key: keyof DiscoveryAnswers, value: string) => {
    setDiscoveryAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleAppendDiscoveryChip = (key: keyof DiscoveryAnswers, chipText: string) => {
    setDiscoveryAnswers((prev) => {
      const current = (prev[key] || '').trim();
      if (current.toLowerCase().includes(chipText.toLowerCase())) {
        return prev;
      }
      const next = current ? `${current}; ${chipText}` : chipText;
      return { ...prev, [key]: next };
    });
  };

  const framePromptFromQuestionnaire = (
    customAnswers?: DiscoveryAnswers,
    silentToast = false
  ): { framedPrompt: string; framedReqs: string } => {
    const ans = customAnswers || discoveryAnswers;
    const comp = companyName.trim() || 'Enterprise Client';
    const title = projectTitle.trim() || `${comp} Digital Platform`;

    const promptSegments: string[] = [
      `Architect and propose "${title}" for ${comp} (${serviceType}, ${currency} ${budget}, ${timelineWeeks} weeks).`,
    ];

    if (ans.industry_and_model.trim()) {
      promptSegments.push(`Industry & Business Context: ${ans.industry_and_model.trim()}`);
    }
    if (ans.pain_points_bottlenecks.trim()) {
      promptSegments.push(`Critical Pain Points & Bottlenecks to Solve: ${ans.pain_points_bottlenecks.trim()}`);
    }
    if (ans.target_personas.trim()) {
      promptSegments.push(`Target User Personas & Roles: ${ans.target_personas.trim()}`);
    }
    if (ans.core_modules_portals.trim()) {
      promptSegments.push(`Must-Have Core Modules & Portals: ${ans.core_modules_portals.trim()}`);
    }
    if (ans.user_journey_workflow.trim()) {
      promptSegments.push(`End-to-End User Workflow: ${ans.user_journey_workflow.trim()}`);
    }
    if (ans.approvals_governance.trim()) {
      promptSegments.push(`Approvals, Governance & SLA Rules: ${ans.approvals_governance.trim()}`);
    }
    if (ans.ai_automation_needs.trim()) {
      promptSegments.push(`Embedded AI, LLM & Automation Capabilities: ${ans.ai_automation_needs.trim()}`);
    }
    if (ans.integrations_ecosystem.trim()) {
      promptSegments.push(`Bidirectional Third-Party Integrations: ${ans.integrations_ecosystem.trim()}`);
    }
    if (ans.data_migration_volume.trim()) {
      promptSegments.push(`Data Migration, Volume & Ingestion: ${ans.data_migration_volume.trim()}`);
    }
    if (ans.security_compliance_cloud.trim()) {
      promptSegments.push(`Cloud Architecture, Security & Compliance: ${ans.security_compliance_cloud.trim()}`);
    }
    if (ans.success_metrics_roi.trim()) {
      promptSegments.push(`Target KPIs & Measurable ROI: ${ans.success_metrics_roi.trim()}`);
    }
    if (ans.rollout_sla_amc.trim()) {
      promptSegments.push(`Phased Rollout, Warranty & Post-Launch AMC: ${ans.rollout_sla_amc.trim()}`);
    }

    const framedPrompt = promptSegments.join('\n');

    const reqLines: string[] = [];
    if (ans.core_modules_portals.trim()) reqLines.push(`Core Modules: ${ans.core_modules_portals.trim()}`);
    if (ans.pain_points_bottlenecks.trim()) reqLines.push(`Solved Bottlenecks: ${ans.pain_points_bottlenecks.trim()}`);
    if (ans.ai_automation_needs.trim()) reqLines.push(`AI & Automation: ${ans.ai_automation_needs.trim()}`);
    if (ans.user_journey_workflow.trim()) reqLines.push(`End-to-End Flow: ${ans.user_journey_workflow.trim()}`);
    if (ans.integrations_ecosystem.trim()) reqLines.push(`Integrations: ${ans.integrations_ecosystem.trim()}`);
    if (ans.approvals_governance.trim()) reqLines.push(`Governance & Approvals: ${ans.approvals_governance.trim()}`);
    if (ans.data_migration_volume.trim()) reqLines.push(`Data & Migration: ${ans.data_migration_volume.trim()}`);
    if (ans.security_compliance_cloud.trim()) reqLines.push(`Security & Cloud: ${ans.security_compliance_cloud.trim()}`);
    if (ans.success_metrics_roi.trim()) reqLines.push(`Target ROI & KPIs: ${ans.success_metrics_roi.trim()}`);
    if (ans.rollout_sla_amc.trim()) reqLines.push(`Rollout & AMC SLA: ${ans.rollout_sla_amc.trim()}`);

    const framedReqs = reqLines.length > 0 ? reqLines.join('\n') : keyRequirements;

    setUserPrompt(framedPrompt);
    setKeyRequirements(framedReqs);

    // Auto-detect service pillar from answers
    const combinedText = `${framedPrompt} ${framedReqs}`.toLowerCase();
    if (/data engineering|kafka|snowflake|lakehouse|etl|elt|dbt/i.test(combinedText)) {
      setServiceType('Data Engineering');
    } else if (/ai|llm|rag|triage|conversational|copilot|ocr/i.test(combinedText)) {
      setServiceType('AI services');
    } else if (/portal|vendor|marketplace|saas|mvp/i.test(combinedText)) {
      setServiceType('Idea to Launch');
    }

    if (!silentToast) {
      showToast(
        `Framed intensive AI prompt from ${answeredQuestionCount}/12 discovery answers (${discoveryDepthPct}% depth)!`,
        'info'
      );
    }

    return { framedPrompt, framedReqs };
  };

  // AI Generated & User-Editable Mail + HTML Proposal State
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [htmlProposal, setHtmlProposal] = useState('');
  const [aiModelUsed, setAiModelUsed] = useState('NexInt AI');
  const [previewTab, setPreviewTab] = useState<'full_mail' | 'html_preview' | 'html_code'>(
    'full_mail'
  );
  const [fullscreenArtifactOpen, setFullscreenArtifactOpen] = useState(false);

  // Action Loading States
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [propRes, clientRes, leadRes] = await Promise.all([
        apiFetch<{ proposals: Proposal[]; summary: ProposalSummary }>('/proposals'),
        apiFetch<{ clients: Client[] }>('/clients'),
        apiFetch<{ leads: Lead[] }>('/leads'),
      ]);
      setProposals(propRes.proposals);
      setSummary(propRes.summary);
      setClients(clientRes.clients);
      setLeads(leadRes.leads);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load proposals data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      const matchedLead =
        (found.lead_id && leads.find((l) => l.id === found.lead_id)) ||
        leads.find(
          (l) =>
            l.email.toLowerCase() === found.email.toLowerCase() ||
            l.company.toLowerCase() === found.company.toLowerCase()
        );
      setSelectedLeadId(matchedLead ? matchedLead.id : found.lead_id || '');
      setCompanyName(found.company);
      setRecipientName(found.contact_name);
      setRecipientEmail(found.email);
      const nextTitle = `${found.company} — Digital Transformation & Engineering Proposal`;
      setProjectTitle(nextTitle);
      if (found.notes) {
        setKeyRequirements(found.notes);
      }
      setUserPrompt(
        `Generate an interactive HTML proposal for ${found.company} (${found.contact_name}) for "${nextTitle}" with interactive tabs, 3-tier pricing selector, roadmap, and executive sign-off.`
      );
    } else {
      setSelectedLeadId('');
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setSelectedClientId('');
    const found = leads.find((l) => l.id === leadId);
    if (found) {
      setCompanyName(found.company);
      setRecipientName(found.name);
      setRecipientEmail(found.email);
      setServiceType(found.service);
      setBudget(String(found.budget || 450000));
      setCurrency(found.currency || 'INR');
      const nextTitle = `${found.company} — ${found.service} Solution Proposal`;
      setProjectTitle(nextTitle);
      if (found.notes) {
        setKeyRequirements(found.notes);
      }
      setUserPrompt(
        `Generate an interactive HTML proposal for ${found.company} (${found.name}) covering ${found.service} with budget ${found.currency || 'INR'} ${found.budget}, interactive tabs, 3-tier pricing options, and milestone schedule.`
      );
    }
  };

  const handlePromptChange = (val: string) => {
    setUserPrompt(val);

    // Auto-detect service pillar
    if (/data engineering|kafka|snowflake|lakehouse|etl|elt|dbt/i.test(val)) {
      setServiceType('Data Engineering');
    } else if (/ai agent|conversational|chatbot|llm|rag|triage|copilot/i.test(val)) {
      setServiceType('AI services');
    } else if (/mvp|launch|web app|mobile app|portal|saas/i.test(val)) {
      setServiceType('Idea to Launch');
    }

    // Auto-extract Company Name if user typed "for <Company>" and haven't selected a saved client
    if (!selectedClientId && !selectedLeadId) {
      const match = val.match(
        /(?:for|client)\s+([A-Z][A-Za-z0-9&.\-'\s]{1,30}?)(?:\s+(?:with|covering|to|in|and|\.|\,|$))/
      );
      if (
        match &&
        match[1] &&
        !/^(?:our|the|an|a|healthcare|operations|data|analytics|cloud|ecommerce|logistics)$/i.test(
          match[1].trim()
        )
      ) {
        const comp = match[1].trim();
        setCompanyName(comp);
        setRecipientEmail(
          `contact@${comp.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}.com`
        );
        setProjectTitle(`${comp} Solution Proposal`);
      }
    }
  };

  const handleGenerateWithArgon = async (
    silent = false,
    customPromptOverride?: string,
    customReqsOverride?: string,
    discoveryAnswersOverride?: DiscoveryAnswers
  ) => {
    const promptToUse = (
      customPromptOverride !== undefined ? customPromptOverride : userPrompt
    ).trim();
    const reqsToUse =
      customReqsOverride !== undefined ? customReqsOverride : keyRequirements;
    const discoveryToUse =
      discoveryAnswersOverride !== undefined ? discoveryAnswersOverride : discoveryAnswers;

    let compToUse = companyName.trim();
    if (!compToUse) {
      const compMatch = promptToUse.match(
        /(?:for|client)\s+([A-Z][A-Za-z0-9&.\-'\s]{1,30}?)(?:\s+(?:with|covering|to|in|and|\.|\,|$))/
      );
      if (
        compMatch &&
        compMatch[1] &&
        !/^(?:our|the|an|a|healthcare|operations|data|analytics|cloud|ecommerce|logistics)$/i.test(
          compMatch[1].trim()
        )
      ) {
        compToUse = compMatch[1].trim();
      } else if (/health|patient|doctor|clinic|triage/i.test(promptToUse)) {
        compToUse = 'CarePulse Health';
      } else if (/data engineering|kafka|snowflake|lakehouse/i.test(promptToUse)) {
        compToUse = 'DataFlow Systems';
      } else {
        compToUse = 'Enterprise Client';
      }
      setCompanyName(compToUse);
    }

    let titleToUse = projectTitle.trim();
    if (!titleToUse || titleToUse === 'Vendor Hub') {
      titleToUse = `${compToUse} Solution Proposal`;
      setProjectTitle(titleToUse);
    }

    setGenerating(true);
    try {
      const res = await apiFetch<{
        email_subject: string;
        email_body: string;
        html_proposal: string;
        ai_model: string;
      }>('/proposals/generate', {
        method: 'POST',
        body: JSON.stringify({
          company_name: compToUse,
          recipient_name: recipientName.trim() || 'Executive Sponsor',
          recipient_email:
            recipientEmail.trim() ||
            `contact@${compToUse.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}.com`,
          project_title: titleToUse,
          service_type: serviceType,
          budget: Number(budget) || 950000,
          currency,
          timeline_weeks: Number(timelineWeeks) || 12,
          key_requirements: reqsToUse,
          user_prompt: promptToUse,
          tone,
          discovery_answers: discoveryToUse,
          api_key: envArgonApiKey || undefined,
        }),
      });

      setEmailSubject(res.email_subject);
      setEmailBody(res.email_body);
      setHtmlProposal(res.html_proposal);
      setAiModelUsed(res.ai_model || 'nexint-ai-proposal');
      if (!silent) {
        showToast('Generated Interactive HTML Proposal & Mail Body from your deep requirements!');
      }
    } catch (err) {
      if (!silent) {
        showToast(
          err instanceof Error ? err.message : 'Failed to generate proposal with AI',
          'error'
        );
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleFrameAndGenerate = async () => {
    const { framedPrompt, framedReqs } = framePromptFromQuestionnaire(discoveryAnswers, true);
    await handleGenerateWithArgon(false, framedPrompt, framedReqs, discoveryAnswers);
  };

  const handleSaveOrSend = async (targetStatus: 'Draft' | 'Sent') => {
    if (!companyName.trim() || !recipientEmail.trim()) {
      showToast('Company name and recipient email are required.', 'error');
      return;
    }
    if (!htmlProposal.trim()) {
      showToast('Please generate or enter an HTML proposal first.', 'error');
      return;
    }

    if (targetStatus === 'Sent') {
      setSending(true);
    } else {
      setSaving(true);
    }

    try {
      const payload = {
        lead_id: selectedLeadId || null,
        client_id: selectedClientId || null,
        company_name: companyName.trim(),
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim(),
        project_title: projectTitle.trim(),
        service_type: serviceType,
        budget: Number(budget) || 0,
        currency,
        timeline_weeks: Number(timelineWeeks) || 8,
        key_requirements: keyRequirements.trim(),
        email_subject: emailSubject.trim(),
        email_body: emailBody,
        html_proposal: htmlProposal,
        ai_model: aiModelUsed,
        status: targetStatus,
      };

      let savedProposal: Proposal;
      if (activeProposalId) {
        const updated = await apiFetch<{ proposal: Proposal }>(`/proposals/${activeProposalId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        savedProposal = updated.proposal;
      } else {
        const created = await apiFetch<{ proposal: Proposal }>('/proposals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedProposal = created.proposal;
        setActiveProposalId(created.proposal.id);
      }

      if (savedProposal.lead_id) {
        setSelectedLeadId(savedProposal.lead_id);
      }

      if (targetStatus === 'Sent') {
        showToast(
          savedProposal.lead_id
            ? `Proposal sent to ${recipientName} <${recipientEmail}> — Lead status changed to "Proposal sent"!`
            : `Interactive HTML Proposal Mail sent to ${recipientName} <${recipientEmail}>!`
        );
      } else {
        showToast(`Saved proposal draft for ${companyName}.`, 'info');
      }

      fetchAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save proposal', 'error');
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const handleLoadProposal = (prop: Proposal) => {
    setActiveProposalId(prop.id);
    setSelectedClientId(prop.client_id || '');
    setSelectedLeadId(prop.lead_id || '');
    setCompanyName(prop.company_name);
    setRecipientName(prop.recipient_name);
    setRecipientEmail(prop.recipient_email);
    setProjectTitle(prop.project_title);
    setServiceType(prop.service_type);
    setBudget(String(prop.budget));
    setCurrency(prop.currency);
    setTimelineWeeks(String(prop.timeline_weeks));
    setKeyRequirements(prop.key_requirements);
    setEmailSubject(prop.email_subject);
    setEmailBody(prop.email_body);
    setHtmlProposal(prop.html_proposal);
    setAiModelUsed(prop.ai_model || 'gemini-argon-ai');
    showToast(`Loaded ${prop.proposal_number} (${prop.company_name}) into studio`, 'info');
  };

  const handleUpdateProposalStatus = async (prop: Proposal, status: ProposalStatus) => {
    try {
      await apiFetch(`/proposals/${prop.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      showToast(`Updated ${prop.proposal_number} status to ${status}`);
      fetchAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProposal) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/proposals/${deletingProposal.id}`, { method: 'DELETE' });
      if (activeProposalId === deletingProposal.id) {
        setActiveProposalId(null);
      }
      showToast(`Deleted proposal ${deletingProposal.proposal_number}`, 'info');
      setDeletingProposal(null);
      fetchAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete proposal', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleCopyHtml = () => {
    if (!htmlProposal) return;
    navigator.clipboard.writeText(htmlProposal);
    showToast('Copied HTML proposal code to clipboard!');
  };

  const handleDownloadHtml = () => {
    if (!htmlProposal) return;
    const blob = new Blob([htmlProposal], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-proposal.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded interactive HTML proposal file!');
  };

  const getStatusBadgeClass = (st: ProposalStatus) => {
    switch (st) {
      case 'Sent':
        return 'bg-[#EEF8FA] text-[#0F2547] border-[#B0E0EC] dark:bg-cyan-950/60 dark:text-[#7BC8DC] dark:border-cyan-800';
      case 'Accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      case 'Declined':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    }
  };

  // Ensure #hash navigation links inside iframe srcDoc scroll within the proposal instead of loading parent CRM URL
  const safeProposalSrcDoc = React.useMemo(() => {
    if (!htmlProposal) return '';
    const hashScrollScript = `<script>
      document.addEventListener('click', function(e) {
        var anchor = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!anchor) return;
        var hash = anchor.getAttribute('href');
        if (hash && hash.startsWith('#')) {
          e.preventDefault();
          var targetEl = document.querySelector(hash);
          if (targetEl && targetEl.scrollIntoView) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    </script>`;
    if (htmlProposal.includes("a[href^=\"#\"]")) {
      return htmlProposal;
    }
    if (htmlProposal.includes('</body>')) {
      return htmlProposal.replace('</body>', `${hashScrollScript}</body>`);
    }
    return `${htmlProposal}${hashScrollScript}`;
  }, [htmlProposal]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            AI HTML Proposal Mailer
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveProposalId(null);
              handleGenerateWithArgon(false);
            }}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#3596B0]" />
            {generating ? 'Generating Proposal...' : 'Generate using AI'}
          </button>
        </div>
      </div>

      {/* Deep Requirement Discovery & Intensive Prompt Framing Questionnaire */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#3596B0]/40 dark:border-cyan-800/60 shadow-sm overflow-hidden">
        {/* Questionnaire Header Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0F2547]/5 via-[#3596B0]/10 to-transparent dark:from-slate-800/80 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0F2547] text-[#7BC8DC] flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Deep Requirement Discovery Questionnaire (12 Intensive Architectural Questions)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF8FA] text-[#0F2547] border border-[#B0E0EC] dark:bg-cyan-950/70 dark:text-[#7BC8DC] dark:border-cyan-800">
                  {answeredQuestionCount}/{DISCOVERY_QUESTIONS.length} Answered • {discoveryDepthPct}% AI Context Depth
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Answer these intensive discovery questions (or click quick-insert tags) so the AI understands your client&apos;s exact business bottlenecks, workflows, integrations, security, and ROI before framing the master prompt and HTML proposal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDiscoveryAnswers({
                  industry_and_model: '',
                  pain_points_bottlenecks: '',
                  target_personas: '',
                  core_modules_portals: '',
                  user_journey_workflow: '',
                  approvals_governance: '',
                  ai_automation_needs: '',
                  integrations_ecosystem: '',
                  data_migration_volume: '',
                  security_compliance_cloud: '',
                  success_metrics_roi: '',
                  rollout_sla_amc: '',
                });
                showToast('Cleared all 12 discovery questionnaire answers', 'info');
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Clear Answers
            </button>
            <button
              type="button"
              onClick={() => setDiscoveryOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0F2547] dark:text-[#7BC8DC] bg-[#EEF8FA] dark:bg-cyan-950/60 border border-[#B0E0EC] dark:border-cyan-800 cursor-pointer"
            >
              {discoveryOpen ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Hide Questions
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Open 12 Discovery Questions
                </>
              )}
            </button>
          </div>
        </div>

        {discoveryOpen && (
          <div className="p-5 space-y-5">
            {/* Pillar Navigation Tabs + Blueprint Preset Loader */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveDiscoveryCategory('business')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeDiscoveryCategory === 'business'
                      ? 'bg-[#0F2547] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-[#3596B0]" />
                  1. Business &amp; Bottlenecks (Q1–Q3)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDiscoveryCategory('functional')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeDiscoveryCategory === 'functional'
                      ? 'bg-[#0F2547] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#3596B0]" />
                  2. Modules, Flows &amp; Approvals (Q4–Q6)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDiscoveryCategory('ai_data')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeDiscoveryCategory === 'ai_data'
                      ? 'bg-[#0F2547] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-[#3596B0]" />
                  3. AI, Data &amp; Integrations (Q7–Q9)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDiscoveryCategory('architecture')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeDiscoveryCategory === 'architecture'
                      ? 'bg-[#0F2547] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3596B0]" />
                  4. Security, Cloud &amp; ROI (Q10–Q12)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDiscoveryCategory('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeDiscoveryCategory === 'all'
                      ? 'bg-[#3596B0] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  View All 12 Questions
                </button>
              </div>

              {/* Load Full Discovery Blueprint Preset */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  Load Deep Blueprint:
                </span>
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setDiscoveryAnswers(preset.discovery);
                      setCompanyName(preset.company);
                      setRecipientName(preset.recipient);
                      setRecipientEmail(preset.email);
                      setProjectTitle(preset.title);
                      setServiceType(preset.service);
                      setBudget(preset.budget);
                      setTimelineWeeks(preset.weeks);
                      setUserPrompt(preset.prompt);
                      setKeyRequirements(preset.prompt);
                      showToast(`Loaded 12-question deep blueprint for ${preset.company}`, 'info');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-[#EEF8FA] text-slate-700 hover:text-[#0F2547] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-cyan-950/60 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {preset.company}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {DISCOVERY_QUESTIONS.filter(
                (q) => activeDiscoveryCategory === 'all' || q.category === activeDiscoveryCategory
              ).map((q) => {
                const val = discoveryAnswers[q.key] || '';
                const isFilled = val.trim().length > 0;
                return (
                  <div
                    key={q.key}
                    className={`p-4 rounded-xl border transition-colors flex flex-col justify-between space-y-3 ${
                      isFilled
                        ? 'bg-[#EEF8FA]/30 dark:bg-cyan-950/20 border-[#3596B0]/40 dark:border-cyan-800/60'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#0F2547] text-[#7BC8DC] shrink-0">
                          {q.number}
                        </span>
                        {isFilled && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Captured
                          </span>
                        )}
                      </div>
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {q.question}
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {q.subtext}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={val}
                        onChange={(e) => handleDiscoveryChange(q.key, e.target.value)}
                        placeholder={q.placeholder}
                        className="w-full px-3 py-2 text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#3596B0]"
                      />
                      <div className="flex flex-wrap gap-1">
                        {q.chips.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleAppendDiscoveryChip(q.key, chip)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-[#3596B0] hover:text-[#0F2547] dark:hover:text-[#7BC8DC] transition-colors cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Bar: Frame Prompt & Generate Proposal */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-slate-800 dark:text-slate-200">How this works:</strong>{' '}
                Clicking <span className="font-semibold text-[#0F2547] dark:text-[#7BC8DC]">Frame Intensive AI Prompt</span> synthesizes your answers into a structured master prompt below. Clicking <span className="font-semibold text-[#3596B0]">Frame Prompt &amp; Generate HTML Proposal</span> frames the prompt and builds the complete 16-section HTML proposal immediately.
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => framePromptFromQuestionnaire()}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0F2547] dark:text-[#7BC8DC] border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#3596B0]" />
                  1. Frame Intensive AI Prompt
                </button>
                <button
                  type="button"
                  onClick={handleFrameAndGenerate}
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#7BC8DC]" />
                  {generating
                    ? 'Framing & Generating Proposal...'
                    : '2. Frame Prompt & Generate HTML Proposal'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prominent AI Prompt Composer Box */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0F2547] via-[#15315B] to-[#1D437A] text-white shadow-md border border-[#3596B0]/30 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#7BC8DC]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#7BC8DC]">
              Framed Master AI Prompt (Auto-Synthesized from Discovery Questions or Freely Editable)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PROMPT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setDiscoveryAnswers(preset.discovery);
                  setUserPrompt(preset.prompt);
                  setCompanyName(preset.company);
                  setRecipientName(preset.recipient);
                  setRecipientEmail(preset.email);
                  setProjectTitle(preset.title);
                  setServiceType(preset.service);
                  setBudget(preset.budget);
                  setTimelineWeeks(preset.weeks);
                  setKeyRequirements(preset.prompt);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-cyan-100 border border-white/15 transition-colors cursor-pointer"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={4}
            value={userPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleGenerateWithArgon(false);
              }
            }}
            placeholder="Describe how you want your interactive HTML proposal and email structured, or click 'Frame Intensive AI Prompt' above to synthesize from your 12 discovery answers..."
            className="flex-1 px-3.5 py-2.5 text-xs leading-relaxed rounded-xl bg-slate-950/50 border border-white/20 text-white placeholder:text-slate-300 focus:outline-none focus:border-[#7BC8DC]"
          />
          <button
            type="button"
            onClick={() => handleGenerateWithArgon(false)}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#3596B0] hover:bg-[#2B8098] text-white shadow-sm inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating Artifact...' : 'Generate HTML Proposal'}
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Total Proposals</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary.total}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#B0E0EC] dark:border-cyan-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#0F2547] dark:text-[#7BC8DC]">
            <span>Sent in Mail</span>
            <Send className="w-4 h-4 text-[#3596B0]" />
          </div>
          <div className="text-2xl font-bold text-[#0F2547] dark:text-[#7BC8DC] mt-1">
            {summary.sentCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span>Drafts</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {summary.draftCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>Accepted by Client</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {summary.acceptedCount}
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Configurator (5 cols) | Right Editable Mail & HTML Proposal Preview (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Gemini Argon AI Input Parameters */}
        <div className="xl:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3596B0]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                1. Client &amp; Scope Parameters
              </h3>
            </div>
            {activeProposalId && (
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#EEF8FA] text-[#0F2547] dark:bg-cyan-950 dark:text-[#7BC8DC]">
                Editing Saved Proposal
              </span>
            )}
          </div>

          {/* Quick-Select Existing Client or Lead */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <Building2 className="w-3 h-3 text-[#3596B0]" />
                Prefill from Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.contact_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <UserCheck className="w-3 h-3 text-[#3596B0]" />
                Or Prefill from Lead
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => handleSelectLead(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Select Lead --</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.company} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client Company *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recipient Name *
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recipient Email *
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposal / Project Title *
              </label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Service Pillar
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                Delivery Timeline (Weeks)
              </label>
              <input
                type="number"
                min={1}
                max={104}
                value={timelineWeeks}
                onChange={(e) => setTimelineWeeks(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposed Investment &amp; Currency
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-24 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposal Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Executive & Consultative">Executive &amp; Consultative</option>
                <option value="Technical & Architecture-First">
                  Technical &amp; Architecture-First
                </option>
                <option value="Value & ROI Focused">Value &amp; ROI Focused</option>
                <option value="Concise & Fast-Track">Concise &amp; Fast-Track</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Key Deliverables &amp; Technical Scope (One per line or comma-separated)
              </label>
              <textarea
                rows={4}
                value={keyRequirements}
                onChange={(e) => setKeyRequirements(e.target.value)}
                placeholder="Describe key features, technical requirements, SLAs, or business goals..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGenerateWithArgon(false)}
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#3596B0]" />
            {generating
              ? 'Generating NexInt AI HTML Proposal & Mail...'
              : 'Generate using AI'}
          </button>
        </div>

        {/* Right Column: Editable AI Mail Body + Editable HTML Proposal & Live Preview */}
        <div className="xl:col-span-7 space-y-5">
          {/* Card A: Editable AI Mail Composer */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#3596B0]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  2. AI-Generated Mail Subject &amp; Body (Editable)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateWithArgon(false)}
                disabled={generating}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0F2547] dark:text-[#7BC8DC] bg-[#EEF8FA] dark:bg-cyan-950/50 hover:opacity-90"
              >
                <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                Regenerate AI Mail
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  To (Recipient Email)
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Email Subject Line (Editable)
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  AI-Generated Cover Email Body (You can freely edit this before sending)
                </label>
                <span className="text-[10px] font-semibold text-[#3596B0]">
                  Editable Text
                </span>
              </div>
              <textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-sans"
              />
            </div>
          </div>

          {/* Card B: Interactive HTML Proposal Document Preview & Source Editor */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewTab('full_mail')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    previewTab === 'full_mail'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#3596B0]" />
                  Full Mail + Interactive HTML
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('html_preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    previewTab === 'html_preview'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#3596B0]" />
                  Interactive Artifact Only
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('html_code')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    previewTab === 'html_code'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-[#3596B0]" />
                  Edit / Paste HTML Source
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFullscreenArtifactOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#EEF8FA] text-[#0F2547] dark:bg-cyan-950/60 dark:text-[#7BC8DC] hover:opacity-90"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Fullscreen Artifact
                </button>
                <button
                  type="button"
                  onClick={handleCopyHtml}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy HTML
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .html
                </button>
              </div>
            </div>

            {/* Preview / Code Content */}
            {!htmlProposal && !generating ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF8FA] dark:bg-cyan-950/60 border border-[#B0E0EC] dark:border-cyan-800 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-[#3596B0]" />
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ready to Generate Your NexInt AI HTML Proposal
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Enter your prompt and client details, then click <strong>Generate HTML Proposal</strong> or <strong>Generate using AI</strong> to build the interactive 16-section NexInt AI proposal artifact and cover email.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateWithArgon(false)}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#3596B0]" />
                    Generate HTML Proposal
                  </button>
                </div>
              </div>
            ) : generating ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-16 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-[#3596B0] animate-spin mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Generating NexInt AI HTML Proposal Artifact...
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Synthesizing all 16 sections, architecture diagram, phase delivery plan, and investment milestones from your prompt.
                </p>
              </div>
            ) : previewTab === 'html_code' ? (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Edit the generated HTML proposal code or paste any custom Claude Artifact HTML
                  below. Changes immediately render in the interactive preview.
                </div>
                <textarea
                  rows={20}
                  value={htmlProposal}
                  onChange={(e) => setHtmlProposal(e.target.value)}
                  className="w-full p-3.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-cyan-300 leading-relaxed"
                />
              </div>
            ) : previewTab === 'full_mail' ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950">
                {/* Simulated Email Client Envelope Header */}
                <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <img
                        src="/logo-mark.webp"
                        alt="NexIntAI Logo"
                        className="w-5 h-5 object-contain rounded bg-white p-0.5 border border-slate-200"
                      />
                      <span className="font-extrabold text-[#0F2547] dark:text-white">
                        NexInt<span className="text-[#3596B0]">AI</span>
                      </span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {recipientName} &lt;{recipientEmail}&gt;
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EEF8FA] text-[#0F2547] border border-[#B0E0EC] font-bold">
                      NexIntAI Branded HTML Proposal
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Subject:</span>{' '}
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {emailSubject}
                    </span>
                  </div>
                </div>

                {/* Editable Cover Email Body rendered above the embedded HTML Proposal */}
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {emailBody}
                </div>

                {/* Embedded Interactive HTML Proposal Artifact */}
                <div className="bg-slate-100 p-3">
                  <iframe
                    title="NexInt AI Interactive HTML Proposal Preview"
                    srcDoc={safeProposalSrcDoc}
                    className="w-full h-[640px] rounded-xl bg-white border border-slate-200 shadow-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 p-3">
                <iframe
                  title="HTML Proposal Standalone Interactive Artifact"
                  srcDoc={safeProposalSrcDoc}
                  className="w-full h-[680px] rounded-xl bg-white border border-slate-200 shadow-xs"
                />
              </div>
            )}

            {/* Bottom Action Bar: Save Draft or Send HTML Proposal Mail */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Recipient: <strong className="text-slate-800 dark:text-slate-200">{recipientEmail}</strong>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSaveOrSend('Draft')}
                  disabled={saving || sending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveOrSend('Sent')}
                  disabled={sending || saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#0F2547] hover:bg-[#193A6B] text-white shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#3596B0]" />
                  {sending ? 'Sending Mail...' : 'Send HTML Proposal in Mail'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved & Sent HTML Proposals History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Sent &amp; Saved AI Proposals ({proposals.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No proposals saved or sent yet. Enter a prompt above to generate and send your first
            interactive HTML proposal mail.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Proposal #</th>
                  <th className="py-3 px-4">Client &amp; Recipient</th>
                  <th className="py-3 px-4">Project Title</th>
                  <th className="py-3 px-4">Investment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent / Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {proposals.map((prop) => (
                  <tr
                    key={prop.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#0F2547] dark:text-[#7BC8DC]">
                      {prop.proposal_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {prop.company_name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {prop.recipient_name} &bull; {prop.recipient_email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {prop.project_title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {prop.service_type} &bull; {prop.timeline_weeks} weeks
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(prop.budget, prop.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${getStatusBadgeClass(
                          prop.status
                        )}`}
                      >
                        {prop.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {formatDateTime(prop.sent_at || prop.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadProposal(prop)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#EEF8FA] text-[#0F2547] dark:bg-cyan-950/60 dark:text-[#7BC8DC] hover:opacity-90"
                        >
                          Open in Studio
                        </button>
                        {prop.status !== 'Accepted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateProposalStatus(prop, 'Accepted')}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            Mark Accepted
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeletingProposal(prop)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fullscreen Interactive HTML Artifact Modal */}
      <Modal
        open={fullscreenArtifactOpen}
        onClose={() => setFullscreenArtifactOpen(false)}
        title={`Interactive HTML Proposal Artifact — ${projectTitle}`}
        maxWidth="max-w-5xl"
      >
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 p-2">
          <iframe
            title="Fullscreen Interactive HTML Proposal"
            srcDoc={safeProposalSrcDoc}
            className="w-full h-[76vh] rounded-lg bg-white border border-slate-200"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingProposal)}
        onClose={() => setDeletingProposal(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Proposal"
        description={`Are you sure you want to delete proposal ${deletingProposal?.proposal_number} for ${deletingProposal?.company_name}?`}
        confirmLabel="Delete Proposal"
        variant="danger"
        loading={deletingLoading}
      />
    </div>
  );
};
