import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getEnvValue(keys: string[]): string {
  for (const k of keys) {
    if (process.env[k] && String(process.env[k]).trim()) {
      return String(process.env[k]).trim();
    }
  }
  const envFiles = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../frontend/.env'),
  ];
  for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (keys.includes(k) && v && v !== 'your-gemini-argon-api-key-here') {
        return v;
      }
    }
  }
  return '';
}

export const proposalsRouter = Router();
proposalsRouter.use(requireAuth);

const NEXINT_LOGO_SVG_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg viewBox="0 0 120 106" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 24 H32 V86 H47 V102 H12 Z" fill="#0F2547"/><path d="M32 6 H60 L98 86 H112 V102 H84 L46 24 H32 Z" fill="#0F2547"/><rect x="98" y="6" width="20" height="20" fill="#3596B0"/><rect x="98" y="34" width="20" height="52" fill="#3596B0"/></svg>`
  );

function getNexIntLogoMarkUri(): string {
  try {
    const logoPath = path.resolve(__dirname, '../../../frontend/public/logo-mark.webp');
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      return `data:image/webp;base64,${b64}`;
    }
  } catch {
    // fallback
  }
  return NEXINT_LOGO_SVG_DATA_URI;
}

function getNexIntLogoFullUri(): string {
  try {
    const logoPath = path.resolve(__dirname, '../../../frontend/public/logo-full.webp');
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      return `data:image/webp;base64,${b64}`;
    }
  } catch {
    // fallback
  }
  return '';
}

async function generateNextProposalNumber(): Promise<string> {
  const all = await prisma.proposal.findMany();
  let maxNum = 200;
  for (const p of all) {
    const match = String(p.proposal_number || '').match(/PROP-(\d+)/);
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `PROP-${maxNum + 1}`;
}

function formatMoney(amount: number, currency = 'INR', includeSymbol = true): string {
  const num = Math.round(Number(amount || 0));
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  if (!includeSymbol) {
    return num.toLocaleString(locale);
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString(locale)}`;
  }
}

function getCurrencySymbol(currency = 'INR'): string {
  switch (currency) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return currency;
  }
}

export interface StructuredProposalContent {
  heroHeadline?: string;
  heroSubheadline?: string;
  integrationsLabel?: string;
  whatSummary?: string;
  whoItServes?: string;
  aiAndAutomationSummary?: string;
  worksWithSummary?: string;
  runningCostSummary?: string;
  whatWeHeardHeadline?: string;
  whatWeHeardIntro?: string;
  whatWeHeardItems?: Array<{ youSaid: string; today: string }>;
  workflows?: Array<{ title: string; today: string; assisted: string; badge: string }>;
  modules?: Array<{ title: string; desc: string }>;
  aiCapabilities?: Array<{ title: string; desc: string }>;
  automationsList?: string[];
  endToEndSteps?: Array<{ title: string; desc: string }>;
  integrations?: Array<{ name: string; role: string; design: string; fallback: string }>;
  risks?: Array<{ risk: string; likelihood: 'Medium' | 'High'; mitigation: string }>;
  requirementsAnswered?: Array<{ request: string; response: string; where: string }>;
}

export function synthesizeDynamicDomainContent(params: {
  company_name: string;
  recipient_name: string;
  project_title: string;
  service_type: string;
  budget: number;
  currency: string;
  timeline_weeks: number;
  user_prompt: string;
  key_requirements: string;
}): StructuredProposalContent {
  const {
    company_name,
    recipient_name,
    project_title,
    service_type,
    currency,
    user_prompt = '',
    key_requirements = '',
  } = params;

  const combined = `${user_prompt} ${key_requirements} ${project_title} ${service_type}`.toLowerCase();

  // Extract custom prompt lines
  const rawLines = `${user_prompt}\n${key_requirements}`
    .split(/\n|•|;/)
    .map((s) => s.replace(/^[-*0-9.)\s]+/, '').trim())
    .filter((s) => s.length > 5);

  const customFeature1 = rawLines[0] || `${project_title} core automation workflows`;
  const customFeature2 = rawLines[1] || `Intelligent analytics and real-time reporting`;
  const customFeature3 = rawLines[2] || `Role-based access, security controls, and audit tracking`;
  const customFeature4 = rawLines[3] || `Multi-channel notifications and seamless external integrations`;

  const isHealthcare =
    /health|patient|doctor|clinic|hospital|triage|medical|telehealth|symptom|ehr|emr|prescription/i.test(
      combined
    );
  const isDataEng =
    /data engineering|pipeline|etl|elt|lakehouse|warehouse|snowflake|databricks|kafka|streaming|dbt|bigquery/i.test(
      combined
    ) || service_type === 'Data Engineering';
  const isFintech =
    /fintech|bank|payment|invoice|po\b|purchase order|treasury|fraud|loan|credit|crypto|trading|wallet|dispute|ledger|reconcil/i.test(
      combined
    );
  const isEcommerce =
    /ecommerce|e-commerce|store|cart|checkout|shop|product|catalog|order|marketplace|inventory/i.test(
      combined
    );
  const isLogistics =
    /logistics|supply chain|fleet|route|driver|dispatch|shipment|freight|delivery|tracking/i.test(
      combined
    );
  const isAiAgent =
    /ai agent|conversational|chatbot|llm|rag|nlp|virtual assistant|copilot|generative ai/i.test(
      combined
    ) || service_type === 'AI services';

  if (isHealthcare) {
    return {
      heroHeadline: `The ${company_name} ${project_title}: Intelligent Patient Care, Clinical Triaging & Automated Practice Management.`,
      heroSubheadline: user_prompt.trim()
        ? `${user_prompt.trim()} — engineered by NexInt AI as a secure, HIPAA-compliant healthcare application unifying patient triage, appointment scheduling, and clinical workflows.`
        : `Transform patient care and clinic efficiency: automated AI symptom assessment, instant appointment booking with doctor matching, real-time EHR integration, and proactive care reminders.`,
      whatSummary: `${project_title}: responsive web application & mobile patient portal with secure EHR/EMR connectivity`,
      whoItServes: `Patients, triage nurses, attending physicians, clinic administrators, and practice managers`,
      aiAndAutomationSummary: `14 clinical AI capabilities and 14 automated healthcare workflows, from conversational symptom intake to insurance pre-check and automated follow-up care`,
      worksWithSummary: `EHR / EMR systems (Epic, Cerner, FHIR / HL7 APIs), WhatsApp / SMS gateways, Google Calendar / Outlook, and payment gateways`,
      runningCostSummary:
        currency === 'INR'
          ? `About ₹25,000–35,000 / month from go-live: HIPAA-grade cloud hosting ₹14,000, managed SLA support ₹15,000, and AI token consumption ~₹5,000`
          : `Predictable monthly operations: dedicated healthcare cloud hosting, managed SLA support, and actual AI API consumption`,
      whatWeHeardHeadline: `What we heard from ${company_name} on clinical care & patient operations:`,
      whatWeHeardIntro: `Your clinical staff and patients experience friction across intake, scheduling, and follow-ups. Here is what needs solving:`,
      whatWeHeardItems: [
        {
          youSaid: customFeature1,
          today: `Patients wait on phone lines or fill redundant paper forms; clinic staff manually re-types intake data into EHR.`,
        },
        {
          youSaid: customFeature2,
          today: `Symptoms cannot be systematically triaged prior to arrival; acute and routine consultations compete in the same queue.`,
        },
        {
          youSaid: customFeature3,
          today: `Appointment no-shows and last-minute cancellations leave doctors idle and cost significant clinic revenue.`,
        },
        {
          youSaid: customFeature4,
          today: `Doctors spend excessive time typing consultation notes and manual prescriptions after every appointment.`,
        },
        {
          youSaid: `Insurance eligibility and copay checks are verified by hand over phone calls, causing reception bottlenecks.`,
          today: `Patients arrive without prior coverage confirmation; billing claims face delays and unexpected rejections.`,
        },
        {
          youSaid: `Post-consultation instructions and prescription adherence are rarely tracked after the patient leaves the clinic.`,
          today: `Follow-up care is entirely manual; patients forget medication schedules and preventive check-ins.`,
        },
        {
          youSaid: `Patient records, lab reports, and imaging documents sit scattered across emails, chat apps, and paper files.`,
          today: `Physicians lack a unified chronological patient timeline during emergency or repeat visits.`,
        },
        {
          youSaid: `The practice wants to scale to multi-location clinics and telehealth consultations with complete data privacy.`,
          today: `Existing off-the-shelf software is rigid, charges per-patient fees, and lacks custom workflow support.`,
        },
      ],
      workflows: [
        {
          title: 'Patient Intake & Digital Check-in',
          today: 'Today: Paper forms and clipboards at reception desk',
          assisted: 'QR code & SMS check-in; AI verifies demographic info and updates EHR automatically',
          badge: 'Patient Portal · Reception approves',
        },
        {
          title: 'Conversational Symptom Triaging',
          today: 'Today: Patient explains symptoms only upon doctor entry',
          assisted: 'AI Clinical Assistant evaluates symptoms, flags red-flag alerts, and prepares a concise doctor brief',
          badge: 'Clinical AI · Doctor reviews',
        },
        {
          title: 'Doctor Matching & Smart Scheduling',
          today: 'Today: Receptionist checks fragmented calendar books',
          assisted: 'Intelligent scheduling algorithm matches clinical specialty, location, and doctor availability in real-time',
          badge: 'Scheduling Engine',
        },
        {
          title: 'Telehealth Video Consultation',
          today: 'Today: Clunky external video links sent manually',
          assisted: 'One-click encrypted HD video room inside the patient portal with synchronized live notes',
          badge: 'Secure Video Hub',
        },
        {
          title: 'Digital Prescriptions & Pharmacy Sync',
          today: 'Today: Handwritten paper prescriptions prone to misreading',
          assisted: 'Structured e-prescription generator with drug-interaction checks sent directly to patient WhatsApp and pharmacy',
          badge: 'Clinical Gateway',
        },
        {
          title: 'Insurance Eligibility Pre-Check',
          today: 'Today: Manual calls to insurer while patient waits in lobby',
          assisted: 'Automated insurance verification API confirms active coverage, co-pays, and pre-authorization requirements',
          badge: 'Insurance API',
        },
        {
          title: 'Automated Medication & Appointment Reminders',
          today: 'Today: Missed appointments and non-compliance',
          assisted: 'Automated WhatsApp & SMS notifications with one-click confirmation and reschedule links',
          badge: 'Messaging Engine',
        },
        {
          title: 'Critical Lab Alert Escalation',
          today: 'Today: Normal and critical lab results mixed in inbox',
          assisted: 'AI highlights out-of-range lab markers and triggers instant priority alert to the attending physician',
          badge: 'Alert Sentinel',
        },
        {
          title: 'Post-Visit Care & CSAT Feedback',
          today: 'Today: Feedback rarely recorded systematically',
          assisted: 'Automated post-visit check-in survey 24 hours after appointment; flags unhappy patients for quick resolution',
          badge: 'Quality & CSAT Engine',
        },
      ],
      modules: [
        {
          title: 'Patient Web Portal & Mobile App',
          desc: 'Self-service patient portal for symptom intake, appointment booking, telehealth access, and medical record vault.',
        },
        {
          title: 'AI Symptom & Triaging Assistant',
          desc: 'Conversational AI engine that interviews patients, structures chief complaints, and classifies clinical urgency.',
        },
        {
          title: 'Doctor Schedule & Capacity Manager',
          desc: 'Multi-physician, multi-room calendar with automated buffer times, vacation rules, and emergency slot reserving.',
        },
        {
          title: 'Telehealth Consultation Studio',
          desc: 'HIPAA-compliant, WebRTC-based encrypted video consultation suite with live document sharing and clinician whiteboard.',
        },
        {
          title: 'EHR / EMR Integration Bridge',
          desc: 'Bidirectional sync with hospital EHR systems via standard HL7 / FHIR protocols and RESTful endpoints.',
        },
        {
          title: 'Digital Rx & Drug Interaction Sentinel',
          desc: 'Structured digital prescription builder with real-time contraindication and dosage safety checks.',
        },
        {
          title: 'Insurance & Claims Pre-Auth Hub',
          desc: 'Instant verification of patient insurance policy status, deductibles, copay amounts, and cashless approvals.',
        },
        {
          title: 'Care Adherence & Reminder Engine',
          desc: 'Automated omnichannel notification pipeline via WhatsApp, SMS, and email for appointments and medication refill alerts.',
        },
        {
          title: 'Clinical Analytics & Revenue Dashboard',
          desc: 'Real-time practice metrics: patient throughput, no-show rates, doctor utilization, and billing cycle recovery.',
        },
        {
          title: 'Security, HIPAA & Audit Vault',
          desc: 'End-to-end data encryption at rest and in transit, comprehensive audit logging of all patient record views, and role-based access.',
        },
      ],
      aiCapabilities: [
        { title: 'Symptom Triage Evaluator', desc: 'Analyzes patient chief complaints and categorizes clinical urgency into routine, urgent, or emergency.' },
        { title: 'Clinical Note Summarizer', desc: 'Synthesizes conversation transcripts into structured SOAP clinical notes for physician sign-off in seconds.' },
        { title: 'Specialty Doctor Matchmaker', desc: 'Matches patient symptoms and language preferences to the ideal attending medical specialist.' },
        { title: 'No-Show Predictor', desc: 'Identifies high-risk appointment slots using historical patterns and triggers proactive confirmations.' },
        { title: 'Drug Interaction Guardian', desc: 'Scans prescribed medications against patient allergy history and concurrent prescriptions in real time.' },
        { title: 'Lab Outlier Highlighter', desc: 'Parses incoming diagnostic reports and flags abnormal markers with color-coded severity.' },
        { title: 'Patient Query Assistant', desc: '24/7 AI chatbot that answers clinic FAQs, preparation guidelines for procedures, and clinic timings.' },
        { title: 'Medical Speech-to-Text', desc: 'Accurate dictation engine trained on medical terminology and drug names for effortless doctor notes.' },
        { title: 'Prescription OCR Scanner', desc: 'Digitizes previous paper prescriptions and medical histories from patient smartphone photos.' },
        { title: 'Care Protocol Generator', desc: 'Drafts post-operative discharge instructions and recovery timelines based on clinical diagnoses.' },
        { title: 'Insurance Policy Parser', desc: 'Reads insurance card photos and extracts policy numbers, validity dates, and payer IDs.' },
        { title: 'Multilingual Clinical Translator', desc: 'Translates intake questionnaires and discharge instructions across major regional languages.' },
        { title: 'Emergency Keyword Sentinel', desc: 'Monitors inbound chat messages for emergency keywords (chest pain, stroke symptoms) and alerts on-call staff.' },
        { title: 'Patient Satisfaction Analyzer', desc: 'Extracts sentiment trends and clinical service feedback from post-visit reviews.' },
      ],
      automationsList: [
        'Instant appointment confirmation SMS & WhatsApp upon booking',
        'Automated calendar invite sync for both patient and physician',
        'Pre-appointment digital intake link sent 24 hours in advance',
        'Real-time EHR chart creation when a new patient registers',
        'Automatic no-show detection and slot release after 15-minute grace period',
        'Encrypted telehealth video room generated 10 minutes prior to call',
        'Prescription PDF dispatch to patient WhatsApp and partner pharmacy',
        'Insurance eligibility check triggered automatically upon check-in',
        'Post-consultation medication refill reminder scheduled automatically',
        'Automated 24-hour post-visit recovery check-in message',
        'Unpaid copay alert dispatched to billing department',
        'Daily morning physician patient queue brief dispatched to tablet',
        'Automated weekly clinic revenue and patient volume executive report',
        'Quarterly patient health check-up reminder notification pipeline',
      ],
    };
  }

  if (isDataEng) {
    return {
      heroHeadline: `The ${company_name} ${project_title}: High-Throughput Modern Data Lakehouse, Streaming Ingestion & Automated Analytics.`,
      heroSubheadline: user_prompt.trim()
        ? `${user_prompt.trim()} — engineered by NexInt AI as a robust, production-ready data platform unifying multi-source ETL/ELT, streaming ingestion, and data governance.`
        : `Transform raw data into real-time business intelligence: automated data pipelines, Snowflake/Databricks lakehouse architecture, dbt transformation models, and continuous data quality monitoring.`,
      whatSummary: `${project_title}: modern cloud data platform, streaming Kafka pipelines, and dbt transformation models`,
      whoItServes: `Data engineering teams, analytics engineers, BI analysts, data scientists, and business executives`,
      aiAndAutomationSummary: `14 automated data observability pipelines and 14 AI data intelligence capabilities, from automated schema anomaly detection to zero-downtime ETL orchestration`,
      worksWithSummary: `Snowflake / Databricks / PostgreSQL, Apache Kafka / Redpanda, dbt Core, Airflow / Dagster, Tableau / Power BI, and Slack alerts`,
      runningCostSummary:
        currency === 'INR'
          ? `About ₹35,000–50,000 / month: scalable cloud compute (AWS/GCP) ₹20,000, managed SLA support ₹15,000, and data warehouse usage at actuals`
          : `Predictable monthly operations: cloud data warehouse compute, managed SLA support, and pipeline orchestration at actual cost`,
      whatWeHeardHeadline: `What we heard from ${company_name} on data infrastructure & reporting:`,
      whatWeHeardIntro: `Your analytical workloads suffer from fragmented databases, delayed reports, and pipeline breakages. Here is what needs solving:`,
      whatWeHeardItems: [
        {
          youSaid: customFeature1,
          today: `Data is scattered across multiple operational databases, SaaS tools, and manual CSV exports.`,
        },
        {
          youSaid: customFeature2,
          today: `Nightly batch ETL pipelines frequently break due to unexpected schema changes and upstream API changes.`,
        },
        {
          youSaid: customFeature3,
          today: `Business stakeholders wait days for custom SQL reports from overworked data engineering staff.`,
        },
        {
          youSaid: customFeature4,
          today: `There is no single source of truth; metrics like active customers, ARR, and gross margins differ across teams.`,
        },
        {
          youSaid: `Real-time event streams cannot be ingested fast enough to support live operational dashboards.`,
          today: `Analytics queries run against production transactional databases, causing system latency and downtime.`,
        },
        {
          youSaid: `Data transformations lack version control, automated regression testing, and data lineage documentation.`,
          today: `Nobody knows which source table or calculation broke the metric when numbers appear incorrect.`,
        },
        {
          youSaid: `PII and sensitive customer data lack automated masking and granular role-based access control.`,
          today: `Security compliance and audit reporting require tedious manual spreadsheet audits.`,
        },
        {
          youSaid: `The company needs a scalable foundation ready for production machine learning and generative AI applications.`,
          today: `Legacy data structures are too brittle and disorganized to train or feed modern AI models.`,
        },
      ],
      workflows: [
        {
          title: 'Multi-Source Data Ingestion (CDC & API)',
          today: 'Today: Fragile custom cron scripts and manual CSV downloads',
          assisted: 'Automated Change Data Capture (CDC) and connector pipelines stream data continuously into Bronze raw storage',
          badge: 'Ingestion Engine',
        },
        {
          title: 'Automated Schema Validation & Evolution',
          today: 'Today: Upstream schema changes crash downstream reports silently',
          assisted: 'Schema Registry checks incoming data types and automatically handles non-breaking evolutions with Slack alerts',
          badge: 'Schema Sentinel',
        },
        {
          title: 'Bronze-to-Silver Cleaning & Normalization',
          today: 'Today: Inconsistent date formats and duplicate records in warehouse',
          assisted: 'dbt models clean, deduplicate, and standardize raw records into unified relational entities',
          badge: 'dbt Transformation',
        },
        {
          title: 'Continuous Data Quality & Freshness Testing',
          today: 'Today: Stakeholders discover bad data only after leadership meetings',
          assisted: 'Automated assertions check for nulls, referential integrity, and freshness every 15 minutes',
          badge: 'Quality Engine',
        },
        {
          title: 'Silver-to-Gold Business Aggregation',
          today: 'Today: Analysts write 500-line SQL queries every Monday morning',
          assisted: 'Pre-computed dimensional tables (Facts & Dimensions) optimized for instant BI query performance',
          badge: 'Dimensional Modeling',
        },
        {
          title: 'Semantic Layer & Central Metric Definitions',
          today: 'Today: Marketing and Finance calculate revenue using different formulas',
          assisted: 'Centralized semantic layer enforces consistent business metric calculations across all tools',
          badge: 'Semantic Layer',
        },
        {
          title: 'Reverse ETL to Operational SaaS Tools',
          today: 'Today: Sales and support staff cannot see warehouse insights in CRM',
          assisted: 'Synchronizes enriched customer scores, churn risk, and LTV directly into Salesforce/CRM and marketing tools',
          badge: 'Reverse ETL',
        },
        {
          title: 'Pipeline Anomaly Detection & Self-Healing',
          today: 'Today: Failed jobs require 3 AM manual engineering triage',
          assisted: 'AI identifies root-cause pipeline failures, retries idempotent steps, and routes diagnostics to engineers',
          badge: 'AI Observability',
        },
        {
          title: 'Real-Time BI Dashboard Refresh',
          today: 'Today: Dashboards show stale yesterday-morning data',
          assisted: 'Streaming partitions trigger micro-batch dashboard refreshes within seconds of event occurrence',
          badge: 'BI Automation',
        },
      ],
      modules: [
        { title: 'Streaming Ingestion Cluster (Kafka / Redpanda)', desc: 'Distributed event ingestion cluster capable of handling high-frequency streaming events with zero message loss.' },
        { title: 'Cloud Data Warehouse (Snowflake / Databricks)', desc: 'Multi-cluster scalable warehouse with separated storage and compute, configured with optimized clustering keys.' },
        { title: 'Transformation & Modeling Engine (dbt)', desc: 'Modular dbt Core project with comprehensive staging, intermediate, and marts layers under strict Git version control.' },
        { title: 'Data Quality & Anomaly Sentinel', desc: 'Real-time test suite asserting schema consistency, volume anomalies, distribution drift, and referential integrity.' },
        { title: 'Pipeline Orchestrator (Airflow / Dagster)', desc: 'DAG-based scheduling with automated retry policies, dependency management, and conditional branching.' },
        { title: 'Semantic Metric Store', desc: 'Single source of truth defining corporate KPIs (Revenue, Churn, CAC, LTV) accessible by any BI tool.' },
        { title: 'Data Catalog & Lineage Tracker', desc: 'Searchable enterprise data dictionary showing end-to-end lineage from source database to final dashboard.' },
        { title: 'PII Masking & RBAC Security Layer', desc: 'Dynamic column-level data masking and role-based access policies adhering to SOC2 and GDPR compliance.' },
        { title: 'Reverse ETL Operational Sync', desc: 'Automated pipelines pushing analytical warehouse attributes back into CRM and customer support tools.' },
        { title: 'Executive BI & Observability Dashboard', desc: 'Interactive leadership dashboards with sub-second query latency and pipeline operational status monitoring.' },
      ],
      aiCapabilities: [
        { title: 'Schema Anomaly Detector', desc: 'Detects unexpected column additions, deletions, or type mutations before pipelines execute.' },
        { title: 'Pipeline Root-Cause Analyzer', desc: 'Pinpoints exact SQL lines and source API errors responsible for pipeline bottlenecks.' },
        { title: 'Text-to-SQL Query Generator', desc: 'Allows business users to query the warehouse in plain English with verified SQL translation.' },
        { title: 'Data Drift Monitor', desc: 'Tracks statistical shifts in numerical and categorical distributions across model features.' },
        { title: 'Cost Optimization Advisor', desc: 'Recommends warehouse sizing, idle suspension timeouts, and query clustering adjustments.' },
        { title: 'Smart Entity Matcher', desc: 'Matches fuzzy customer identities across disparate databases without manual foreign keys.' },
        { title: 'Automated Data Documentation', desc: 'Generates plain-language descriptions and business definitions for all warehouse tables and columns.' },
        { title: 'Volume Spike Forecaster', desc: 'Predicts upcoming peak data ingestion volumes based on seasonal trends and schedules compute.' },
        { title: 'PII Auto-Classifier', desc: 'Scans new tables and automatically tags sensitive columns (names, phone numbers, credit card data).' },
        { title: 'Slow-Query Diagnostic Engine', desc: 'Analyzes query execution profiles and suggests missing indexes or partition pruning strategies.' },
        { title: 'Data Quality Health Scorecard', desc: 'Calculates a daily reliability percentage for every data product in the organization.' },
        { title: 'Duplicate Row Resolver', desc: 'Identifies non-identical duplicate transactions and synthesizes unified master records.' },
        { title: 'Automated Metric Explainer', desc: 'Synthesizes written explanations for why a KPI jumped or dipped compared to historical periods.' },
        { title: 'SLA Breach Predictor', desc: 'Alerts data engineering when an upstream pipeline delay will impact executive morning reports.' },
      ],
      automationsList: [
        'Real-time Change Data Capture (CDC) triggered on every database mutation',
        'Automated dbt transformation triggered immediately after successful ingestion',
        'Data quality test assertions executed automatically prior to mart publishing',
        'Instant Slack & PagerDuty alerts dispatched upon pipeline failure with stack trace',
        'Automated data warehouse auto-suspend after 2 minutes of idle query time',
        'Weekly automated vacuuming, partition optimization, and metadata cleanup',
        'Automated reverse-ETL customer sync to CRM every hour',
        'Daily morning data freshness audit report delivered to engineering channel',
        'Automated schema change approval pull request generated in GitHub',
        'Continuous archival of raw cold data to cost-effective S3 Glacier storage',
        'Automatic retry of network-interrupted ingestion jobs with exponential backoff',
        'BI dashboard cache pre-warming triggered right after dbt mart completion',
        'Automated compliance audit log generated monthly for data governance',
        'Weekly warehouse cost and compute utilization digest sent to leadership',
      ],
    };
  }

  if (isAiAgent) {
    return {
      heroHeadline: `The ${company_name} ${project_title}: Autonomous AI Agents, RAG Intelligence & Workflow Automation.`,
      heroSubheadline: user_prompt.trim()
        ? `${user_prompt.trim()} — engineered by NexInt AI as a production-grade multi-agent system orchestrating conversational AI, retrieval-augmented generation (RAG), and system actions.`
        : `Empower your operations with autonomous intelligence: custom multi-agent orchestration, contextual RAG knowledge search, automated decision pipelines, and enterprise security guardrails.`,
      whatSummary: `${project_title}: multi-agent AI system, enterprise RAG knowledge engine, and automated action execution`,
      whoItServes: `Customer operations, support agents, account managers, sales teams, and end users`,
      aiAndAutomationSummary: `14 custom LLM capabilities and 14 autonomous agent workflows with human-in-the-loop review gates and real-time hallucination prevention`,
      worksWithSummary: `OpenAI / Anthropic / Gemini models, Pinecone / pgvector vector search, CRM & ticketing tools (Zendesk, Salesforce), Slack, and internal APIs`,
      runningCostSummary:
        currency === 'INR'
          ? `About ₹25,000–35,000 / month: scalable container hosting ₹12,000, managed SLA support ₹15,000, and model token usage at actual API cost`
          : `Predictable monthly operations: managed cloud infrastructure, 24/7 SLA maintenance, and model tokens billed at direct provider cost`,
      whatWeHeardHeadline: `What we heard from ${company_name} on AI automation & operational scale:`,
      whatWeHeardIntro: `Your team spends countless hours on repetitive customer interactions and searching scattered internal knowledge. Here is what we are automating:`,
      whatWeHeardItems: [
        {
          youSaid: customFeature1,
          today: `Team members spend hours answering the same repetitive customer questions and drafting standard replies.`,
        },
        {
          youSaid: customFeature2,
          today: `Internal knowledge is locked inside PDFs, Google Docs, Notion, and email threads, making lookups frustratingly slow.`,
        },
        {
          youSaid: customFeature3,
          today: `Off-the-shelf chatbots hallucinate answers, lack company context, and fail when executing actual system actions.`,
        },
        {
          youSaid: customFeature4,
          today: `Complex inquiries require human intervention, but there is no smooth handover mechanism between AI and human agents.`,
        },
        {
          youSaid: `Customer sentiment is not tracked in real-time, allowing frustrated users to churn before managers notice.`,
          today: `Support managers only review CSAT ratings days or weeks after poor interactions occur.`,
        },
        {
          youSaid: `Actions like booking appointments, generating quotes, or updating CRM tickets still require manual copy-pasting.`,
          today: `The AI provides text answers but cannot securely invoke internal APIs or perform real backend updates.`,
        },
        {
          youSaid: `Sensitive corporate data must not be leaked or used to train public foundation models.`,
          today: `Employees use unvetted consumer AI tools, creating severe intellectual property and compliance vulnerabilities.`,
        },
        {
          youSaid: `The system must continually learn from human corrections and track accuracy metrics over time.`,
          today: `There is no evaluation harness to benchmark whether prompts or model upgrades improve resolution rates.`,
        },
      ],
      workflows: [
        {
          title: 'Omnichannel Inquiry Ingestion & Classification',
          today: 'Today: Inbound emails, chats, and forms sit in a disorganized queue',
          assisted: 'AI classifies user intent, sentiment, and urgency in milliseconds, routing to the specialized agent',
          badge: 'Agent Gateway',
        },
        {
          title: 'Contextual RAG Knowledge Retrieval',
          today: 'Today: Support agents search through 20 different knowledge base docs',
          assisted: 'Vector search retrieves verified company documents and cites exact source paragraphs for grounding',
          badge: 'RAG Pipeline',
        },
        {
          title: 'Autonomous Tool & API Execution',
          today: 'Today: Agent reads answer, then switches tabs to update CRM/ERP manually',
          assisted: 'Agent executes verified API calls (create order, update ticket, reschedule date) with safety parameters',
          badge: 'Tool Execution',
        },
        {
          title: 'Human-in-the-Loop Approval Gate',
          today: 'Today: All actions either fully manual or unmonitored',
          assisted: 'High-stakes decisions (refunds, contract alterations) present a 1-click approval prompt to managers',
          badge: 'Human-in-the-Loop',
        },
        {
          title: 'Real-Time Hallucination & PII Guardrail',
          today: 'Today: Chatbot responses risk exposing sensitive data or false claims',
          assisted: 'Guardrail engine verifies factual accuracy against retrieved context and redacts PII before transmission',
          badge: 'Safety Sentinel',
        },
        {
          title: 'Seamless Agent-to-Human Handover',
          today: 'Today: Customer has to repeat their entire story when escalated',
          assisted: 'Instant live handover with concise bullet-point conversation summary presented to the human agent',
          badge: 'Handover Engine',
        },
        {
          title: 'Post-Conversation CRM & Ticket Resolution',
          today: 'Today: Agents spend 10 minutes typing wrap-up notes per conversation',
          assisted: 'AI writes structured summary, logs action taken, and tags the CRM record automatically upon closure',
          badge: 'CRM Automation',
        },
        {
          title: 'Continuous Evaluation & Feedback Learning',
          today: 'Today: No visibility into prompt quality or model drift',
          assisted: 'Human edits and positive/negative user feedback benchmarked into golden dataset for continuous tuning',
          badge: 'Eval Harness',
        },
        {
          title: 'Leadership AI Performance Analytics',
          today: 'Today: Support performance metrics are estimated or delayed',
          assisted: 'Real-time dashboard tracking deflection rate, resolution speed, top customer pain points, and CSAT',
          badge: 'Analytics Hub',
        },
      ],
      modules: [
        { title: 'Omnichannel Chat & Voice Gateway', desc: 'Unified API connecting Web Chat, WhatsApp, Slack, Email, and Voice channels into a single event stream.' },
        { title: 'Multi-Agent Orchestration Hub', desc: 'LangChain/LangGraph-based agent coordinator directing tasks to specialized domain agents (Support, Sales, Operations).' },
        { title: 'Enterprise RAG & Vector Memory Vault', desc: 'High-performance vector database indexing company docs, FAQs, policies, and past successful resolutions.' },
        { title: 'Tool Execution & API Integration Bridge', desc: 'Secure function-calling middleware executing transactional queries against internal databases and third-party APIs.' },
        { title: 'Security Guardrails & PII Masking Engine', desc: 'NeMo/Llama-Guard security layer preventing prompt injection, jailbreaks, PII leakage, and off-topic conversations.' },
        { title: 'Human-in-the-Loop Review Console', desc: 'Real-time web console where supervisors review pending agent actions, override responses, and monitor live chats.' },
        { title: 'Conversation Memory & Session Vault', desc: 'Short-term and long-term user memory tracking historical preferences and previous interactions.' },
        { title: 'Automated Ticket & CRM Sync Bridge', desc: 'Two-way integration logging conversation transcripts, structured outcomes, and customer sentiment into CRM.' },
        { title: 'Evaluation & Golden Dataset Harness', desc: 'Automated CI/CD testing suite running synthetic benchmark queries to measure accuracy before prompt deployments.' },
        { title: 'Executive AI Command Center', desc: 'Real-time dashboard displaying resolution rate, average handle time reduction, cost per query, and CSAT scores.' },
      ],
      aiCapabilities: [
        { title: 'Intent Classifier', desc: 'Identifies the customer’s true operational goal across 50+ business categories in under 100ms.' },
        { title: 'Contextual RAG Searcher', desc: 'Performs hybrid semantic and keyword search across internal documents with relevance reranking.' },
        { title: 'Structured Data Extractor', desc: 'Extracts names, dates, amounts, and tracking numbers from messy user messages into valid JSON.' },
        { title: 'Hallucination Sentinel', desc: 'Cross-verifies generated answers against retrieved knowledge base snippets to guarantee truthfulness.' },
        { title: 'Tone & Empathy Adapter', desc: 'Modulates language tone from empathetic for complaints to concise for technical answers.' },
        { title: 'Multi-Lingual Translator', desc: 'Translates conversations back and forth across 20+ global and regional languages in real-time.' },
        { title: 'Action Function Caller', desc: 'Synthesizes clean API parameters and calls internal microservices to execute tasks.' },
        { title: 'Conversation Summarizer', desc: 'Compresses long 30-message support threads into a 4-bullet executive briefing for human agents.' },
        { title: 'Sentiment & Escalation Detector', desc: 'Measures emotional sentiment and triggers immediate VIP supervisor escalation if frustration rises.' },
        { title: 'Document OCR & Attachment Reader', desc: 'Reads uploaded receipts, screenshots, and PDF contracts attached during the chat.' },
        { title: 'Clarification Question Asker', desc: 'Detects ambiguous queries and asks targeted multiple-choice questions to resolve ambiguity.' },
        { title: 'FAQ Synthesizer', desc: 'Discovers repeated unanswered questions from chat logs and drafts candidate knowledge base articles.' },
        { title: 'Security Prompt-Injection Guard', desc: 'Neutralizes adversarial prompt injections and attempts to bypass enterprise instructions.' },
        { title: 'CSAT Prediction Engine', desc: 'Forecasts customer satisfaction score before the user even completes the survey.' },
      ],
      automationsList: [
        'Instant greeting and intent routing triggered within 50ms of user message',
        'Automated RAG knowledge retrieval executed on every customer question',
        'Automatic CRM lead or support ticket created when conversation begins',
        'Manager alert dispatched to Slack when customer sentiment drops below critical threshold',
        'Automated calendar scheduling link dispatched when meeting intent is confirmed',
        'One-click supervisor approval email dispatched for refunds or policy exceptions',
        'Automatic ticket closure and resolution summary logged to CRM upon customer goodbye',
        'Automated CSAT rating prompt dispatched 5 minutes after conversation completion',
        'Daily automated batch indexing of newly edited company Notion / Google Docs',
        'Weekly automated evaluation report benchmarked against golden test dataset',
        'Instant notification dispatched to engineering if LLM API rate limits are approached',
        'Automated conversation redaction of credit cards and passwords before database storage',
        'Weekly executive summary email outlining top customer inquiries and deflection rate',
        'Automated alert sent to content team when a customer asks an unanswered question',
      ],
    };
  }

  // Generalized High-Performance Enterprise Platform (Default for Idea to Launch, SaaS, Others)
  return {
    heroHeadline: `The ${company_name} ${project_title}: Unified Digital Platform, Workflow Automation & Real-Time Intelligence.`,
    heroSubheadline: user_prompt.trim()
      ? `${user_prompt.trim()} — engineered by NexInt AI as a modern, high-performance web and mobile application with end-to-end automation and role-based controls.`
      : `Transform your operational workflows into a unified digital ecosystem: bespoke software architecture, automated approval pipelines, real-time analytics, and seamless third-party integrations.`,
    whatSummary: `${project_title}: responsive web application, mobile-optimized experience, and administrative command center`,
    whoItServes: `Operations leadership, department heads, project managers, delivery teams, and external stakeholders`,
    aiAndAutomationSummary: `14 intelligent software capabilities and 14 automated system workflows, from automated intake and document verification to real-time analytics`,
    worksWithSummary: `Cloud infrastructure (AWS/GCP), external REST/GraphQL APIs, CRM & ERP systems, WhatsApp/Email notifications, and payment gateways`,
    runningCostSummary:
      currency === 'INR'
        ? `About ₹20,000–30,000 / month from go-live: cloud hosting & database ₹10,000, 24/7 SLA maintenance ₹15,000, plus actual third-party API usage`
        : `Predictable monthly operations: scalable cloud hosting, database backups, 24/7 SLA maintenance, and third-party API usage at actual cost`,
    whatWeHeardHeadline: `What we heard from ${company_name} on operational goals & technical requirements:`,
    whatWeHeardIntro: `Your organization needs a dedicated, modern platform built specifically for your workflows rather than generic off-the-shelf software:`,
    whatWeHeardItems: [
      {
        youSaid: customFeature1,
        today: `Core operational data is fragmented across spreadsheets, chat messages, and disparate single-purpose tools.`,
      },
      {
        youSaid: customFeature2,
        today: `Manual handoffs between departments cause avoidable delays, communication lapses, and missed deadlines.`,
      },
      {
        youSaid: customFeature3,
        today: `Leadership lacks a real-time, consolidated dashboard showing project status, commercial margins, and team throughput.`,
      },
      {
        youSaid: customFeature4,
        today: `Routine administrative tasks (status chasing, data entry, report compilation) consume valuable team hours.`,
      },
      {
        youSaid: `User roles and permissions are loosely enforced, creating data security and operational governance risks.`,
        today: `Everyone has access to everything or files are shared via unsecured email attachments.`,
      },
      {
        youSaid: `The organization needs an intuitive, mobile-friendly interface that both internal staff and external partners adopt easily.`,
        today: `Legacy enterprise tools are clunky, slow to load, and require extensive training to perform basic tasks.`,
      },
      {
        youSaid: `Business processes and operational volume are scaling, but existing systems cannot handle increased load.`,
        today: `Manual processes hit severe bottlenecks as transaction volume grows month-over-month.`,
      },
      {
        youSaid: `All custom code, data, and cloud infrastructure must be 100% owned by ${company_name} without vendor lock-in.`,
        today: `SaaS vendors charge escalating per-seat licenses while keeping customer data locked in proprietary silos.`,
      },
    ],
    workflows: [
      {
        title: 'Digital Intake & Onboarding',
        today: 'Today: Manual email back-and-forth and unstandardized spreadsheets',
        assisted: 'Self-service digital onboarding portal; automatically validates inputs, checks duplicates, and notifies owners',
        badge: 'Portal Engine',
      },
      {
        title: 'Automated Status & Milestone Tracking',
        today: 'Today: Managers spend hours in meetings asking "what is the update?"',
        assisted: 'Real-time stage transitions trigger automated notifications, milestone updates, and deadline reminders',
        badge: 'Workflow Automation',
      },
      {
        title: 'Document & Agreement Verification',
        today: 'Today: Documents reviewed by eye and filed manually into shared drives',
        assisted: 'Automated document processing, e-signature dispatch, and secure cloud archiving with expiry tracking',
        badge: 'Document Sentinel',
      },
      {
        title: 'Multi-Level Approval Matrix',
        today: 'Today: Approvals get stuck in email inboxes with zero visibility',
        assisted: 'Configurable approval rules route requests to designated managers with 1-click approvals on mobile',
        badge: 'Approval Gateway',
      },
      {
        title: 'Commercial & Financial Tracking',
        today: 'Today: Budgets, vendor payments, and costs tracked on separate sheets',
        assisted: 'Unified commercial ledger tracking budgets, actual costs, vendor payments, and net profit margins in real-time',
        badge: 'Financial Ledger',
      },
      {
        title: 'Two-Way System Integration',
        today: 'Today: Data re-typed between CRM, accounting, and task tools',
        assisted: 'Real-time REST API webhooks synchronize records bidirectionally across external tools without manual intervention',
        badge: 'API Bridge',
      },
      {
        title: 'Customer & Partner Feedback Collection',
        today: 'Today: Feedback rarely requested or captured in unstructured emails',
        assisted: 'Automated CSAT surveys triggered upon milestone completion with AI sentiment analysis and executive alerts',
        badge: 'Quality Engine',
      },
      {
        title: 'Intelligent Operational Q&A',
        today: 'Today: Finding specific historical information requires asking colleagues',
        assisted: 'Plain-language semantic search over all historical project data, contracts, and notes with instant answers',
        badge: 'Intelligent Search',
      },
      {
        title: 'Automated Executive Reporting',
        today: 'Today: Assembling monthly performance decks takes 2 days of manual work',
        assisted: 'Automated weekly and monthly performance reports generated and delivered directly to leadership inboxes',
        badge: 'Executive Analytics',
      },
    ],
    modules: [
      { title: 'Core Operations & Master Directory', desc: 'Centralized relational master database with advanced filtering, sorting, custom tagging, and audit history.' },
      { title: 'External Partner & Client Portal', desc: 'Branded self-service portal allowing clients and external collaborators to submit requests and track progress.' },
      { title: 'Workflow & Milestone Orchestrator', desc: 'Visual Kanban boards, interactive Gantt timelines, and configurable stage-gate delivery pipelines.' },
      { title: 'Commercial Budget & Profit Tracker', desc: 'Granular budget allocation, vendor payment logging (AWS, contractors, resources), and automated net margin calculator.' },
      { title: 'Role-Based Access & Governance (RBAC)', desc: 'Granular permissions matrix distinguishing Admins, Managers, and Members with complete access audit logs.' },
      { title: 'Document Vault & E-Signature Hub', desc: 'Secure cloud file repository with version control, automated document generation, and digital signature routing.' },
      { title: 'Omnichannel Notification Engine', desc: 'Automated email, WhatsApp, and in-app notifications with customizable triggers and schedule rules.' },
      { title: 'Two-Way Third-Party Integration Bridge', desc: 'RESTful API gateway and webhook processors connecting CRM, ERP, finance, and task management systems.' },
      { title: 'Quality Assurance & Feedback Engine', desc: 'Standardized rating scales, CSAT score tracking, review actions, and testimonial showcase toggles.' },
      { title: 'Executive Command & Analytics Dashboard', desc: 'Real-time KPI metrics, revenue breakdowns by source, delivery velocity charts, and exportable CSV reports.' },
    ],
    aiCapabilities: [
      { title: 'Smart Data Ingestion', desc: 'Parses legacy spreadsheets, cleans formatting inconsistencies, and maps fields to database schemas automatically.' },
      { title: 'Semantic Document Reader', desc: 'Extracts critical clauses, renewal dates, and payment amounts from PDF agreements and contracts.' },
      { title: 'Anomaly & Outlier Detector', desc: 'Identifies budget overruns, unusual cost spikes, and stalled milestones before delivery is impacted.' },
      { title: 'Intelligent Resource Matcher', desc: 'Recommends team members and external partners based on skills, past ratings, and real-time capacity.' },
      { title: 'Automated Brief Pre-Filler', desc: 'Turns unstructured user emails into structured work orders with scope line items and estimated timelines.' },
      { title: 'Natural Language Q&A', desc: 'Allows team members to ask plain-language questions across corporate projects, notes, and metrics.' },
      { title: 'Executive Summary Generator', desc: 'Condenses complex multi-week project progress into crisp executive bullet points for client updates.' },
      { title: 'Sentiment & Feedback Analyzer', desc: 'Categorizes client reviews into actionable sentiment trends (Positive, Neutral, Negative) with highlighted risks.' },
      { title: 'Task Effort Estimator', desc: 'Estimates timeline weeks and resource hours for new deliverables based on historical delivery data.' },
      { title: 'Notification Urgency Classifier', desc: 'Prioritizes urgent alerts and suppresses low-priority noise during critical delivery sprints.' },
      { title: 'Vendor Quote Equalizer', desc: 'Standardizes vendor quotes in different currencies and formats into unified comparison matrices.' },
      { title: 'Automated SLA Sentinel', desc: 'Calculates SLA breach probabilities and re-orders task priority queues to prevent contract penalties.' },
      { title: 'Weekly Digest Writer', desc: 'Composes weekly operational briefings highlighting achievements, open blockers, and upcoming deadlines.' },
      { title: 'Audit Trail Sentinel', desc: 'Scans audit logs for unusual permission changes, abnormal deletion patterns, or security anomalies.' },
    ],
    automationsList: [
      'Self-onboarding link generated and sent upon prospective account creation',
      'Automated milestone status update dispatched to client when task is marked Done',
      'Budget threshold alert dispatched to manager when costs exceed 80% of budget',
      'Real-time Slack / WhatsApp notification when high-priority ticket is created',
      'Automated contract renewal reminder dispatched 30 days prior to expiry',
      'Weekly automated database backup and health check execution',
      'Automated CSV export generation scheduled for monthly finance reconciliation',
      'Customer CSAT survey sent automatically 24 hours after project completion',
      'Automated invoice payment status sync between platform and finance system',
      'Overdue follow-up check-in reminder highlighted on dashboard every morning',
      'Automated password reset and account verification email pipeline',
      'One-click proposal generation dispatched with synchronized lead status transition',
      'Automatic archiving of completed projects after 90 days of inactivity',
      'Weekly Monday morning leadership digest delivered with active revenue numbers',
    ],
  };
}

export function buildNexIntMasterProposal(params: {
  company_name: string;
  recipient_name: string;
  recipient_email: string;
  project_title: string;
  service_type: string;
  budget: number;
  currency: string;
  timeline_weeks: number;
  key_requirements: string;
  user_prompt?: string;
  tone?: string;
  sender_name: string;
  aiCustom?: StructuredProposalContent;
}) {
  const {
    company_name,
    recipient_name,
    project_title,
    service_type,
    budget,
    currency = 'INR',
    timeline_weeks = 12,
    key_requirements,
    user_prompt = '',
    sender_name,
    aiCustom = {},
  } = params;

  const logoMarkUri = getNexIntLogoMarkUri();
  const logoFullUri = getNexIntLogoFullUri();

  const totalWeeks = Math.max(4, Number(timeline_weeks || 12));
  const completeWeeks = totalWeeks + 3;
  const firstValueWeek = Math.max(2, Math.round(totalWeeks * 0.42));

  const recBudget = Number(budget || 950000);
  const discountAmt = Math.round(recBudget * 0.021 / 5000) * 5000 || 20000;
  const sumIncludedPhases = recBudget + discountAmt;
  const phase4OptAmt = Math.round(recBudget * 0.18 / 5000) * 5000 || 170000;
  const completeSumPhases = sumIncludedPhases + phase4OptAmt;
  const completeDiscount = Math.round(discountAmt * 3.25 / 5000) * 5000 || 65000;
  const completeBudget = completeSumPhases - completeDiscount;

  // Phase breakdown amounts summing to sumIncludedPhases
  const p0Amt = Math.round((sumIncludedPhases * 0.1) / 5000) * 5000;
  const p1Amt = Math.round((sumIncludedPhases * 0.27) / 5000) * 5000;
  const p2Amt = Math.round((sumIncludedPhases * 0.41) / 5000) * 5000;
  const p3Amt = sumIncludedPhases - p0Amt - p1Amt - p2Amt;

  // Payment milestones summing to recBudget
  const mWorkOrder = Math.round(recBudget * 0.15);
  const mPhase0 = Math.round(recBudget * 0.1);
  const mPhase1 = Math.round(recBudget * 0.25);
  const mPhase2 = Math.round(recBudget * 0.3);
  const mPhase3 = recBudget - mWorkOrder - mPhase0 - mPhase1 - mPhase2;

  // Phase week durations
  const w0 = Math.max(1, Math.round(totalWeeks * 0.17));
  const w1 = Math.max(2, Math.round(totalWeeks * 0.25));
  const w2 = Math.max(2, Math.round(totalWeeks * 0.33));
  const w3 = Math.max(1, totalWeeks - w0 - w1 - w2);

  const curSym = getCurrencySymbol(currency);
  const fmtRec = formatMoney(recBudget, currency);
  const fmtComplete = formatMoney(completeBudget, currency);

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Parse prompt and requirements for custom items
  const combinedPrompt = [user_prompt, key_requirements].filter(Boolean).join('\n');
  const promptLines = combinedPrompt
    .split(/\n|•|;/)
    .map((s) => s.replace(/^[-*]\s*/, '').trim())
    .filter((s) => s.length > 5);

  const heroHeadline =
    aiCustom.heroHeadline ||
    `The ${company_name} ${project_title}: one AI-powered app for your entire operation.`;

  const heroSubheadline =
    aiCustom.heroSubheadline ||
    (user_prompt.trim()
      ? `${user_prompt.trim()} — engineered as a unified, AI-powered web platform and self-service portal connected seamlessly to your existing tools.`
      : `From discovering and onboarding partners, managing workflows and matching briefs to comparing quotes, automating approvals, tracking milestones and collecting feedback — working alongside your existing CRM, project management and finance stack.`);

  const whatSummary =
    aiCustom.whatSummary ||
    `${project_title}: one responsive web app for laptop and phone, plus a self-service external portal`;

  const whoItServes =
    aiCustom.whoItServes ||
    `Leadership, operations & strategy leads, delivery teams, finance, and your external stakeholders & partners`;

  const aiAndAutomationSummary =
    aiCustom.aiAndAutomationSummary ||
    `14 AI capabilities and 14 automations, from reading a brief and shortlisting top matches to checking invoices against POs and chasing feedback`;

  const worksWithSummary =
    aiCustom.worksWithSummary ||
    `CRM (clients and pitches), ClickUp / Jira (tasks), Finance ERP (POs & invoices), e-signature, email and WhatsApp`;

  const runningCostSummary =
    aiCustom.runningCostSummary ||
    (currency === 'INR'
      ? `About ₹25,000–30,000 a month from go-live: support ₹15,000, hosting ~₹7,000 and AI usage ₹3,000–8,000, plus GST`
      : `Predictable monthly operations from go-live: managed support, cloud hosting, and capped AI API usage at actual cost`);

  const whatWeHeardItems: Array<{ youSaid: string; today: string }> =
    aiCustom.whatWeHeardItems && aiCustom.whatWeHeardItems.length >= 4
      ? aiCustom.whatWeHeardItems
      : [
          {
            youSaid:
              promptLines[0] ||
              `Core records and partner data live in multi-tab spreadsheets: contacts, capabilities, ratings, feedback and status`,
            today: `Hard to search across tabs, refreshed by hand; duplicates and stale details creep in`,
          },
          {
            youSaid:
              promptLines[1] ||
              `Every new brief or requirement goes to multiple stakeholders; quotes and proposals arrive in different formats`,
            today: `Shortlisting depends on memory; quotes arrive in different formats; selection reasons are not recorded`,
          },
          {
            youSaid:
              promptLines[2] ||
              `Agreements, NDAs and contracts need signatures from specific signatories and automated reminders`,
            today: `Someone has to manually chase every signature and file signed copies by hand`,
          },
          {
            youSaid:
              promptLines[3] ||
              `After delivery, invoices go to finance for approval, PO matching, and payment confirmation`,
            today: `Approvals and payment status sit in email and the finance system; nobody sees the whole picture`,
          },
          {
            youSaid:
              promptLines[4] ||
              `Leadership wants to know where every project stands end-to-end: agreement, PO, delivery, invoice, closed`,
            today: `There is no single stage view; task tools hold tasks, not commercial milestones`,
          },
          {
            youSaid:
              promptLines[5] ||
              `Internal ratings and post-delivery feedback need to be captured systematically after every engagement`,
            today: `Feedback is late or missing in forms, and is not used when the next decision is made`,
          },
          {
            youSaid: `Master profiles, capabilities, and pricing details change over time`,
            today: `Nobody has time to manually re-check hundreds of records every quarter`,
          },
          {
            youSaid: `Later, you want to expand into end-to-end client briefs, KPIs, and deeper delivery automation`,
            today: `The platform must be built on a modular architecture to grow, not as a one-off tool`,
          },
        ];

  const workflows =
    aiCustom.workflows && aiCustom.workflows.length >= 5
      ? aiCustom.workflows
      : [
          {
            title: 'Onboarding & data capture',
            today: 'Today: type a row, check duplicates by eye',
            assisted:
              'Self-onboarding link; AI checks for duplicates and enriches gaps from websites and public profiles',
            badge: 'Portal, AI · lead approves',
          },
          {
            title: 'NDA and contract',
            today: 'Today: send, chase, file',
            assisted:
              'Sent for e-signature from the record to the right signatory; automated reminders until signed; signed copy filed',
            badge: 'Automation',
          },
          {
            title: 'Keeping profiles current',
            today: 'Today: rarely done',
            assisted:
              'Every 2–3 months AI re-checks websites and public profiles and proposes updates for one-click review',
            badge: 'AI · owner accepts or rejects',
          },
          {
            title: 'Brief to shortlist',
            today: 'Today: think of who might fit',
            assisted:
              'Upload the brief or sync from CRM; AI reads requirements and recommends the top 3 matches with reasons and cost band',
            badge: 'AI · account lead picks',
          },
          {
            title: 'RFQ and quote comparison',
            today: 'Today: email each party, compare by hand',
            assisted:
              'White-labelled RFQs drafted and sent; AI turns every quote into comparable line items and flags outliers',
            badge: 'AI and automation · selector decides',
          },
          {
            title: 'Appointment and PO',
            today: 'Today: contract and PO typed separately',
            assisted:
              'PO drafted automatically from the accepted quote line items; CRM and project boards updated in real time',
            badge: 'AI and automation · approver releases',
          },
          {
            title: 'Invoice to payment',
            today: 'Today: email finance, wait, email back',
            assisted:
              'Invoice uploaded against the PO; AI checks amounts and tax/GST details; routed to the right approver; payment advice emailed',
            badge: 'AI and automation · finance approves',
          },
          {
            title: 'Feedback & ratings',
            today: 'Today: manual forms and reminders',
            assisted:
              'When work completes, rating requests go to internal leads and experience surveys go out automatically with escalation',
            badge: 'Automation · AI summarises',
          },
          {
            title: 'Answering a question',
            today: 'Today: open several tabs',
            assisted: `Ask in plain language, e.g. "Which top-rated partners delivered under budget this quarter?"`,
            badge: 'AI, from your own data',
          },
        ];

  const modules =
    aiCustom.modules && aiCustom.modules.length >= 6
      ? aiCustom.modules
      : [
          {
            title: 'Unified Master Directory',
            desc: 'All records, partners, capabilities, rate cards, documents and history in one searchable hub with controlled tags and filters.',
          },
          {
            title: 'Onboarding and agreements',
            desc: 'Self-onboarding portal link, NDA and contract e-signature routed to the right signatory, verification checklist, expiry alerts.',
          },
          {
            title: 'Briefs and opportunities',
            desc: 'Briefs synced from CRM or uploaded files, internal sign-off gate before appointment, delivery approach, and budget tracking.',
          },
          {
            title: 'AI Selection & RFQs',
            desc: 'AI shortlist, automated RFQs, side-by-side quote comparison, Primary/Backup/Trial bench, and recorded selection rationale.',
          },
          {
            title: 'Projects and stages',
            desc: 'Single stage view for every pitch, project and retainer from brief to closed, synced two-way with your task management tool.',
          },
          {
            title: 'Procure to pay',
            desc: 'PO generated from accepted quote, invoice upload against PO, AI verification, finance approval thresholds, and payment advice.',
          },
          {
            title: 'Ratings and feedback',
            desc: 'Multi-dimension rating requests triggered automatically upon completion, plus external experience surveys and reminders.',
          },
          {
            title: 'Specialist & resource bench',
            desc: 'Searchable bench by domain, region, language, category, price band, rating and real-time availability.',
          },
          {
            title: 'Dashboards and Ask AI',
            desc: 'Leadership overview, pipeline-to-delivery visibility, exception tracking, plus plain-language Q&A over your live data.',
          },
          {
            title: 'Administration & governance',
            desc: 'Role-based permissions matrix, full audit log, controlled taxonomy lists, document templates, and one-click full export.',
          },
        ];

  const aiCapabilities =
    aiCustom.aiCapabilities && aiCustom.aiCapabilities.length >= 8
      ? aiCustom.aiCapabilities
      : [
          {
            title: 'Smart import',
            desc: 'Moves your existing sheets and tabs into the platform, mapping columns, normalising values, and flagging duplicates.',
          },
          {
            title: 'Profile enrichment',
            desc: 'Fills and refreshes profiles from websites and public sources every 2–3 months, as suggestions you approve.',
          },
          {
            title: 'Portfolio tagging',
            desc: 'Automatically tags work samples and records to your industry categories, capabilities and sub-services.',
          },
          {
            title: 'Brief reader',
            desc: 'Pre-fills client, scope, deliverables, budget and timeline from a brief document, email or call notes.',
          },
          {
            title: 'Intelligent match',
            desc: 'Recommends the top 3 matches per requirement with clear reasons: capability, ratings, cost band, availability.',
          },
          {
            title: 'RFQ writer',
            desc: 'Drafts a clean, white-labelled RFQ or scope document for each shortlisted partner.',
          },
          {
            title: 'Quote comparison',
            desc: 'Turns quotes in any format into comparable line items and flags anomalies against rate cards and past costs.',
          },
          {
            title: 'PO drafter',
            desc: 'Builds the purchase order automatically from the accepted quote line items.',
          },
          {
            title: 'Invoice checker',
            desc: 'Checks each invoice against its PO, validates tax/GST details, and flags duplicates before finance review.',
          },
          {
            title: 'Feedback summary',
            desc: 'Turns ratings and review remarks into actionable strengths, risks and performance trends.',
          },
          {
            title: 'Quality pre-check',
            desc: 'Checks deliverables and drafts against client guidelines and checklists before final review.',
          },
          {
            title: `Ask ${company_name} Hub`,
            desc: 'Answers plain-language questions from your own operational data, strictly within each user’s permissions.',
          },
          {
            title: 'Weekly digest',
            desc: 'A concise Monday summary of active pipeline, bottlenecks, exceptions and delivery performance.',
          },
          {
            title: 'Discovery assistant',
            desc: 'Identifies coverage gaps in your operational bench and drafts targeted outreach.',
          },
        ];

  const automationsList =
    aiCustom.automationsList && aiCustom.automationsList.length >= 6
      ? aiCustom.automationsList
      : [
          'Onboarding links',
          'NDA and contract reminders and escalation',
          'Document renewal alerts',
          'CRM two-way sync',
          'Task board sync',
          'RFQ follow-ups',
          'Notices to unsuccessful bidders',
          'PO drafting on selection',
          'Invoice routing',
          'Payment advice',
          'Rating requests and surveys on completion',
          'Reminders for unreturned feedback',
          'Quarterly profile refresh',
          'Weekly leadership digest',
        ];

  const endToEndSteps =
    aiCustom.endToEndSteps && aiCustom.endToEndSteps.length >= 6
      ? aiCustom.endToEndSteps
      : [
          {
            title: 'Discover and onboard',
            desc: 'Web enrichment, duplicate check, NDA e-sign with automated reminders',
          },
          {
            title: 'Brief received',
            desc: 'AI reads the brief; prefills scope, markets, deliverables and timeline',
          },
          {
            title: 'Match and send RFQ',
            desc: 'AI ranks top 3 matches with reasons; white-labelled RFQs drafted and sent',
          },
          {
            title: 'Compare and appoint',
            desc: 'AI turns quotes into comparable line items, flags outliers vs rate card',
          },
          {
            title: 'Deliver and review',
            desc: 'Task board sync, stage alerts, quality pre-check, and review gate',
          },
          {
            title: 'PO, invoice and payment',
            desc: 'PO from quote lines, AI invoice check, finance approvals, payment advice',
          },
          {
            title: 'Feedback and ratings',
            desc: 'Ratings routed by role, external survey auto-sent, AI executive summary',
          },
          {
            title: 'Insight and reporting',
            desc: `Live leadership dashboards, Ask ${company_name} AI, weekly digest`,
          },
        ];

  const email_subject = `Proposal: ${project_title} for ${company_name} — NexInt AI`;

  const email_body = `Hi ${recipient_name},

Thank you for our conversation regarding ${company_name}'s ${service_type.toLowerCase()} initiative. We have prepared the complete interactive proposal for "${project_title}" below.

At a glance:
• Recommended Investment: ${fmtRec} (one-time, across 4 signed-off phases)
• Quick-start: Week 1 (migration-ready data master & taxonomy)
• First value: Week ${firstValueWeek} (core platform live with your data)
• Full go-live: Week ${totalWeeks} (100% owned by ${company_name} — data, code & credentials)

You can review the full 16-section proposal below — including what we heard, workflow automations, architecture, delivery plan, and phase-by-phase investment — and accept the proposal directly at the bottom.

Warm regards,
${sender_name}
NexInt AI Solutions Pvt Ltd · Chennai
info@nexintai.com · nexintai.com`;

  const brandLockupTopHtml = logoFullUri
    ? `<img src="${logoFullUri}" alt="NexInt AI" style="height: 34px; width: auto; object-fit: contain; display: block;" />`
    : `<div style="display:flex;align-items:center;gap:10px;">
        <img src="${logoMarkUri}" alt="NexInt AI" style="height:30px;width:30px;object-fit:contain;" />
        <div>
          <div style="font-size:18px;font-weight:800;color:#0F2547;line-height:1;">NexInt <span style="color:#3596B0;">AI</span></div>
          <div style="font-size:7px;letter-spacing:0.22em;color:#64748b;font-weight:700;margin-top:2px;">INTELLIGENCE BEYOND DATA</div>
        </div>
      </div>`;

  const brandLockupHeroCardHtml = logoFullUri
    ? `<img src="${logoFullUri}" alt="NexInt AI — Intelligence Beyond Data" style="max-width: 290px; width: 100%; height: auto; object-fit: contain; margin: 0 auto; display: block;" />`
    : `<div style="display:flex;align-items:center;justify-content:center;gap:16px;">
        <img src="${logoMarkUri}" alt="NexInt AI" style="height:64px;width:64px;object-fit:contain;" />
        <div style="text-align:left;">
          <div style="font-size:38px;font-weight:800;color:#0F2547;line-height:1;">NexInt <span style="color:#3596B0;">AI</span></div>
          <div style="font-size:10px;letter-spacing:0.24em;color:#475569;font-weight:700;margin-top:6px;">INTELLIGENCE BEYOND DATA</div>
        </div>
      </div>`;

  const html_proposal = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project_title} — Proposal for ${company_name} | NexInt AI</title>
  <style>
    :root {
      --navy-dark: #0B1B36;
      --navy: #0F2547;
      --navy-mid: #16325B;
      --teal: #3596B0;
      --teal-light: #58B4CD;
      --teal-tint: #E6F4F8;
      --bg-soft: #F8FAFC;
      --text-main: #0F172A;
      --text-body: #334155;
      --text-muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    a { text-decoration: none; color: inherit; }
    .container {
      max-width: 1060px;
      margin: 0 auto;
      padding: 0 40px;
    }
    @media (max-width: 768px) {
      .container { padding: 0 20px; }
    }

    /* Sticky Top Navbar */
    .top-nav {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      padding: 14px 0;
    }
    .top-nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 22px;
      flex-wrap: wrap;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-body);
    }
    .nav-links a:hover { color: var(--teal); }
    .nav-cta {
      background: var(--navy);
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 12.5px;
      padding: 9px 18px;
      border-radius: 999px;
      transition: background 0.15s;
    }
    .nav-cta:hover { background: var(--teal); }

    /* Hero Section */
    .hero {
      background: var(--navy-dark);
      color: #FFFFFF;
      padding: 68px 0 64px;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1.25fr 0.9fr;
      gap: 48px;
      align-items: center;
    }
    @media (max-width: 860px) {
      .hero-grid { grid-template-columns: 1fr; }
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--teal-light);
      margin-bottom: 16px;
    }
    .hero h1 {
      font-size: 42px;
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -0.025em;
      margin: 0 0 20px 0;
      color: #FFFFFF;
    }
    .hero-desc {
      font-size: 15.5px;
      line-height: 1.65;
      color: #CBD5E1;
      margin: 0 0 28px 0;
    }
    .hero-btns {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 36px;
      flex-wrap: wrap;
    }
    .btn-teal {
      background: var(--teal);
      color: #FFFFFF;
      font-weight: 700;
      font-size: 13.5px;
      padding: 11px 24px;
      border-radius: 999px;
      display: inline-block;
    }
    .btn-outline-light {
      border: 1px solid rgba(255,255,255,0.3);
      color: #FFFFFF;
      font-weight: 600;
      font-size: 13.5px;
      padding: 11px 24px;
      border-radius: 999px;
      display: inline-block;
    }
    .hero-meta {
      border-top: 1px solid rgba(255,255,255,0.12);
      padding-top: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      font-size: 12.5px;
    }
    .meta-label {
      font-size: 11px;
      color: #94A3B8;
      margin-bottom: 2px;
    }
    .meta-val {
      font-weight: 700;
      color: #FFFFFF;
    }
    .hero-logo-card {
      background: #FFFFFF;
      border-radius: 16px;
      padding: 44px 32px 28px;
      text-align: center;
      color: var(--navy);
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
    }
    .hero-logo-caption {
      border-top: 1px solid var(--border);
      margin-top: 32px;
      padding-top: 16px;
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* 5-Card KPI Strip */
    .kpi-strip {
      background: var(--bg-soft);
      padding: 36px 0;
      border-bottom: 1px solid var(--border);
    }
    .kpi-grid-5 {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
    }
    @media (max-width: 900px) {
      .kpi-grid-5 { grid-template-columns: repeat(2, 1fr); }
    }
    .kpi-card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 18px;
    }
    .kpi-card-label {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .kpi-card-val {
      font-size: 26px;
      font-weight: 800;
      color: var(--navy);
      line-height: 1.15;
      margin-bottom: 6px;
    }
    .kpi-card-sub {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* Standard Section Spacing & Headings */
    .section {
      padding: 64px 0;
      border-bottom: 1px solid var(--border);
    }
    .section-soft {
      background: var(--bg-soft);
      padding: 64px 0;
      border-bottom: 1px solid var(--border);
    }
    .section-dark {
      background: var(--navy-dark);
      color: #FFFFFF;
      padding: 68px 0;
    }
    .sec-eyebrow {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--teal);
      margin-bottom: 10px;
    }
    .sec-h2 {
      font-size: 32px;
      font-weight: 800;
      color: var(--navy);
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin: 0 0 12px 0;
    }
    .section-dark .sec-h2 { color: #FFFFFF; }
    .sec-lead {
      font-size: 15.5px;
      color: var(--text-body);
      max-width: 720px;
      margin: 0 0 32px 0;
    }
    .section-dark .sec-lead { color: #CBD5E1; }

    /* At a Glance 2x3 Table Grid */
    .glance-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      background: #FFFFFF;
    }
    @media (max-width: 820px) {
      .glance-grid { grid-template-columns: 1fr; }
    }
    .glance-cell {
      padding: 22px 24px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      display: grid;
      grid-template-columns: 95px 1fr;
      gap: 14px;
      font-size: 13px;
    }
    .glance-label {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }
    .glance-val {
      color: var(--text-main);
      line-height: 1.55;
    }

    /* 01 What We Heard Cards */
    .heard-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 860px) {
      .heard-grid { grid-template-columns: 1fr; }
    }
    .heard-card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
    }
    .heard-row {
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 10px;
      font-size: 13px;
    }
    .tag-yousaid {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      padding-top: 2px;
    }
    .tag-today {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #D97706;
      padding-top: 2px;
    }
    .heard-divider {
      border-top: 1px solid var(--border);
    }
    .navy-callout {
      margin-top: 24px;
      background: var(--navy);
      color: #FFFFFF;
      border-radius: 12px;
      padding: 20px 26px;
      font-size: 14px;
      line-height: 1.6;
    }
    .navy-callout span { color: var(--teal-light); font-weight: 700; }

    /* 02 Workflows List */
    .wf-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .wf-row {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 22px;
      display: grid;
      grid-template-columns: 220px 1fr 220px;
      gap: 20px;
      align-items: center;
    }
    @media (max-width: 820px) {
      .wf-row { grid-template-columns: 1fr; }
    }
    .wf-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--navy);
    }
    .wf-today {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .wf-desc {
      font-size: 13.5px;
      color: var(--text-body);
    }
    .wf-badge {
      background: var(--teal-tint);
      color: #1D6E85;
      font-size: 11.5px;
      font-weight: 700;
      padding: 7px 12px;
      border-radius: 8px;
      text-align: center;
    }

    /* 03 Options 2x2 Grid */
    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 780px) {
      .options-grid { grid-template-columns: 1fr; }
    }
    .opt-card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      font-size: 13.5px;
    }
    .opt-card.recommended {
      background: var(--navy);
      color: #FFFFFF;
      border-color: var(--navy);
    }
    .rec-pill {
      display: inline-block;
      background: var(--teal);
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 10px;
    }

    /* 04 Modules 4-Col Grid */
    .mod-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }
    @media (max-width: 900px) {
      .mod-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .mod-card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .mod-num {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--teal);
      margin-bottom: 8px;
    }
    .mod-title {
      font-size: 14.5px;
      font-weight: 800;
      color: var(--navy);
      margin-bottom: 8px;
    }
    .mod-desc {
      font-size: 12.5px;
      color: var(--text-body);
      line-height: 1.55;
    }

    /* 05 Dark AI Capabilities Grid */
    .ai-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 32px;
    }
    @media (max-width: 900px) {
      .ai-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .ai-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 18px;
    }
    .ai-card-title {
      font-size: 13.5px;
      font-weight: 800;
      color: var(--teal-light);
      margin-bottom: 6px;
    }
    .ai-card-desc {
      font-size: 12.5px;
      color: #CBD5E1;
      line-height: 1.5;
    }
    .auto-guard-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 820px) {
      .auto-guard-grid { grid-template-columns: 1fr; }
    }
    .pill-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .auto-pill {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      color: #E2E8F0;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 999px;
    }
    .guardrail-card {
      background: #FFFFFF;
      color: var(--text-main);
      border-radius: 14px;
      padding: 24px;
    }

    /* 06 Loop Steps */
    .loop-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .loop-row {
      display: grid;
      grid-template-columns: 280px 1fr;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: #FFFFFF;
    }
    @media (max-width: 720px) {
      .loop-row { grid-template-columns: 1fr; }
    }
    .loop-left {
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: 13.5px;
      color: var(--navy);
    }
    .loop-num {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: var(--navy);
      color: #FFFFFF;
      font-size: 11.5px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .loop-right {
      background: var(--teal-tint);
      padding: 14px 20px;
      font-size: 13.5px;
      color: var(--navy);
      display: flex;
      align-items: center;
    }

    /* Tables */
    .clean-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 16px;
    }
    .clean-table th {
      text-align: left;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }
    .clean-table td {
      padding: 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      color: var(--text-body);
    }
    .clean-table td:first-child {
      font-weight: 700;
      color: var(--navy);
    }

    /* 10 Gantt Chart */
    .gantt-box {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 28px;
    }
    .gantt-row {
      display: grid;
      grid-template-columns: 210px 1fr;
      gap: 16px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #F1F5F9;
    }
    .gantt-track {
      background: #F1F5F9;
      height: 24px;
      border-radius: 6px;
      position: relative;
      overflow: hidden;
    }
    .gantt-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      border-radius: 6px;
      background: var(--navy);
    }
    .gantt-bar.teal { background: var(--teal); }
    .gantt-bar.striped {
      background: repeating-linear-gradient(
        45deg,
        #CBD5E1,
        #CBD5E1 6px,
        #E2E8F0 6px,
        #E2E8F0 12px
      );
    }

    /* 11 Interactive Package Cards */
    .pkg-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;
      margin-bottom: 32px;
    }
    @media (max-width: 760px) {
      .pkg-grid { grid-template-columns: 1fr; }
    }
    .pkg-card {
      border: 2px solid var(--border);
      border-radius: 16px;
      padding: 26px;
      background: #FFFFFF;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .pkg-card.active {
      background: var(--navy);
      color: #FFFFFF;
      border-color: var(--navy);
      box-shadow: 0 14px 34px rgba(15, 37, 71, 0.18);
    }
    .pkg-price {
      font-size: 34px;
      font-weight: 800;
      margin: 12px 0 4px;
    }

    /* 16 Next Steps & Accept Form */
    .footer-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.95fr;
      gap: 44px;
      align-items: start;
    }
    @media (max-width: 860px) {
      .footer-grid { grid-template-columns: 1fr; }
    }
    .accept-card {
      background: #FFFFFF;
      color: var(--text-main);
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.28);
    }
    .accept-input {
      width: 100%;
      padding: 11px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13.5px;
      margin-top: 6px;
      margin-bottom: 16px;
    }
    .accept-submit {
      width: 100%;
      background: var(--navy);
      color: #FFFFFF;
      border: none;
      padding: 14px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
    }
    .accept-submit:hover { background: var(--teal); }
  </style>
</head>
<body>

  <!-- Sticky Top Navigation Bar -->
  <header class="top-nav">
    <div class="container top-nav-inner">
      <a href="#top">${brandLockupTopHtml}</a>
      <nav class="nav-links">
        <a href="#sec-01">What we heard</a>
        <a href="#sec-04">Solution</a>
        <a href="#sec-07">Architecture</a>
        <a href="#sec-10">Plan</a>
        <a href="#sec-11">Investment</a>
        <a href="#sec-12">Why us</a>
        <a href="#sec-16" class="nav-cta">Accept proposal</a>
      </nav>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="hero" id="top">
    <div class="container hero-grid">
      <div>
        <div class="eyebrow">PROPOSAL &middot; PREPARED FOR ${company_name.toUpperCase()}</div>
        <h1>${heroHeadline}</h1>
        <p class="hero-desc">${heroSubheadline}</p>
        <div class="hero-btns">
          <a href="#sec-11" class="btn-teal">See the investment</a>
          <a href="#sec-16" class="btn-outline-light">Accept proposal</a>
        </div>
        <div class="hero-meta">
          <div>
            <div class="meta-label">Prepared for</div>
            <div class="meta-val">${recipient_name}</div>
          </div>
          <div>
            <div class="meta-label">Prepared by</div>
            <div class="meta-val">NexInt AI, Chennai</div>
          </div>
          <div>
            <div class="meta-label">Date</div>
            <div class="meta-val">${todayStr}</div>
          </div>
          <div>
            <div class="meta-label">Version</div>
            <div class="meta-val">2.0 &middot; valid 30 days</div>
          </div>
        </div>
      </div>

      <div class="hero-logo-card">
        ${brandLockupHeroCardHtml}
        <div class="hero-logo-caption">
          AI &middot; Data Engineering &middot; Automation &middot; Custom Software
        </div>
      </div>
    </div>
  </section>

  <!-- 5-Card KPI Strip -->
  <section class="kpi-strip">
    <div class="container kpi-grid-5">
      <div class="kpi-card">
        <div class="kpi-card-label">Investment</div>
        <div class="kpi-card-val">${fmtRec}</div>
        <div class="kpi-card-sub">one-time</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Quick-start</div>
        <div class="kpi-card-val">Week 1</div>
        <div class="kpi-card-sub">Migration-ready master template and tag dictionary</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">First value</div>
        <div class="kpi-card-val">Week ${firstValueWeek}</div>
        <div class="kpi-card-sub">Core platform live with your migrated data</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Full go-live</div>
        <div class="kpi-card-val">Week ${totalWeeks}</div>
        <div class="kpi-card-sub">four phases, each signed off by you</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Ownership</div>
        <div class="kpi-card-val">100% yours</div>
        <div class="kpi-card-sub">data, code and credentials; no lock-in</div>
      </div>
    </div>
  </section>

  <!-- AT A GLANCE -->
  <section class="section">
    <div class="container">
      <div class="sec-eyebrow">AT A GLANCE</div>
      <h2 class="sec-h2" style="margin-bottom: 24px;">Everything on one page.</h2>
      <div class="glance-grid">
        <div class="glance-cell">
          <div class="glance-label">WHAT</div>
          <div class="glance-val">${whatSummary}</div>
        </div>
        <div class="glance-cell">
          <div class="glance-label">WHO IT SERVES</div>
          <div class="glance-val">${whoItServes}</div>
        </div>
        <div class="glance-cell">
          <div class="glance-label">AI AND AUTOMATION</div>
          <div class="glance-val">${aiAndAutomationSummary}</div>
        </div>
        <div class="glance-cell">
          <div class="glance-label">WORKS WITH</div>
          <div class="glance-val">${worksWithSummary}</div>
        </div>
        <div class="glance-cell">
          <div class="glance-label">RUNNING COST</div>
          <div class="glance-val">${runningCostSummary}</div>
        </div>
        <div class="glance-cell">
          <div class="glance-label">OWNERSHIP</div>
          <div class="glance-val">${company_name} owns the data, code, configuration and credentials. Hosted in your region. No lock-in</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 01 · WHAT WE HEARD -->
  <section class="section-soft" id="sec-01">
    <div class="container">
      <div class="sec-eyebrow">01 &middot; WHAT WE HEARD</div>
      <h2 class="sec-h2">${
        aiCustom.whatWeHeardHeadline ||
        `Your operation has outgrown the spreadsheets and disconnected tools that run it.`
      }</h2>
      <p class="sec-lead">${
        aiCustom.whatWeHeardIntro ||
        `${company_name} leads every engagement with speed and precision — and needs a single platform where discovery, workflows, approvals, commercials and analytics work together.`
      }</p>

      <div class="heard-grid">
        ${whatWeHeardItems
          .map(
            (item) => `
          <div class="heard-card">
            <div class="heard-row">
              <div class="tag-yousaid">YOU SAID</div>
              <div style="font-weight: 600; color: var(--navy);">${item.youSaid}</div>
            </div>
            <div class="heard-divider"></div>
            <div class="heard-row">
              <div class="tag-today">TODAY</div>
              <div style="color: var(--text-muted);">${item.today}</div>
            </div>
          </div>`
          )
          .join('')}
      </div>

      <div class="navy-callout">
        You told us what matters is that the platform is feasible and makes the work easier, and asked us to show what kind of automation is possible. <span>The next section does exactly that.</span>
      </div>
    </div>
  </section>

  <!-- 02 · WHAT CHANGES FOR YOUR TEAM -->
  <section class="section">
    <div class="container">
      <div class="sec-eyebrow">02 &middot; WHAT CHANGES FOR YOUR TEAM</div>
      <h2 class="sec-h2">Nine everyday workflows go from manual to assisted.</h2>
      <p class="sec-lead">In every one, a person still makes the decision.</p>

      <div class="wf-list">
        ${workflows
          .map(
            (wf) => `
          <div class="wf-row">
            <div>
              <div class="wf-title">${wf.title}</div>
              <div class="wf-today">${wf.today}</div>
            </div>
            <div class="wf-desc">${wf.assisted}</div>
            <div class="wf-badge">${wf.badge}</div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </section>

  <!-- 03 · OPTIONS CONSIDERED -->
  <section class="section-soft">
    <div class="container">
      <div class="sec-eyebrow">03 &middot; OPTIONS CONSIDERED</div>
      <h2 class="sec-h2">Configured software or a custom build? We compared four routes.</h2>
      <p class="sec-lead">Your brief asked us to assess this. We recommend a custom ${project_title} on a standard stack: your workflow is the differentiator, and off-the-shelf tools would force compromises.</p>

      <div class="options-grid">
        <div class="opt-card">
          <div style="font-weight: 800; font-size: 16px; color: var(--navy); margin-bottom: 6px;">A &middot; Extend existing CRM and task tools</div>
          <div style="color: var(--text-muted); margin-bottom: 12px;">Custom fields and basic automations in the tools you already use</div>
          <div style="margin-bottom: 6px;"><strong>Strengths:</strong> No new system; low initial cost</div>
          <div><strong>Limits:</strong> No unified portal, quote comparison, multi-stage approvals or AI matching; data split across tools</div>
        </div>
        <div class="opt-card">
          <div style="font-weight: 800; font-size: 16px; color: var(--navy); margin-bottom: 6px;">B &middot; Low-code platform</div>
          <div style="color: var(--text-muted); margin-bottom: 12px;">Configured app on a low-code database with automation add-ons</div>
          <div style="margin-bottom: 6px;"><strong>Strengths:</strong> Fast to start</div>
          <div><strong>Limits:</strong> Per-user licences grow every year; limited AI, portal and approval logic; data held by the platform</div>
        </div>
        <div class="opt-card">
          <div style="font-weight: 800; font-size: 16px; color: var(--navy); margin-bottom: 6px;">C &middot; Off-the-shelf enterprise suite</div>
          <div style="color: var(--text-muted); margin-bottom: 12px;">Standard SaaS procurement or operations software</div>
          <div style="margin-bottom: 6px;"><strong>Strengths:</strong> Mature standard PO and invoice features</div>
          <div><strong>Limits:</strong> Built for generic purchasing, not your domain-specific workflows, scoring and AI automation; heavy and costly</div>
        </div>
        <div class="opt-card recommended">
          <span class="rec-pill">RECOMMENDED</span>
          <div style="font-weight: 800; font-size: 16px; color: #FFFFFF; margin-bottom: 6px;">D &middot; Custom ${project_title}</div>
          <div style="color: #CBD5E1; margin-bottom: 12px;">Purpose-built web app with AI, connected to your CRM, tasks and finance stack</div>
          <div style="margin-bottom: 6px;"><strong>Strengths:</strong> Fits your exact workflow; AI throughout; unlimited internal users; self-service portal; you own the code and data</div>
          <div style="color: #CBD5E1;"><strong>Limits:</strong> Higher one-time cost than A or B; needs a build period, which we phase so value arrives from week 1</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 04 · THE SOLUTION MODULES -->
  <section class="section" id="sec-04">
    <div class="container">
      <div class="sec-eyebrow">04 &middot; THE PLATFORM</div>
      <h2 class="sec-h2">Ten modules, from first contact to final payment.</h2>
      <p class="sec-lead">AI and automation run through all of them. One responsive web app for laptop and phone, plus a self-service portal.</p>

      <div class="mod-grid">
        ${modules
          .map(
            (m, i) => `
          <div class="mod-card">
            <div class="mod-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="mod-title">${m.title}</div>
            <div class="mod-desc">${m.desc}</div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </section>

  <!-- 05 · AI AND AUTOMATION (DARK NAVY SECTION) -->
  <section class="section-dark">
    <div class="container">
      <div class="sec-eyebrow" style="color: var(--teal-light);">05 &middot; AI AND AUTOMATION</div>
      <h2 class="sec-h2">${aiCapabilities.length} AI capabilities and ${automationsList.length} automations.</h2>
      <p class="sec-lead">AI does the reading, typing, comparing and chasing. Your team approves every decision before anything is sent, signed or paid.</p>

      <div class="ai-grid">
        ${aiCapabilities
          .map(
            (cap) => `
          <div class="ai-card">
            <div class="ai-card-title">${cap.title}</div>
            <div class="ai-card-desc">${cap.desc}</div>
          </div>`
          )
          .join('')}
      </div>

      <div class="auto-guard-grid">
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: #FFFFFF; margin: 0 0 14px 0;">Automations that run without anyone remembering to</h3>
          <div class="pill-cloud">
            ${automationsList.map((a) => `<span class="auto-pill">${a}</span>`).join('')}
          </div>
        </div>
        <div class="guardrail-card">
          <div style="font-size: 15px; font-weight: 800; color: var(--navy); margin-bottom: 10px;">Guardrails</div>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-body); line-height: 1.7;">
            <li>AI suggestions are labelled and logged, and never change a record, send a message or approve a payment without a person</li>
            <li>Sensitive client details stay hidden from external users unless you choose otherwise</li>
            <li>Only the minimum data needed goes to the AI model</li>
            <li>AI usage is capped and reported monthly</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- 06 · HOW IT WORKS END TO END -->
  <section class="section">
    <div class="container">
      <div class="sec-eyebrow">06 &middot; HOW IT WORKS END TO END</div>
      <h2 class="sec-h2">The loop closes on itself.</h2>
      <p class="sec-lead">Ratings and outcomes collected at the end improve the AI match on the next brief, and the same records drive every leadership dashboard.</p>

      <div class="loop-list">
        ${endToEndSteps
          .map(
            (st, i) => `
          <div class="loop-row">
            <div class="loop-left">
              <span class="loop-num">${i + 1}</span>
              <span>${st.title}</span>
            </div>
            <div class="loop-right">${st.desc}</div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </section>

  <!-- 07 · ARCHITECTURE AND INTEGRATIONS -->
  <section class="section-soft" id="sec-07">
    <div class="container">
      <div class="sec-eyebrow">07 &middot; ARCHITECTURE AND INTEGRATIONS</div>
      <h2 class="sec-h2">Each system keeps one job.</h2>
      <p class="sec-lead">Your CRM is the record for clients, task boards for tasks, and finance tools for accounting. The ${project_title} owns core operations, workflows, documents and performance, keeping each source’s identifiers so nothing is duplicated.</p>

      <!-- Visual Architecture Diagram -->
      <div style="margin-bottom: 32px;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; margin-bottom: 10px;">
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-weight:800;font-size:13px;color:var(--navy);">${company_name} team</div><div style="font-size:11px;color:var(--text-muted);">brief to delivery</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-weight:800;font-size:13px;color:var(--navy);">Leadership</div><div style="font-size:11px;color:var(--text-muted);">dashboards, digest</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-weight:800;font-size:13px;color:var(--navy);">Finance</div><div style="font-size:11px;color:var(--text-muted);">approvals, payments</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-weight:800;font-size:13px;color:var(--navy);">External Partners</div><div style="font-size:11px;color:var(--text-muted);">self-service portal</div></div>
        </div>
        <div style="text-align:center;color:var(--teal);font-weight:800;font-size:16px;margin:4px 0;">&darr;</div>
        <div style="border: 2px solid var(--teal); border-radius: 16px; padding: 18px; background: #FFFFFF;">
          <div style="background: var(--navy); color: #FFF; text-align: center; font-weight: 800; font-size: 14px; padding: 12px; border-radius: 10px; margin-bottom: 12px;">
            ${project_title} &middot; responsive web app and self-service portal
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center; margin-bottom: 12px;">
            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Master Hub</div><div style="font-size:11px;color:var(--text-muted);">profiles, NDAs</div></div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Briefs &amp; RFQs</div><div style="font-size:11px;color:var(--text-muted);">match, quotes</div></div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Projects</div><div style="font-size:11px;color:var(--text-muted);">stages, review</div></div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Procure to pay</div><div style="font-size:11px;color:var(--text-muted);">PO, invoice, pay</div></div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Feedback</div><div style="font-size:11px;color:var(--text-muted);">ratings, reports</div></div>
          </div>
          <div style="background: var(--teal-tint); color: var(--navy); text-align: center; font-weight: 700; font-size: 12.5px; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
            AI layer &middot; brief reader &middot; intelligent match &middot; quote and invoice reading &middot; Ask AI Hub
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; text-align: center;">
            <div style="background:var(--bg-soft);border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Database and files</div><div style="font-size:11px;color:var(--text-muted);">PostgreSQL, encrypted storage, daily backups</div></div>
            <div style="background:var(--bg-soft);border:1px solid var(--border);border-radius:8px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">n8n automation</div><div style="font-size:11px;color:var(--text-muted);">reminders, escalations, syncs, alerts</div></div>
          </div>
        </div>
        <div style="text-align:center;color:var(--text-muted);font-size:12px;margin:8px 0;">&updownarrow; API and webhook syncs, two-way where supported</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">CRM</div><div style="font-size:11px;color:var(--text-muted);">clients, pitches</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">ClickUp / Tasks</div><div style="font-size:11px;color:var(--text-muted);">tasks, status</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Finance ERP</div><div style="font-size:11px;color:var(--text-muted);">POs, invoices</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">E-signature</div><div style="font-size:11px;color:var(--text-muted);">NDAs, contracts</div></div>
          <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:10px;"><div style="font-weight:800;font-size:12px;color:var(--navy);">Messaging</div><div style="font-size:11px;color:var(--text-muted);">email, WhatsApp</div></div>
        </div>
      </div>

      <table class="clean-table" style="background:#FFF;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <thead>
          <tr>
            <th>INTEGRATION</th>
            <th>DESIGN</th>
            <th>IF IT IS NOT AVAILABLE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CRM Sync</td>
            <td>Webhooks send new and changed opportunities to the Hub; the Hub writes back selected partners, cost and stage; a nightly check reconciles anything missed</td>
            <td>Scheduled sync every 15 minutes</td>
          </tr>
          <tr>
            <td>Task Management</td>
            <td>Each engagement links to its project task; status changes sync both ways</td>
            <td>One-way link from the Hub to task board</td>
          </tr>
          <tr>
            <td>Finance / Accounting</td>
            <td>PO and invoice data shared through its API</td>
            <td>Export files in the exact format your finance team imports</td>
          </tr>
          <tr>
            <td>Existing Spreadsheets</td>
            <td>One-time smart import with mapping, duplicate report and totals for sign-off</td>
            <td>&mdash;</td>
          </tr>
          <tr>
            <td>E-signature &amp; Messaging</td>
            <td>NDAs, contracts, RFQs, surveys and payment advice sent and tracked automatically</td>
            <td>Upload of signed copies with automated email reminders</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- 08 · DATA, MIGRATION AND TAXONOMY -->
  <section class="section">
    <div class="container">
      <div class="sec-eyebrow">08 &middot; DATA, MIGRATION AND TAXONOMY</div>
      <h2 class="sec-h2">Your team keeps working in Excel while we build.</h2>
      <p class="sec-lead">Nothing is switched off until the Hub is accepted, and the migration is reviewable at every step.</p>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px;">
        <div style="background: var(--navy); color: #FFF; border-radius: 14px; padding: 24px;">
          <div style="font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; color: var(--teal-light); uppercase; margin-bottom: 8px;">WEEK 1 QUICK-START</div>
          <div style="font-size: 13px; line-height: 1.6; color: #E2E8F0;">A migration-ready master template: field definitions, dropdowns for controlled values, and a tag dictionary for services, regions, and categories. Your team can use it immediately in Week 1; it imports straight into the Hub in Phase 1.</div>
        </div>
        <div style="background: #FFF; border: 1px solid var(--border); border-radius: 14px; padding: 24px;">
          <div style="font-weight: 800; font-size: 15px; color: var(--navy); margin-bottom: 8px;">Data model</div>
          <div style="font-size: 13px; color: var(--text-body); line-height: 1.6;">Relational schema linking partners, markets, services, briefs, quotes, POs, invoices and multi-dimensional ratings. Full entity-relationship documentation is shared alongside Phase 0.</div>
        </div>
        <div style="background: #FFF; border: 1px solid var(--border); border-radius: 14px; padding: 24px;">
          <div style="font-weight: 800; font-size: 15px; color: var(--navy); margin-bottom: 8px;">Taxonomy</div>
          <div style="font-size: 13px; color: var(--text-body); line-height: 1.6;">Controlled lists, not free text: service group, sub-service, region, industry category, engagement type, and status. New values and merges go through an approval step so filters stay reliable.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 09 · SECURITY, PERMISSIONS AND OWNERSHIP -->
  <section class="section-soft">
    <div class="container">
      <div class="sec-eyebrow">09 &middot; SECURITY, PERMISSIONS AND OWNERSHIP</div>
      <h2 class="sec-h2">Least privilege, and ${company_name} owns everything we build.</h2>
      <p class="sec-lead">Finance and commercial data is visible only to those who need it. Proposed permission matrix — the final version is approved by you in Phase 0.</p>

      <table class="clean-table" style="background:#FFF;border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <thead>
          <tr>
            <th>ROLE</th>
            <th>PROFILES</th>
            <th>RATE CARDS &amp; COSTS</th>
            <th>CONTRACTS &amp; POS</th>
            <th>INVOICES &amp; PAYMENTS</th>
            <th>RATINGS</th>
            <th>SETTINGS</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Leadership</td><td>View all</td><td>View</td><td>View</td><td>View</td><td>View all</td><td>&mdash;</td></tr>
          <tr><td>Operations owner</td><td>Edit all</td><td>View</td><td>Edit</td><td>View</td><td>View all</td><td>Edit</td></tr>
          <tr><td>Account / Delivery lead</td><td>Edit own</td><td>Price bands only</td><td>View own</td><td>Status only</td><td>Rate own</td><td>&mdash;</td></tr>
          <tr><td>Finance</td><td>View</td><td>View</td><td>Edit</td><td>Approve, mark paid</td><td>&mdash;</td><td>&mdash;</td></tr>
          <tr><td>External Portal User</td><td>Own profile</td><td>Own quotes</td><td>Own documents</td><td>Own invoices</td><td>Survey only</td><td>&mdash;</td></tr>
        </tbody>
      </table>

      <div class="mod-grid">
        <div class="mod-card"><div class="mod-title">Hosting &amp; location</div><div class="mod-desc">Dedicated cloud region; data encrypted in transit (TLS 1.3) and at rest (AES-256).</div></div>
        <div class="mod-card"><div class="mod-title">Backup &amp; recovery</div><div class="mod-desc">Automated daily backups retained for 30 days; recovery tested before go-live.</div></div>
        <div class="mod-card"><div class="mod-title">Audit trail</div><div class="mod-desc">Every change to profiles, commercials, documents and approvals logged with user and timestamp.</div></div>
        <div class="mod-card"><div class="mod-title">100% Ownership</div><div class="mod-desc">${company_name} owns the data, configuration, custom code, documentation and credentials.</div></div>
      </div>
    </div>
  </section>

  <!-- 10 · DELIVERY PLAN -->
  <section class="section" id="sec-10">
    <div class="container">
      <div class="sec-eyebrow">10 &middot; DELIVERY PLAN</div>
      <h2 class="sec-h2">~${totalWeeks} weeks, signed off at every gate.</h2>
      <p class="sec-lead">Shown for the Recommended package. Value arrives early: the quick-start template in week 1, core foundation live with your data in week ${firstValueWeek}, and full go-live in week ${totalWeeks}.</p>

      <div class="gantt-box">
        <div class="gantt-row">
          <div><div style="font-weight:800;font-size:13px;color:var(--navy);">0 &middot; Design and quick-start</div><div style="font-size:11px;color:var(--text-muted);">Weeks 1–${w0}</div></div>
          <div class="gantt-track"><div class="gantt-bar" style="left:0%;width:16%;"></div></div>
        </div>
        <div class="gantt-row">
          <div><div style="font-weight:800;font-size:13px;color:var(--navy);">1 &middot; Core foundation &amp; portal</div><div style="font-size:11px;color:var(--text-muted);">Weeks ${w0 + 1}–${w0 + w1}</div></div>
          <div class="gantt-track"><div class="gantt-bar teal" style="left:16%;width:22%;"></div></div>
        </div>
        <div class="gantt-row">
          <div><div style="font-weight:800;font-size:13px;color:var(--navy);">2 &middot; Briefs, AI match &amp; workflows</div><div style="font-size:11px;color:var(--text-muted);">Weeks ${w0 + w1 + 1}–${w0 + w1 + w2}</div></div>
          <div class="gantt-track"><div class="gantt-bar" style="left:38%;width:28%;"></div></div>
        </div>
        <div class="gantt-row">
          <div><div style="font-weight:800;font-size:13px;color:var(--navy);">3 &middot; Procure to pay &amp; go-live</div><div style="font-size:11px;color:var(--text-muted);">Weeks ${w0 + w1 + w2 + 1}–${totalWeeks}</div></div>
          <div class="gantt-track"><div class="gantt-bar" style="left:66%;width:18%;"></div></div>
        </div>
        <div class="gantt-row" style="border-bottom:none;">
          <div><div style="font-weight:700;font-size:13px;color:var(--text-muted);">4 &middot; Optimise (optional)</div><div style="font-size:11px;color:var(--text-muted);">Weeks ${totalWeeks + 1}–${completeWeeks}</div></div>
          <div class="gantt-track"><div class="gantt-bar striped" style="left:84%;width:16%;"></div></div>
        </div>
      </div>

      <table class="clean-table">
        <thead>
          <tr>
            <th>PHASE</th>
            <th>DELIVERABLES</th>
            <th>YOU ACCEPT IT WHEN</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0 &middot; Design and quick-start<div style="font-size:11px;color:var(--text-muted);font-weight:500;">Weeks 1–${w0}</div></td>
            <td>Master data template and tag dictionary; workflow maps, taxonomy, permission matrix, data mapping; clickable prototype of every main screen</td>
            <td>The prototype matches how your team works</td>
          </tr>
          <tr>
            <td>1 &middot; Core foundation<div style="font-size:11px;color:var(--text-muted);font-weight:500;">Weeks ${w0 + 1}–${w0 + w1}</div></td>
            <td>Master directory with your data migrated; self-onboarding portal; NDA e-sign; automated ratings and survey workflows</td>
            <td>You can search records by market, service and price, and completed work triggers ratings automatically</td>
          </tr>
          <tr>
            <td>2 &middot; Brief to appointment<div style="font-size:11px;color:var(--text-muted);font-weight:500;">Weeks ${w0 + w1 + 1}–${w0 + w1 + w2}</div></td>
            <td>Briefs, AI match, RFQs, quote comparison, appointment rules, stage tracking, CRM and task sync, dashboards, Ask AI</td>
            <td>A real brief runs from opportunity to appointed partner, visible end to end on the dashboard</td>
          </tr>
          <tr>
            <td>3 &middot; Procure to pay<div style="font-size:11px;color:var(--text-muted);font-weight:500;">Weeks ${w0 + w1 + w2 + 1}–${totalWeeks}</div></td>
            <td>PO from quote, invoice upload and AI check, finance approval, payment advice, exceptions view, ERP link</td>
            <td>A real engagement runs from PO to payment advice, and missing records appear as exceptions with owners</td>
          </tr>
          <tr>
            <td style="color:var(--text-muted);">4 &middot; Optimise (optional)<div style="font-size:11px;color:var(--text-muted);font-weight:500;">Weeks ${totalWeeks + 1}–${completeWeeks}</div></td>
            <td style="color:var(--text-muted);">Weekly AI digest, quality pre-check, discovery assistant, bench coverage heatmap</td>
            <td style="color:var(--text-muted);">Agreed scope after Phase 3</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- 11 · INVESTMENT -->
  <section class="section-soft" id="sec-11">
    <div class="container">
      <div class="sec-eyebrow">11 &middot; INVESTMENT</div>
      <h2 class="sec-h2">Choose your package.</h2>
      <p class="sec-lead">We recommend the Recommended package. One-time prices include design, development, AI and automation setup, integrations, data migration, testing, training and documentation. All amounts exclude 18% GST.</p>

      <div class="pkg-grid">
        <div class="pkg-card active" id="pkg-rec" onclick="selectPackage('Recommended', '~${totalWeeks} weeks', '${fmtRec}')">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-weight:800;font-size:18px;">Recommended</div>
            <span class="rec-pill" style="margin:0;">RECOMMENDED</span>
          </div>
          <div style="font-size:12.5px;opacity:0.8;margin-top:4px;">Phases 0–3 &middot; ~${totalWeeks} weeks</div>
          <div class="pkg-price">${fmtRec}</div>
          <div style="font-size:12px;opacity:0.8;">Sum of phases <s>${formatMoney(sumIncludedPhases, currency)}</s> &middot; save ${formatMoney(discountAmt, currency)}</div>
        </div>

        <div class="pkg-card" id="pkg-comp" onclick="selectPackage('Complete', '~${completeWeeks} weeks', '${fmtComplete}')">
          <div style="font-weight:800;font-size:18px;">Complete</div>
          <div style="font-size:12.5px;opacity:0.8;margin-top:4px;">Phases 0–4 &middot; ~${completeWeeks} weeks</div>
          <div class="pkg-price">${fmtComplete}</div>
          <div style="font-size:12px;opacity:0.8;">Sum of phases <s>${formatMoney(completeSumPhases, currency)}</s> &middot; save ${formatMoney(completeDiscount, currency)}</div>
        </div>
      </div>

      <h3 style="font-size: 16px; font-weight: 800; color: var(--navy); margin: 0 0 8px 0;">One-time, by phase</h3>
      <table class="clean-table" style="background:#FFF;border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:32px;">
        <thead>
          <tr>
            <th>PHASE</th>
            <th>SCOPE</th>
            <th>DURATION</th>
            <th style="text-align:right;">AMOUNT (${curSym})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>&#10003; 0 &middot; Design and quick-start</td>
            <td>Master template and tag dictionary (week 1), workflows, taxonomy, permission matrix, data mapping, clickable prototype, design sign-off</td>
            <td>${w0} weeks</td>
            <td style="text-align:right;font-weight:700;">${formatMoney(p0Amt, currency, false)}</td>
          </tr>
          <tr>
            <td>&#10003; 1 &middot; Core foundation</td>
            <td>Master directory, smart import and migration, enrichment, portfolio tagging, onboarding portal, NDA e-sign, automated ratings and survey</td>
            <td>${w1} weeks</td>
            <td style="text-align:right;font-weight:700;">${formatMoney(p1Amt, currency, false)}</td>
          </tr>
          <tr>
            <td>&#10003; 2 &middot; Brief to appointment</td>
            <td>Briefs, AI match, RFQs, quote comparison, appointment rules, stage tracking, CRM and task sync, dashboards, Ask AI Hub</td>
            <td>${w2} weeks</td>
            <td style="text-align:right;font-weight:700;">${formatMoney(p2Amt, currency, false)}</td>
          </tr>
          <tr>
            <td>&#10003; 3 &middot; Procure to pay</td>
            <td>PO from quote, invoice upload and AI check, finance approval, payment advice, exceptions, finance link</td>
            <td>${w3} weeks</td>
            <td style="text-align:right;font-weight:700;">${formatMoney(p3Amt, currency, false)}</td>
          </tr>
          <tr>
            <td style="color:var(--text-muted);">&mdash; 4 &middot; Optimise (optional)</td>
            <td style="color:var(--text-muted);">Weekly AI digest, quality pre-check, discovery assistant, bench heatmap</td>
            <td style="color:var(--text-muted);">3 weeks</td>
            <td style="text-align:right;color:var(--text-muted);">${formatMoney(phase4OptAmt, currency, false)}</td>
          </tr>
          <tr>
            <td colspan="3" style="font-weight:600;">Sum of included phases</td>
            <td style="text-align:right;font-weight:700;">${formatMoney(sumIncludedPhases, currency, false)}</td>
          </tr>
          <tr>
            <td colspan="3" style="color:var(--teal);font-weight:600;">Package discount</td>
            <td style="text-align:right;color:var(--teal);font-weight:700;">&ndash; ${formatMoney(discountAmt, currency, false)}</td>
          </tr>
          <tr style="background: var(--navy); color: #FFFFFF;">
            <td colspan="3" style="color:#FFFFFF;font-weight:800;">Final investment &mdash; Recommended (excl. GST)</td>
            <td style="text-align:right;color:#FFFFFF;font-weight:800;font-size:15px;">${fmtRec}</td>
          </tr>
        </tbody>
      </table>

      <!-- Payment Milestones + Recurring -->
      <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 28px; align-items: start;">
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: var(--navy); margin: 0 0 4px 0;">Payment milestones &mdash; Recommended</h3>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">GST at 18% is added to each invoice.</div>
          <table class="clean-table" style="background:#FFF;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <thead>
              <tr><th>MILESTONE</th><th>SHARE</th><th style="text-align:right;">AMOUNT (${curSym})</th></tr>
            </thead>
            <tbody>
              <tr><td>Work order signed</td><td>15%</td><td style="text-align:right;font-weight:700;">${formatMoney(mWorkOrder, currency, false)}</td></tr>
              <tr><td>Phase 0 sign-off (design and prototype)</td><td>10%</td><td style="text-align:right;font-weight:700;">${formatMoney(mPhase0, currency, false)}</td></tr>
              <tr><td>Phase 1 sign-off (core master live)</td><td>25%</td><td style="text-align:right;font-weight:700;">${formatMoney(mPhase1, currency, false)}</td></tr>
              <tr><td>Phase 2 sign-off (workflows &amp; AI live)</td><td>30%</td><td style="text-align:right;font-weight:700;">${formatMoney(mPhase2, currency, false)}</td></tr>
              <tr><td>Phase 3 sign-off (go-live)</td><td>20%</td><td style="text-align:right;font-weight:700;">${formatMoney(mPhase3, currency, false)}</td></tr>
              <tr style="background:var(--teal-tint);"><td style="font-weight:800;">Total</td><td style="font-weight:800;">100%</td><td style="text-align:right;font-weight:800;color:var(--navy);">${formatMoney(recBudget, currency, false)}</td></tr>
            </tbody>
          </table>
        </div>

        <div style="background:#FFF;border:1px solid var(--border);border-radius:12px;padding:22px;">
          <h3 style="font-size: 16px; font-weight: 800; color: var(--navy); margin: 0 0 14px 0;">Recurring, from go-live</h3>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <div><div style="font-weight:700;color:var(--navy);">Support and maintenance (AMC)</div><div style="font-size:11.5px;color:var(--text-muted);">Monitoring, bug fixes, security updates, API changes, up to 6 hours of small enhancements</div></div>
            <div style="font-weight:800;color:var(--navy);white-space:nowrap;margin-left:12px;">${currency === 'INR' ? '₹15,000' : formatMoney(450, currency)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <div><div style="font-weight:700;color:var(--navy);">Cloud hosting</div><div style="font-size:11.5px;color:var(--text-muted);">App, database, file storage, daily backups, automation server</div></div>
            <div style="font-weight:800;color:var(--navy);white-space:nowrap;margin-left:12px;">${currency === 'INR' ? '~₹7,000*' : '~' + formatMoney(180, currency) + '*'}</div>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:13px;">
            <div><div style="font-weight:700;color:var(--navy);">AI usage</div><div style="font-size:11.5px;color:var(--text-muted);">AI model API calls, capped and reported monthly</div></div>
            <div style="font-weight:800;color:var(--navy);white-space:nowrap;margin-left:12px;">${currency === 'INR' ? '₹3,000–8,000*' : formatMoney(100, currency) + '*'}</div>
          </div>
        </div>
      </div>

      <div style="background:#FFF;border:1px solid var(--border);border-radius:12px;padding:22px;margin-top:24px;">
        <div style="font-weight:800;font-size:14px;color:var(--navy);margin-bottom:8px;">Terms</div>
        <ul style="margin:0;padding-left:18px;font-size:12.5px;color:var(--text-body);line-height:1.75;">
          <li>60 days of free defect fixes after go-live; the AMC starts after that.</li>
          <li>AMC paid annually: 12 months for the price of 10.</li>
          <li>Changes outside the agreed scope: ${currency === 'INR' ? '₹2,000 per hour' : formatMoney(65, currency) + ' per hour'}, or a fixed quote agreed in writing before work starts.</li>
          <li>Existing third-party software licences remain with ${company_name}.</li>
          <li>Prices are valid for 30 days from the date of this proposal.</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- 12 · WHY NEXINT AI -->
  <section class="section" id="sec-12">
    <div class="container">
      <div class="sec-eyebrow">12 &middot; WHY NEXINT AI</div>
      <h2 class="sec-h2">We have built the core pieces this platform needs, for real businesses.</h2>
      <p class="sec-lead">Our team’s work spans vendor &amp; partner platforms, finance automation, CRM sync and AI on private data. We work founder-led, so the architect of your system stays accountable for it from design to go-live.</p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;">
        <div class="mod-card"><div class="sec-eyebrow" style="font-size:10px;">OPERATIONS, PAYMENT &amp; PROJECT TRACKING</div><div class="mod-desc">Multi-company operations, expense and client-payment platforms with real-time P&amp;L, approval workflows and executive dashboards.</div></div>
        <div class="mod-card"><div class="sec-eyebrow" style="font-size:10px;">AUTOMATED FINANCE DOCUMENTS &amp; APPROVALS</div><div class="mod-desc">Automated PO and invoice verification pipelines validating tax/GST compliance and delivering bank-ready payment files.</div></div>
        <div class="mod-card"><div class="sec-eyebrow" style="font-size:10px;">PRODUCTS OF OUR OWN</div><div class="mod-desc"><strong>NexGPT</strong>, an enterprise AI assistant over private databases and documents, and <strong>NexBA</strong>, a business automation platform.</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px;">
        <div class="mod-card">
          <div style="font-weight:800;font-size:16px;color:var(--navy);margin-bottom:10px;">How we work</div>
          <ol style="margin:0;padding-left:18px;font-size:13px;color:var(--text-body);line-height:1.8;">
            <li><strong>Design first:</strong> you sign off a clickable prototype before we write production code.</li>
            <li><strong>Phased releases:</strong> each with a live demo and your written acceptance.</li>
            <li><strong>Weekly reviews:</strong> 30 minutes with your point of contact; a live demo every two weeks.</li>
            <li><strong>One accountable lead</strong> from proposal to handover.</li>
          </ol>
        </div>
        <div class="mod-card">
          <div style="font-weight:800;font-size:16px;color:var(--navy);margin-bottom:10px;">Team</div>
          <div style="font-size:12.5px;color:var(--text-body);line-height:1.65;">
            <div><strong>Engagement lead and solution architect</strong> &mdash; Architecture, AI approach, delivery, single point of contact</div>
            <div style="margin-top:6px;"><strong>Product designer</strong> &mdash; Workflows, clickable prototype, responsive screens</div>
            <div style="margin-top:6px;"><strong>Full-stack developers</strong> &mdash; Web app, database, self-service portal, dashboards</div>
            <div style="margin-top:6px;"><strong>AI and automation engineer</strong> &mdash; AI capabilities, n8n workflows, integrations</div>
            <div style="margin-top:6px;"><strong>QA engineer</strong> &mdash; Automated testing, migration checks, acceptance support</div>
          </div>
        </div>
      </div>

      <div style="background:var(--teal-tint);border:1px solid #B0E0EC;border-radius:12px;padding:16px 22px;font-size:13px;color:var(--navy);">
        <strong>What we need from ${company_name}:</strong> one point of contact with 2–3 hours a week; existing master sheets and sample briefs, quotes, POs and invoices under NDA; admin access for integration setup; and your approval matrix.
      </div>
    </div>
  </section>

  <!-- 13 · RISKS AND HOW WE MANAGE THEM -->
  <section class="section-soft">
    <div class="container">
      <div class="sec-eyebrow">13 &middot; RISKS AND HOW WE MANAGE THEM</div>
      <h2 class="sec-h2">We would rather name the risks now than discover them mid-build.</h2>
      <p class="sec-lead">Each has an owner and a fallback.</p>

      <table class="clean-table" style="background:#FFF;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <thead>
          <tr><th>RISK</th><th>LIKELIHOOD</th><th>HOW WE MANAGE IT</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>External API rate limits or plan restrictions</td>
            <td><span style="background:#E0F2FE;color:#0369A1;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">Medium</span></td>
            <td>Checked in Phase 0 before any build depends on it; fallback is scheduled sync or native module inside the Hub</td>
          </tr>
          <tr>
            <td>Current spreadsheets have gaps, duplicates and mixed spellings</td>
            <td><span style="background:#FEF3C7;color:#B45309;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">High</span></td>
            <td>AI normalisation and duplicate detection, a trial import and your written sign-off before the final load</td>
          </tr>
          <tr>
            <td>AI suggestions are incomplete on edge-case documents</td>
            <td><span style="background:#E0F2FE;color:#0369A1;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">Medium</span></td>
            <td>AI only suggests; a person confirms every match, quote reading, invoice check and profile update</td>
          </tr>
          <tr>
            <td>Scope grows during the build</td>
            <td><span style="background:#E0F2FE;color:#0369A1;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">Medium</span></td>
            <td>Changes logged and priced before work starts; new ideas parked for the next phase unless you choose otherwise</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- 14 · YOUR REQUIREMENTS, ANSWERED -->
  <section class="section">
    <div class="container">
      <div class="sec-eyebrow">14 &middot; YOUR REQUIREMENTS, ANSWERED</div>
      <h2 class="sec-h2">Every item your brief asked us to address, and where to find it.</h2>

      <table class="clean-table" style="background:#FFF;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <thead>
          <tr><th>YOUR REQUEST</th><th>OUR RESPONSE</th><th>WHERE</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Recommended architecture and stack, with fallbacks</td>
            <td>Custom ${project_title} on Next.js / React, PostgreSQL and n8n with an AI layer, compared against three alternatives</td>
            <td style="color:var(--teal);font-weight:700;">Options; Architecture; Risks</td>
          </tr>
          <tr>
            <td>Data model, taxonomy, quick-start template and migration</td>
            <td>Controlled taxonomy, week-1 template, six-step migration with reconciliation report</td>
            <td style="color:var(--teal);font-weight:700;">Data and migration</td>
          </tr>
          <tr>
            <td>Phases, deliverables, schedule, staffing and governance</td>
            <td>Phased delivery with written exit criteria, dedicated team roles, weekly reviews</td>
            <td style="color:var(--teal);font-weight:700;">Delivery plan; Why NexInt AI</td>
          </tr>
          <tr>
            <td>One-time and recurring costs, change-request rates</td>
            <td>Phase prices, packages, milestones, AMC, hosting, capped AI usage</td>
            <td style="color:var(--teal);font-weight:700;">Investment</td>
          </tr>
          <tr>
            <td>100% Ownership of code, data, documentation and credentials</td>
            <td>All owned by ${company_name}; full export and handover pack per module</td>
            <td style="color:var(--teal);font-weight:700;">Security &amp; Ownership</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- 15 · ASSUMPTIONS AND SCOPE -->
  <section class="section-soft">
    <div class="container">
      <div class="sec-eyebrow">15 &middot; ASSUMPTIONS AND SCOPE</div>
      <h2 class="sec-h2">What the price includes, and what we confirm together.</h2>
      <p class="sec-lead">Prices hold for the assumptions below. We confirm them in Phase 0 and change scope or price only by written agreement.</p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
        <div class="mod-card"><div class="mod-desc">Unlimited external portal users and role-based internal access across leadership, operations, delivery and finance.</div></div>
        <div class="mod-card"><div class="mod-desc">Integrations in scope: CRM, task management, finance ERP (API or structured export), e-signature, and email/WhatsApp notifications.</div></div>
        <div class="mod-card"><div class="mod-desc">Screens and workflows as signed off in the Phase 0 clickable prototype; additions follow transparent change control.</div></div>
        <div class="mod-card"><div class="mod-desc">AI usage is capped by default each month; going above the cap requires your explicit approval.</div></div>
        <div class="mod-card"><div class="mod-desc">Existing spreadsheet data is migrated with your sign-off on the trial import and reconciliation report.</div></div>
        <div class="mod-card"><div class="mod-desc">Automation runs on self-hosted n8n inside your cloud account with zero per-workflow licence fees.</div></div>
      </div>
    </div>
  </section>

  <!-- 16 · NEXT STEPS & ACCEPT PROPOSAL -->
  <section class="section-dark" id="sec-16">
    <div class="container footer-grid">
      <div>
        <div class="sec-eyebrow" style="color:var(--teal-light);">16 &middot; NEXT STEPS</div>
        <h2 class="sec-h2">Let’s bring your ${service_type.toLowerCase()} operation into one place.</h2>

        <div style="display:flex;flex-direction:column;gap:16px;margin:28px 0 36px;">
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="width:26px;height:26px;border-radius:999px;background:var(--teal);color:#FFF;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</span>
            <div style="font-size:14px;color:#E2E8F0;"><strong>Today:</strong> walk through this proposal and the clickable demo, and agree the open details.</div>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="width:26px;height:26px;border-radius:999px;background:var(--teal);color:#FFF;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</span>
            <div style="font-size:14px;color:#E2E8F0;">Sign a mutual NDA so you can share your sample sheets and workflow documents.</div>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="width:26px;height:26px;border-radius:999px;background:var(--teal);color:#FFF;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">3</span>
            <div style="font-size:14px;color:#E2E8F0;">Choose a package and sign the work order.</div>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="width:26px;height:26px;border-radius:999px;background:var(--teal);color:#FFF;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">4</span>
            <div style="font-size:14px;color:#E2E8F0;">Phase 0 starts within 5 working days; the Week 1 quick-start reaches your team in week 1.</div>
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.14);padding-top:22px;font-size:13px;color:#CBD5E1;line-height:1.7;">
          <div style="font-weight:800;color:#FFFFFF;font-size:15px;">NexInt AI Solutions Pvt Ltd</div>
          <div>Chennai, India &middot; GSTIN 33AALCN7733M1ZY</div>
          <div>Signatory: Engagement Lead, NexInt AI Solutions Pvt Ltd</div>
          <div style="color:var(--teal-light);font-weight:600;">info@nexintai.com &middot; +91 80155 89300 &middot; nexintai.com</div>
        </div>
      </div>

      <div class="accept-card">
        <div style="font-size:20px;font-weight:800;color:var(--navy);margin-bottom:16px;">Accept this proposal</div>
        <div style="background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-size:11px;color:var(--text-muted);">Selected package</div>
            <div style="font-weight:800;font-size:14px;color:var(--navy);" id="accept-pkg-name">Recommended &middot; ~${totalWeeks} weeks</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--text-muted);">One-time, excl. GST</div>
            <div style="font-weight:800;font-size:18px;color:var(--navy);" id="accept-pkg-price">${fmtRec}</div>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <a href="#sec-11" style="font-size:12px;color:var(--teal);font-weight:700;text-decoration:underline;">Change package</a>
        </div>

        <label style="font-size:12px;font-weight:700;color:var(--text-body);">Your name</label>
        <input type="text" class="accept-input" value="${recipient_name}" />

        <label style="font-size:12px;font-weight:700;color:var(--text-body);">Designation</label>
        <input type="text" class="accept-input" placeholder="e.g. Founder, ${company_name}" />

        <button type="button" class="accept-submit" onclick="this.textContent='✓ Proposal Accepted — Work Order Requested'; this.style.background='#059669';">
          Accept and request the work order
        </button>

        <div style="font-size:11px;color:var(--text-muted);margin-top:14px;line-height:1.5;">
          Accepting here confirms your intent. The engagement starts on a signed work order and mutual NDA covering the scope, deliverables, timeline and commercial terms in this proposal; changes outside the agreed scope are reviewed separately.
        </div>
      </div>
    </div>

    <div class="container" style="margin-top:48px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:11.5px;color:#94A3B8;">
      <div>&copy; 2026 NexInt AI Solutions Pvt Ltd &middot; Intelligence beyond data</div>
      <div>${project_title} proposal &middot; v2.0 &middot; ${todayStr} &middot; Confidential</div>
    </div>
  </section>

  <script>
    function selectPackage(name, weeks, price) {
      var recCard = document.getElementById('pkg-rec');
      var compCard = document.getElementById('pkg-comp');
      if (recCard && compCard) {
        if (name === 'Recommended') {
          recCard.classList.add('active');
          compCard.classList.remove('active');
        } else {
          compCard.classList.add('active');
          recCard.classList.remove('active');
        }
      }
      var pkgNameEl = document.getElementById('accept-pkg-name');
      var pkgPriceEl = document.getElementById('accept-pkg-price');
      if (pkgNameEl) pkgNameEl.textContent = name + ' · ' + weeks;
      if (pkgPriceEl) pkgPriceEl.textContent = price;
    }
  </script>
</body>
</html>`;

  return {
    email_subject,
    email_body,
    html_proposal,
    ai_model: 'NexInt AI Proposal Engine',
  };
}

// POST /api/proposals/generate — Generate Email Subject, Editable Mail Body & Full 16-Section NexInt AI HTML Proposal based on Prompt
proposalsRouter.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const {
      company_name = 'Hotcult',
      recipient_name = 'Manjari Srivishnu',
      recipient_email = 'manjari@hotcult.com',
      project_title = 'Vendor Hub',
      service_type = 'Custom software',
      budget = 950000,
      currency = 'INR',
      timeline_weeks = 12,
      key_requirements = '',
      user_prompt = '',
      tone = 'Executive & Consultative',
      api_key = '',
      model = '',
    } = req.body || {};

    const sender_name = req.user?.name || 'NexInt AI, Chennai';
    const configuredKey =
      String(api_key || '').trim() ||
      getEnvValue([
        'GEMINI_ARGON_API_KEY',
        'VITE_GEMINI_ARGON_API_KEY',
        'GEMINI_API_KEY',
      ]);
    let configuredModel =
      String(model || '').trim() ||
      getEnvValue(['GEMINI_ARGON_MODEL', 'VITE_GEMINI_ARGON_MODEL']) ||
      'gemini-2.0-flash';

    if (
      configuredModel.includes('argon') ||
      (!configuredModel.startsWith('gemini-1') && !configuredModel.startsWith('gemini-2'))
    ) {
      configuredModel = 'gemini-2.0-flash';
    }

    // 1. Synthesize domain-aware tailored base content from dynamic prompt and requirements
    const baseDomainContent = synthesizeDynamicDomainContent({
      company_name: String(company_name),
      recipient_name: String(recipient_name),
      project_title: String(project_title),
      service_type: String(service_type),
      budget: Number(budget || 950000),
      currency: String(currency || 'INR'),
      timeline_weeks: Number(timeline_weeks || 12),
      user_prompt: String(user_prompt || ''),
      key_requirements: String(key_requirements || ''),
    });

    let aiCustom: StructuredProposalContent = { ...baseDomainContent };

    // 2. If a Gemini API key is configured or provided, query Gemini for additional custom enrichment
    if (configuredKey) {
      try {
        const prompt = `You are the Proposal Architect at NexInt AI (Chennai, India — "INTELLIGENCE BEYOND DATA").
Based on the user's prompt and client parameters below, return ONLY valid JSON matching the StructuredProposalContent schema to populate our 16-section NexInt AI proposal template:
- Client Company: ${company_name}
- Recipient: ${recipient_name}
- Project Title: ${project_title}
- Service Pillar: ${service_type}
- Budget: ${currency} ${budget}
- Timeline: ${timeline_weeks} weeks
- User Prompt: ${user_prompt}
- Key Requirements: ${key_requirements}

JSON Schema to return:
{
  "heroHeadline": "string (e.g. The ${company_name} ${project_title}: one AI-powered app for your entire ...)",
  "heroSubheadline": "string",
  "whatSummary": "string",
  "whoItServes": "string",
  "aiAndAutomationSummary": "string",
  "worksWithSummary": "string",
  "whatWeHeardHeadline": "string",
  "whatWeHeardIntro": "string",
  "whatWeHeardItems": [{"youSaid": "string", "today": "string"}] (8 items),
  "workflows": [{"title": "string", "today": "string", "assisted": "string", "badge": "string"}] (9 items),
  "modules": [{"title": "string", "desc": "string"}] (10 items),
  "aiCapabilities": [{"title": "string", "desc": "string"}] (14 items),
  "automationsList": ["string"] (14 items),
  "endToEndSteps": [{"title": "string", "desc": "string"}] (8 items)
}`;

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            configuredModel
          )}:generateContent?key=${encodeURIComponent(configuredKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );

        if (resp.ok) {
          const json: any = await resp.json();
          const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) {
            const parsed = JSON.parse(rawText);
            aiCustom = { ...baseDomainContent, ...parsed };
          }
        } else {
          console.warn(`Gemini API returned ${resp.status}; utilizing dynamic domain synthesizer.`);
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, utilizing dynamic domain synthesizer:', geminiErr);
      }
    }

    const generated = buildNexIntMasterProposal({
      company_name: String(company_name),
      recipient_name: String(recipient_name),
      recipient_email: String(recipient_email),
      project_title: String(project_title),
      service_type: String(service_type),
      budget: Number(budget || 950000),
      currency: String(currency || 'INR'),
      timeline_weeks: Number(timeline_weeks || 12),
      key_requirements: String(key_requirements || ''),
      user_prompt: String(user_prompt || ''),
      tone: String(tone),
      sender_name,
      aiCustom,
    });

    res.json(generated);
  } catch (err) {
    console.error('Error generating AI proposal:', err);
    res.status(500).json({ error: 'Failed to generate AI proposal' });
  }
});

// GET /api/proposals
proposalsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const proposals = await prisma.proposal.findMany({
      include: {
        lead: { select: { id: true, name: true, company: true, status: true } },
        client: { select: { id: true, company: true, contact_name: true, status: true } },
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const total = proposals.length;
    const draftCount = proposals.filter((p: any) => p.status === 'Draft').length;
    const sentCount = proposals.filter((p: any) => p.status === 'Sent').length;
    const acceptedCount = proposals.filter((p: any) => p.status === 'Accepted').length;
    const totalProposedValue = proposals.reduce(
      (sum: number, p: any) => sum + Number(p.budget || 0),
      0
    );

    res.json({
      proposals,
      summary: {
        total,
        draftCount,
        sentCount,
        acceptedCount,
        totalProposedValue,
      },
    });
  } catch (err) {
    console.error('Error fetching proposals:', err);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// Helper: Resolve associated Lead (by lead_id, client.lead_id, email, or company) and set status to 'Proposal sent'
async function syncLeadOnProposalSent(opts: {
  proposalId: string;
  proposalNumber: string;
  leadId?: string | null;
  clientId?: string | null;
  companyName: string;
  recipientEmail: string;
  projectTitle: string;
  budget: number;
  currency: string;
  userId?: string | null;
  userName?: string | null;
}): Promise<string | null> {
  let targetLeadId: string | null = opts.leadId ? String(opts.leadId) : null;

  // 1. If no lead_id directly provided, check if the selected client has a linked lead_id
  if (!targetLeadId && opts.clientId) {
    const client = await prisma.client.findUnique({ where: { id: String(opts.clientId) } });
    if (client?.lead_id) {
      targetLeadId = String(client.lead_id);
    }
  }

  // 2. If still no lead_id, match an existing lead by email or company name (case-insensitive)
  if (!targetLeadId) {
    const allLeads = await prisma.lead.findMany();
    const emailLower = String(opts.recipientEmail || '').trim().toLowerCase();
    const companyLower = String(opts.companyName || '').trim().toLowerCase();
    const matched = allLeads.find(
      (l: any) =>
        (emailLower && String(l.email || '').trim().toLowerCase() === emailLower) ||
        (companyLower && String(l.company || '').trim().toLowerCase() === companyLower)
    );
    if (matched) {
      targetLeadId = String(matched.id);
    }
  }

  if (!targetLeadId) {
    return null;
  }

  const lead = await prisma.lead.findUnique({ where: { id: targetLeadId } });
  if (!lead) {
    return null;
  }

  // Update Lead status to 'Proposal sent'
  await prisma.lead.update({
    where: { id: targetLeadId },
    data: { status: 'Proposal sent' },
  });

  // Link lead_id on the Proposal if not already set
  if (!opts.leadId) {
    await prisma.proposal.update({
      where: { id: opts.proposalId },
      data: { lead_id: targetLeadId },
    });
  }

  // Record a LeadNote
  await prisma.leadNote.create({
    data: {
      lead_id: targetLeadId,
      text: `Sent AI HTML Proposal ${opts.proposalNumber} ("${opts.projectTitle}") to ${opts.recipientEmail}. Lead status updated to Proposal sent.`,
      created_by: opts.userId || null,
    },
  });

  // Ensure Conversion pipeline entry exists for this lead
  const existingConv = await prisma.conversion.findUnique({
    where: { lead_id: targetLeadId },
  });
  if (!existingConv) {
    await prisma.conversion.create({
      data: {
        lead_id: targetLeadId,
        outcome: 'in_progress',
        currency: opts.currency || lead.currency || 'USD',
        deal_value: opts.budget || lead.budget || 0,
        history: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            from_outcome: null,
            to_outcome: 'in_progress',
            changed_by: opts.userName || 'User',
            note: `Proposal ${opts.proposalNumber} sent — Lead status changed to Proposal sent`,
          },
        ]),
      },
    });
  }

  return targetLeadId;
}

// POST /api/proposals — Save or Send Proposal
proposalsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body || {};
    const proposalNumber = await generateNextProposalNumber();
    const isSent = data.status === 'Sent';

    let created = await prisma.proposal.create({
      data: {
        proposal_number: proposalNumber,
        lead_id: data.lead_id || null,
        client_id: data.client_id || null,
        company_name: String(data.company_name || 'Client').trim(),
        recipient_name: String(data.recipient_name || 'Contact').trim(),
        recipient_email: String(data.recipient_email || '').trim(),
        project_title: String(data.project_title || 'IT Services Proposal').trim(),
        service_type: String(data.service_type || 'Custom software'),
        budget: Number(data.budget || 0),
        currency: String(data.currency || 'INR'),
        timeline_weeks: Number(data.timeline_weeks || 12),
        key_requirements: String(data.key_requirements || ''),
        email_subject: String(data.email_subject || ''),
        email_body: String(data.email_body || ''),
        html_proposal: String(data.html_proposal || ''),
        ai_model: String(data.ai_model || 'NexInt AI'),
        status: data.status || 'Draft',
        sent_at: isSent ? new Date() : null,
        created_by: req.user?.id || null,
      },
    });

    if (isSent) {
      const syncedLeadId = await syncLeadOnProposalSent({
        proposalId: created.id,
        proposalNumber,
        leadId: created.lead_id,
        clientId: created.client_id,
        companyName: created.company_name,
        recipientEmail: created.recipient_email,
        projectTitle: created.project_title,
        budget: created.budget,
        currency: created.currency,
        userId: req.user?.id || null,
        userName: req.user?.name || null,
      });
      if (syncedLeadId && !created.lead_id) {
        created = { ...created, lead_id: syncedLeadId };
      }
    }

    if (isSent && data.client_id) {
      await prisma.clientNote.create({
        data: {
          client_id: String(data.client_id),
          text: `Sent AI HTML Proposal ${proposalNumber} ("${created.project_title}") to ${created.recipient_email}.`,
          created_by: req.user?.id || null,
        },
      });
    }

    res.status(201).json({ proposal: created });
  } catch (err) {
    console.error('Error saving proposal:', err);
    res.status(500).json({ error: 'Failed to save proposal' });
  }
});

// PUT /api/proposals/:id — Update Proposal (Editable Mail Body, HTML Proposal, or Status)
proposalsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const data = req.body || {};
    const isSent = data.status === 'Sent';
    const markingSent = isSent && existing.status !== 'Sent';

    let updated = await prisma.proposal.update({
      where: { id },
      data: {
        ...(data.lead_id !== undefined ? { lead_id: data.lead_id } : {}),
        ...(data.client_id !== undefined ? { client_id: data.client_id } : {}),
        ...(data.company_name !== undefined ? { company_name: data.company_name } : {}),
        ...(data.recipient_name !== undefined ? { recipient_name: data.recipient_name } : {}),
        ...(data.recipient_email !== undefined ? { recipient_email: data.recipient_email } : {}),
        ...(data.project_title !== undefined ? { project_title: data.project_title } : {}),
        ...(data.service_type !== undefined ? { service_type: data.service_type } : {}),
        ...(data.budget !== undefined ? { budget: Number(data.budget) } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.timeline_weeks !== undefined
          ? { timeline_weeks: Number(data.timeline_weeks) }
          : {}),
        ...(data.key_requirements !== undefined
          ? { key_requirements: data.key_requirements }
          : {}),
        ...(data.email_subject !== undefined ? { email_subject: data.email_subject } : {}),
        ...(data.email_body !== undefined ? { email_body: data.email_body } : {}),
        ...(data.html_proposal !== undefined ? { html_proposal: String(data.html_proposal) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(markingSent ? { sent_at: new Date() } : {}),
      },
    });

    if (isSent) {
      const syncedLeadId = await syncLeadOnProposalSent({
        proposalId: updated.id,
        proposalNumber: updated.proposal_number,
        leadId: updated.lead_id,
        clientId: updated.client_id,
        companyName: updated.company_name,
        recipientEmail: updated.recipient_email,
        projectTitle: updated.project_title,
        budget: updated.budget,
        currency: updated.currency,
        userId: req.user?.id || null,
        userName: req.user?.name || null,
      });
      if (syncedLeadId && !updated.lead_id) {
        updated = { ...updated, lead_id: syncedLeadId };
      }
    }

    res.json({ proposal: updated });
  } catch (err) {
    console.error('Error updating proposal:', err);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// DELETE /api/proposals/:id
proposalsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  await prisma.proposal.delete({ where: { id } });
  res.json({ success: true });
});
