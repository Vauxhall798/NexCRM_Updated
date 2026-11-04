import { hashPassword } from '../src/lib/crypto-auth.ts';
import { prisma } from '../src/lib/prisma.ts';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log('Seeding NexCRM database...');

  // Clear existing data in dependency order
  await prisma.resourceAssignment.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.bauTicket.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.timelineEntry.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.client.deleteMany();
  await prisma.conversion.deleteMany();
  await prisma.leadNote.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await hashPassword('Admin123!');
  const memberHash = await hashPassword('Member123!');

  // 1. Seed Users
  const [admin, sarah, marcus, priya] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'NexInt AI admin',
        email: 'admin@nexcrm.io',
        password_hash: adminHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sarah Chen',
        email: 'sarah@nexcrm.io',
        password_hash: memberHash,
        role: 'MEMBER',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Marcus Vance',
        email: 'marcus@nexcrm.io',
        password_hash: memberHash,
        role: 'MEMBER',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Priya Nair',
        email: 'priya@nexcrm.io',
        password_hash: memberHash,
        role: 'MEMBER',
      },
    }),
  ]);

  // 2. Seed 11 Leads
  const leadsData = [
    {
      name: 'Elena Rostova',
      company: 'FinPulse Technologies',
      email: 'elena@finpulse.io',
      phone: '+1 (415) 890-2311',
      source: 'Referral',
      service: 'Custom software',
      budget: 85000,
      currency: 'USD',
      status: 'Negotiation',
      owner_id: sarah.id,
      next_followup: daysFromNow(2),
      notes: 'Looking for a real-time treasury dashboard and reconciliation engine.',
      created_at: daysFromNow(-45),
    },
    {
      name: 'David Kim',
      company: 'Veridian Health Systems',
      email: 'dkim@veridianhealth.org',
      phone: '+1 (312) 554-0192',
      source: 'Website',
      service: 'Mobile app',
      budget: 64000,
      currency: 'USD',
      status: 'Proposal sent',
      owner_id: marcus.id,
      next_followup: daysFromNow(4),
      notes: 'HIPAA-compliant patient appointment and telehealth iOS/Android app.',
      created_at: daysFromNow(-38),
    },
    {
      name: 'Lucas Meyer',
      company: 'Nordic Freight Logistics',
      email: 'l.meyer@nordicfreight.de',
      phone: '+49 40 8821 900',
      source: 'LinkedIn',
      service: 'Cloud/DevOps',
      budget: 48000,
      currency: 'EUR',
      status: 'Negotiation',
      owner_id: priya.id,
      next_followup: daysFromNow(1),
      notes: 'Kubernetes multi-region migration and zero-downtime CI/CD pipelines.',
      created_at: daysFromNow(-30),
    },
    {
      name: 'Hannah Abbott',
      company: 'Lumina Retail Group',
      email: 'habbott@luminaretail.com',
      phone: '+1 (646) 321-7740',
      source: 'Event',
      service: 'Web development',
      budget: 42000,
      currency: 'USD',
      status: 'Proposal sent',
      owner_id: sarah.id,
      next_followup: daysFromNow(-3), // Overdue follow-up!
      notes: 'Headless e-commerce storefront rebuild with Next.js and Shopify Plus.',
      created_at: daysFromNow(-25),
    },
    {
      name: 'Omar Al-Mansoor',
      company: 'DesertSun Energy',
      email: 'omar@desertsun.ae',
      phone: '+971 4 319 8820',
      source: 'Website',
      service: 'UI/UX',
      budget: 28000,
      currency: 'USD',
      status: 'Meeting scheduled',
      owner_id: admin.id,
      next_followup: daysFromNow(-1), // Overdue follow-up!
      notes: 'Complete design system for solar grid telemetry web portal.',
      created_at: daysFromNow(-20),
    },
    {
      name: 'Chloe Dubois',
      company: 'Atelier Moderne',
      email: 'chloe@ateliermoderne.fr',
      phone: '+33 1 42 68 55 10',
      source: 'Cold outreach',
      service: 'Web development',
      budget: 19500,
      currency: 'EUR',
      status: 'Contacted',
      owner_id: marcus.id,
      next_followup: daysFromNow(5),
      notes: 'B2B showroom ordering portal with custom 3D fabric previews.',
      created_at: daysFromNow(-18),
    },
    {
      name: 'Ryan O’Connor',
      company: 'Apex Legal Partners',
      email: 'roconnor@apexlegal.co.uk',
      phone: '+44 20 7946 0921',
      source: 'Referral',
      service: 'IT consulting',
      budget: 35000,
      currency: 'GBP',
      status: 'Proposal sent',
      owner_id: priya.id,
      next_followup: daysFromNow(-4), // Overdue follow-up!
      notes: 'SOC2 readiness audit and document management workflow modernization.',
      created_at: daysFromNow(-15),
    },
    {
      name: 'Mei Lin',
      company: 'Kinetix Robotics',
      email: 'meilin@kinetixbot.io',
      phone: '+1 (408) 772-9104',
      source: 'LinkedIn',
      service: 'Custom software',
      budget: 110000,
      currency: 'USD',
      status: 'Negotiation',
      owner_id: admin.id,
      next_followup: daysFromNow(3),
      notes: 'Fleet orchestration control plane for warehouse AMR robots.',
      created_at: daysFromNow(-12),
    },
    {
      name: 'Carlos Mendoza',
      company: 'AgroTrack LatAm',
      email: 'cmendoza@agrotrack.mx',
      phone: '+52 55 4162 8900',
      source: 'Event',
      service: 'Mobile app',
      budget: 31000,
      currency: 'USD',
      status: 'New',
      owner_id: sarah.id,
      next_followup: daysFromNow(2),
      notes: 'Offline-first field inspection mobile app for agronomy teams.',
      created_at: daysFromNow(-7),
    },
    {
      name: 'Samantha Brooks',
      company: 'ClearView Analytics',
      email: 'sbrooks@clearview.io',
      phone: '+1 (206) 441-9981',
      source: 'Website',
      service: 'Maintenance/support',
      budget: 24000,
      currency: 'USD',
      status: 'Contacted',
      owner_id: marcus.id,
      next_followup: daysFromNow(6),
      notes: '24/7 SLA retainer and AWS infrastructure optimization.',
      created_at: daysFromNow(-4),
    },
    {
      name: 'Vikramjit Singh',
      company: 'SwiftPay India',
      email: 'vikram@swiftpay.in',
      phone: '+91 80 4092 1100',
      source: 'Referral',
      service: 'Cloud/DevOps',
      budget: 52000,
      currency: 'USD',
      status: 'New',
      owner_id: priya.id,
      next_followup: daysFromNow(1),
      notes: 'PCI-DSS compliant cloud landing zone and automated failover setup.',
      created_at: daysFromNow(-2),
    },
  ];

  const createdLeads = [];
  for (const l of leadsData) {
    const lead = await prisma.lead.create({ data: l });
    createdLeads.push(lead);

    await prisma.leadNote.create({
      data: {
        lead_id: lead.id,
        text: `Lead captured via ${lead.source}. Initial scope: ${lead.notes}`,
        created_by: lead.owner_id,
        created_at: lead.created_at,
      },
    });
  }

  await prisma.leadNote.createMany({
    data: [
      {
        lead_id: createdLeads[0].id,
        text: 'Discovery call completed with CTO and VP Finance. Confirmed Q4 launch target.',
        created_by: sarah.id,
        created_at: daysFromNow(-35),
      },
      {
        lead_id: createdLeads[0].id,
        text: 'Statement of Work (SOW) signed at $88,000 USD.',
        created_by: admin.id,
        created_at: daysFromNow(-28),
      },
      {
        lead_id: createdLeads[3].id,
        text: 'Sent technical architecture proposal. Waiting on feedback from their e-commerce director.',
        created_by: sarah.id,
        created_at: daysFromNow(-10),
      },
      {
        lead_id: createdLeads[7].id,
        text: 'Demoed our telemetry prototype. Legal team is reviewing MSA terms.',
        created_by: admin.id,
        created_at: daysFromNow(-5),
      },
    ],
  });

  // 3. Seed Conversions
  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[0].id,
      outcome: 'converted',
      deal_value: 88000,
      currency: 'USD',
      comment: 'Signed full-scope custom treasury platform agreement.',
      decided_at: daysFromNow(-28),
      created_at: daysFromNow(-32),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-28).toISOString(),
          from_outcome: 'in_progress',
          to_outcome: 'converted',
          deal_value: 88000,
          currency: 'USD',
          comment: 'Signed full-scope custom treasury platform agreement.',
          changed_by: 'Alex Rivera',
        },
        {
          timestamp: daysFromNow(-32).toISOString(),
          from_outcome: null,
          to_outcome: 'in_progress',
          changed_by: 'Sarah Chen',
          note: 'Moved lead to Conversion pipeline',
        },
      ]),
    },
  });

  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[1].id,
      outcome: 'converted',
      deal_value: 67500,
      currency: 'USD',
      comment: 'Approved Phase 1 + Phase 2 mobile patient portal.',
      decided_at: daysFromNow(-21),
      created_at: daysFromNow(-26),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-21).toISOString(),
          from_outcome: 'in_progress',
          to_outcome: 'converted',
          deal_value: 67500,
          currency: 'USD',
          comment: 'Approved Phase 1 + Phase 2 mobile patient portal.',
          changed_by: 'Marcus Vance',
        },
      ]),
    },
  });

  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[2].id,
      outcome: 'converted',
      deal_value: 50000,
      currency: 'EUR',
      comment: 'Multi-region Kubernetes modernization contract signed.',
      decided_at: daysFromNow(-14),
      created_at: daysFromNow(-20),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-14).toISOString(),
          from_outcome: 'in_progress',
          to_outcome: 'converted',
          deal_value: 50000,
          currency: 'EUR',
          comment: 'Multi-region Kubernetes modernization contract signed.',
          changed_by: 'Priya Nair',
        },
      ]),
    },
  });

  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[5].id,
      outcome: 'not_converted',
      reason: 'Budget',
      comment: 'Client decided to use an off-the-shelf Shopify template for now.',
      deal_value: 19500,
      currency: 'EUR',
      decided_at: daysFromNow(-10),
      created_at: daysFromNow(-14),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-10).toISOString(),
          from_outcome: 'in_progress',
          to_outcome: 'not_converted',
          reason: 'Budget',
          comment: 'Client decided to use an off-the-shelf Shopify template for now.',
          changed_by: 'Marcus Vance',
        },
      ]),
    },
  });

  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[6].id,
      outcome: 'not_converted',
      reason: 'Timing',
      comment: 'Postponed IT modernization until next fiscal year Q2.',
      deal_value: 35000,
      currency: 'GBP',
      decided_at: daysFromNow(-6),
      created_at: daysFromNow(-11),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-6).toISOString(),
          from_outcome: 'in_progress',
          to_outcome: 'not_converted',
          reason: 'Timing',
          comment: 'Postponed IT modernization until next fiscal year Q2.',
          changed_by: 'Priya Nair',
        },
      ]),
    },
  });

  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[3].id,
      outcome: 'in_progress',
      deal_value: 42000,
      currency: 'USD',
      comment: 'Finalizing SLA terms with procurement.',
      created_at: daysFromNow(-8),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-8).toISOString(),
          from_outcome: null,
          to_outcome: 'in_progress',
          changed_by: 'Sarah Chen',
          note: 'Moved lead to Conversion pipeline',
        },
      ]),
    },
  });

  await prisma.conversion.create({
    data: {
      lead_id: createdLeads[7].id,
      outcome: 'in_progress',
      deal_value: 110000,
      currency: 'USD',
      comment: 'Technical architecture approved; legal redlines in review.',
      created_at: daysFromNow(-4),
      history: JSON.stringify([
        {
          timestamp: daysFromNow(-4).toISOString(),
          from_outcome: null,
          to_outcome: 'in_progress',
          changed_by: 'Alex Rivera',
          note: 'Moved lead to Conversion pipeline',
        },
      ]),
    },
  });

  // 4. Seed 5 Clients
  const client1 = await prisma.client.create({
    data: {
      lead_id: createdLeads[0].id,
      company: 'FinPulse Technologies',
      contact_name: 'Elena Rostova',
      email: 'elena@finpulse.io',
      phone: '+1 (415) 890-2311',
      address: '548 Market St, San Francisco, CA, USA',
      website: 'https://finpulse.io',
      industry: 'FinTech / Financial Services',
      status: 'Active',
      notes: 'Tier-1 strategic account. Weekly executive sync every Tuesday at 10am PT.',
      became_client_at: daysFromNow(-28),
    },
  });

  const client2 = await prisma.client.create({
    data: {
      lead_id: createdLeads[1].id,
      company: 'Veridian Health Systems',
      contact_name: 'David Kim',
      email: 'dkim@veridianhealth.org',
      phone: '+1 (312) 554-0192',
      address: '233 S Wacker Dr, Chicago, IL, USA',
      website: 'https://veridianhealth.org',
      industry: 'Healthcare & Telemedicine',
      status: 'Active',
      notes: 'Requires strict HIPAA compliance sign-off on all staging deployments.',
      became_client_at: daysFromNow(-21),
    },
  });

  const client3 = await prisma.client.create({
    data: {
      lead_id: createdLeads[2].id,
      company: 'Nordic Freight Logistics',
      contact_name: 'Lucas Meyer',
      email: 'l.meyer@nordicfreight.de',
      phone: '+49 40 8821 900',
      address: 'Speicherstadt 14, Hamburg, Germany',
      website: 'https://nordicfreight.de',
      industry: 'Supply Chain & Logistics',
      status: 'Active',
      notes: 'EU data residency required (Frankfurt AWS region eu-central-1).',
      became_client_at: daysFromNow(-14),
    },
  });

  const client4 = await prisma.client.create({
    data: {
      company: 'Stratos Aerospace Labs',
      contact_name: 'Dr. Aris Thorne',
      email: 'athorne@stratosaero.com',
      phone: '+1 (303) 619-4400',
      address: '1700 Broadway, Denver, CO, USA',
      website: 'https://stratosaero.com',
      industry: 'Aerospace & Defense',
      status: 'Active',
      notes: 'Long-term partner referred by board advisor. Multi-project engagement.',
      became_client_at: daysFromNow(-60),
    },
  });

  const client5 = await prisma.client.create({
    data: {
      company: 'Oakridge Hospitality Group',
      contact_name: 'Claire Fontaine',
      email: 'claire@oakridgehotels.com',
      phone: '+1 (305) 901-3345',
      address: '1200 Brickell Ave, Miami, FL, USA',
      website: 'https://oakridgehotels.com',
      industry: 'Hospitality & Travel',
      status: 'Completed',
      notes: 'Completed booking engine overhaul; currently evaluating Q1 maintenance retainer.',
      became_client_at: daysFromNow(-90),
    },
  });

  await prisma.clientNote.createMany({
    data: [
      {
        client_id: client1.id,
        text: 'Converted from lead with $88,000 USD initial contract.',
        created_by: admin.id,
        created_at: daysFromNow(-28),
      },
      {
        client_id: client1.id,
        text: 'Onboarded engineering team to shared Slack channel and GitHub organization.',
        created_by: sarah.id,
        created_at: daysFromNow(-25),
      },
      {
        client_id: client2.id,
        text: 'Signed BAA (Business Associate Agreement) for HIPAA compliance.',
        created_by: marcus.id,
        created_at: daysFromNow(-20),
      },
      {
        client_id: client4.id,
        text: 'Approved Phase 2 telemetry analytics expansion.',
        created_by: admin.id,
        created_at: daysFromNow(-15),
      },
    ],
  });

  // 5. Seed 6 Projects
  const proj1 = await prisma.project.create({
    data: {
      client_id: client1.id,
      name: 'FinPulse Treasury & Reconciliation Engine',
      description:
        'High-throughput ledger reconciliation microservice and real-time CFO cashflow cockpit.',
      service_type: 'Custom software',
      status: 'In progress',
      start_date: daysFromNow(-25),
      end_date: daysFromNow(35),
      budget: 88000,
      currency: 'USD',
      manager_id: sarah.id,
      tech_stack: 'TypeScript, Node.js, PostgreSQL, React, Kafka, Docker',
      progress: 60,
      progress_override: false,
      notes: 'Core ledger engine is live in staging; bank webhook connectors in progress.',
    },
  });

  const proj2 = await prisma.project.create({
    data: {
      client_id: client2.id,
      name: 'Veridian Telehealth Mobile App (iOS & Android)',
      description:
        'Cross-platform mobile application with encrypted HD video consultations and prescription tracking.',
      service_type: 'Mobile app',
      status: 'In progress',
      start_date: daysFromNow(-18),
      end_date: daysFromNow(45),
      budget: 67500,
      currency: 'USD',
      manager_id: marcus.id,
      tech_stack: 'React Native, TypeScript, WebRTC, Node.js, AWS',
      progress: 50,
      progress_override: false,
      notes: 'UI/UX approved; video consultation SDK integration underway.',
    },
  });

  const proj3 = await prisma.project.create({
    data: {
      client_id: client3.id,
      name: 'Multi-Region Kubernetes Cloud Migration',
      description:
        'Zero-downtime migration of legacy freight tracking monolith to EKS clusters with Terraform.',
      service_type: 'Cloud/DevOps',
      status: 'In progress',
      start_date: daysFromNow(-12),
      end_date: daysFromNow(18),
      budget: 50000,
      currency: 'EUR',
      manager_id: priya.id,
      tech_stack: 'AWS EKS, Terraform, ArgoCD, Prometheus, Grafana',
      progress: 50,
      progress_override: false,
      notes: 'Staging cluster provisioned; running load tests before production cutover.',
    },
  });

  const proj4 = await prisma.project.create({
    data: {
      client_id: client4.id,
      name: 'Flight Telemetry Visualization Portal',
      description:
        'WebGL-accelerated sensor telemetry dashboard for propulsion test bench engineers.',
      service_type: 'Web development',
      status: 'In progress',
      start_date: daysFromNow(-40),
      end_date: daysFromNow(10),
      budget: 74000,
      currency: 'USD',
      manager_id: admin.id,
      tech_stack: 'React, TypeScript, Three.js, FastAPI, TimescaleDB',
      progress: 75,
      progress_override: false,
      notes: 'Final UAT cycle scheduled for next week.',
    },
  });

  const proj5 = await prisma.project.create({
    data: {
      client_id: client4.id,
      name: 'Supply Chain Vendor Portal Audit',
      description: 'Security architecture review and SSO federation for aerospace sub-tier suppliers.',
      service_type: 'IT consulting',
      status: 'Planned',
      start_date: daysFromNow(10),
      end_date: daysFromNow(50),
      budget: 29000,
      currency: 'USD',
      manager_id: priya.id,
      tech_stack: 'Okta, OAuth2, SAML, AWS IAM',
      progress: 0,
      progress_override: false,
      notes: 'Kickoff scheduled once Flight Telemetry Portal reaches UAT sign-off.',
    },
  });

  const proj6 = await prisma.project.create({
    data: {
      client_id: client5.id,
      name: 'Oakridge Direct Booking Engine Redesign',
      description:
        'Full UI/UX overhaul and custom reservation checkout flow across 14 boutique properties.',
      service_type: 'UI/UX',
      status: 'Completed',
      start_date: daysFromNow(-85),
      end_date: daysFromNow(-15),
      budget: 46000,
      currency: 'USD',
      manager_id: sarah.id,
      tech_stack: 'Figma, Next.js, Tailwind CSS, Stripe',
      progress: 100,
      progress_override: false,
      notes: 'Delivered on time; conversion rate increased by 28% post-launch.',
    },
  });

  // 6. Seed Timeline Entries across projects
  await prisma.timelineEntry.createMany({
    data: [
      {
        project_id: proj1.id,
        title: 'Architecture & Ledger Schema Sign-Off',
        description: 'Finalized double-entry database schema and idempotency keys with FinPulse CTO.',
        type: 'Milestone',
        start_date: daysFromNow(-24),
        end_date: daysFromNow(-20),
        status: 'Done',
        assignee_id: sarah.id,
        sort_order: 1,
      },
      {
        project_id: proj1.id,
        title: 'Core Reconciliation Engine Implementation',
        description: 'Built streaming transaction matcher handling 10k events/minute.',
        type: 'Task',
        start_date: daysFromNow(-19),
        end_date: daysFromNow(-8),
        status: 'Done',
        assignee_id: marcus.id,
        sort_order: 2,
      },
      {
        project_id: proj1.id,
        title: 'Mid-Sprint Executive Demo',
        description: 'Live walkthrough of automated exception handling workflow.',
        type: 'Meeting',
        start_date: daysFromNow(-6),
        end_date: daysFromNow(-6),
        status: 'Done',
        assignee_id: sarah.id,
        sort_order: 3,
      },
      {
        project_id: proj1.id,
        title: 'Plaid & SWIFT Webhook Connectors',
        description: 'Integrating multi-currency bank feed ingestion adapters.',
        type: 'Task',
        start_date: daysFromNow(-5),
        end_date: daysFromNow(10),
        status: 'In progress',
        assignee_id: priya.id,
        sort_order: 4,
      },
      {
        project_id: proj1.id,
        title: 'Production Cutover & CFO Sign-off',
        description: 'Final load testing, SOC2 audit log verification, and production release.',
        type: 'Delivery',
        start_date: daysFromNow(25),
        end_date: daysFromNow(35),
        status: 'Planned',
        assignee_id: admin.id,
        sort_order: 5,
      },
      {
        project_id: proj2.id,
        title: 'HIPAA Threat Modeling & Wireframes',
        description: 'Completed encryption-at-rest architecture and patient onboarding flows.',
        type: 'Milestone',
        start_date: daysFromNow(-17),
        end_date: daysFromNow(-12),
        status: 'Done',
        assignee_id: marcus.id,
        sort_order: 1,
      },
      {
        project_id: proj2.id,
        title: 'Authentication & Biometric Login Module',
        description: 'Implemented FaceID / TouchID with OAuth2 PKCE token rotation.',
        type: 'Task',
        start_date: daysFromNow(-11),
        end_date: daysFromNow(-3),
        status: 'Done',
        assignee_id: marcus.id,
        sort_order: 2,
      },
      {
        project_id: proj2.id,
        title: 'WebRTC HD Video Consultation Room',
        description: 'Building low-latency video/audio session handling with waiting room queue.',
        type: 'Task',
        start_date: daysFromNow(-2),
        end_date: daysFromNow(15),
        status: 'In progress',
        assignee_id: sarah.id,
        sort_order: 3,
      },
      {
        project_id: proj2.id,
        title: 'App Store & Google Play Beta Release',
        description: 'TestFlight and Play Console internal distribution for 50 clinicians.',
        type: 'Delivery',
        start_date: daysFromNow(30),
        end_date: daysFromNow(45),
        status: 'Planned',
        assignee_id: marcus.id,
        sort_order: 4,
      },
      {
        project_id: proj3.id,
        title: 'Terraform Landing Zone & VPC Peering',
        description: 'Provisioned multi-AZ Frankfurt EKS clusters and encrypted RDS instances.',
        type: 'Milestone',
        start_date: daysFromNow(-11),
        end_date: daysFromNow(-6),
        status: 'Done',
        assignee_id: priya.id,
        sort_order: 1,
      },
      {
        project_id: proj3.id,
        title: 'ArgoCD GitOps Pipeline Setup',
        description: 'Automated canary deployments with Prometheus rollback triggers.',
        type: 'Task',
        start_date: daysFromNow(-5),
        end_date: daysFromNow(-1),
        status: 'Done',
        assignee_id: priya.id,
        sort_order: 2,
      },
      {
        project_id: proj3.id,
        title: 'Legacy VPN Firewall Rule Whitelisting',
        description: 'Waiting on third-party customs gateway carrier to update IP whitelist.',
        type: 'Issue',
        start_date: daysFromNow(-2),
        end_date: daysFromNow(3),
        status: 'Delayed',
        assignee_id: admin.id,
        sort_order: 3,
      },
      {
        project_id: proj3.id,
        title: 'Zero-Downtime Production Cutover',
        description: 'DNS weighted traffic shift and live freight telemetry validation.',
        type: 'Delivery',
        start_date: daysFromNow(12),
        end_date: daysFromNow(18),
        status: 'In progress',
        assignee_id: priya.id,
        sort_order: 4,
      },
      {
        project_id: proj4.id,
        title: 'TimescaleDB Telemetry Ingestion Benchmark',
        description: 'Verified 100k sensor readings/sec ingestion with sub-50ms query latency.',
        type: 'Milestone',
        start_date: daysFromNow(-38),
        end_date: daysFromNow(-28),
        status: 'Done',
        assignee_id: admin.id,
        sort_order: 1,
      },
      {
        project_id: proj4.id,
        title: 'WebGL 60fps Oscilloscope Chart Engine',
        description: 'Built custom canvas shader for multi-channel vibration and thermal streams.',
        type: 'Task',
        start_date: daysFromNow(-27),
        end_date: daysFromNow(-12),
        status: 'Done',
        assignee_id: sarah.id,
        sort_order: 2,
      },
      {
        project_id: proj4.id,
        title: 'Anomaly Export & PDF Test Report Generator',
        description: 'Automated post-burn summary export for propulsion engineering leads.',
        type: 'Delivery',
        start_date: daysFromNow(-11),
        end_date: daysFromNow(-2),
        status: 'Done',
        assignee_id: marcus.id,
        sort_order: 3,
      },
      {
        project_id: proj4.id,
        title: 'Final UAT & Flight Readiness Handover',
        description: 'On-site acceptance testing with Stratos propulsion team.',
        type: 'Milestone',
        start_date: daysFromNow(1),
        end_date: daysFromNow(10),
        status: 'In progress',
        assignee_id: admin.id,
        sort_order: 4,
      },
      {
        project_id: proj5.id,
        title: 'Supplier IAM Discovery Workshop',
        description: 'Inventory current SAML/OIDC identity providers across 40 tier-2 vendors.',
        type: 'Meeting',
        start_date: daysFromNow(10),
        end_date: daysFromNow(15),
        status: 'Planned',
        assignee_id: priya.id,
        sort_order: 1,
      },
      {
        project_id: proj5.id,
        title: 'Zero-Trust Access Policy Blueprint',
        description: 'Deliver NIST 800-171 compliant architecture and Okta federation scripts.',
        type: 'Delivery',
        start_date: daysFromNow(25),
        end_date: daysFromNow(50),
        status: 'Planned',
        assignee_id: priya.id,
        sort_order: 2,
      },
      {
        project_id: proj6.id,
        title: 'Design System & Checkout Prototype',
        description: 'Delivered responsive Figma component library and usability test results.',
        type: 'Milestone',
        start_date: daysFromNow(-80),
        end_date: daysFromNow(-50),
        status: 'Done',
        assignee_id: sarah.id,
        sort_order: 1,
      },
      {
        project_id: proj6.id,
        title: 'Production Launch Across 14 Properties',
        description: 'Completed rollout with Stripe multi-currency payment intents.',
        type: 'Delivery',
        start_date: daysFromNow(-45),
        end_date: daysFromNow(-15),
        status: 'Done',
        assignee_id: sarah.id,
        sort_order: 2,
      },
    ],
  });

  // 7. Seed 6 Client Feedback Entries
  await prisma.feedback.createMany({
    data: [
      {
        client_id: client1.id,
        project_id: proj1.id,
        rating: 5,
        sentiment: 'Positive',
        category: 'Technical Expertise',
        comment:
          'The double-entry reconciliation engine handled 12,000 concurrent transactions during our end-of-month close with zero discrepancies. Outstanding engineering rigor from Sarah and Marcus.',
        action_taken: 'Shared praise with the engineering team and documented architecture pattern for future FinTech engagements.',
        status: 'Resolved',
        submitted_by: 'Elena Rostova, CTO at FinPulse',
        feedback_date: daysFromNow(-5),
        recorded_by: sarah.id,
        is_testimonial: true,
      },
      {
        client_id: client5.id,
        project_id: proj6.id,
        rating: 5,
        sentiment: 'Positive',
        category: 'Delivery Quality',
        comment:
          'Our direct booking conversion rate jumped 28% within the first three weeks of launching the redesigned checkout flow across all 14 boutique hotels.',
        action_taken: 'Published case study with client approval and scheduled Q1 maintenance retainer review.',
        status: 'Resolved',
        submitted_by: 'Claire Fontaine, VP Digital at Oakridge',
        feedback_date: daysFromNow(-12),
        recorded_by: admin.id,
        is_testimonial: true,
      },
      {
        client_id: client2.id,
        project_id: proj2.id,
        rating: 4,
        sentiment: 'Constructive',
        category: 'Communication',
        comment:
          'The biometric login and HIPAA security work is rock solid, but our clinical compliance officers would like 48 hours advance notice before staging builds are refreshed.',
        action_taken: 'Added automated Slack release window notifications 48h prior to every staging deployment.',
        status: 'Resolved',
        submitted_by: 'David Kim, Director of Clinical IT',
        feedback_date: daysFromNow(-4),
        recorded_by: marcus.id,
        is_testimonial: false,
      },
      {
        client_id: client3.id,
        project_id: proj3.id,
        rating: 3,
        sentiment: 'Constructive',
        category: 'Timeline & Speed',
        comment:
          'EKS Terraform automation is great, though the third-party customs VPN firewall whitelisting delay pushed our staging cutover test by 3 days. Need tighter carrier escalation.',
        action_taken: 'Set up daily 15-min standup directly with the carrier network engineer until production cutover completes.',
        status: 'Action in progress',
        submitted_by: 'Lucas Meyer, Head of Infrastructure',
        feedback_date: daysFromNow(-2),
        recorded_by: priya.id,
        is_testimonial: false,
      },
      {
        client_id: client4.id,
        project_id: proj4.id,
        rating: 5,
        sentiment: 'Positive',
        category: 'Delivery Quality',
        comment:
          'The 60fps WebGL telemetry oscilloscope exceeded our propulsion engineers’ expectations. We can now inspect sub-millisecond sensor anomalies right in the browser.',
        action_taken: 'Prepared Phase 2 Supply Chain Vendor Portal kickoff deck.',
        status: 'Reviewed',
        submitted_by: 'Dr. Aris Thorne, Chief Propulsion Scientist',
        feedback_date: daysFromNow(-1),
        recorded_by: admin.id,
        is_testimonial: true,
      },
      {
        client_id: client1.id,
        project_id: proj1.id,
        rating: 4,
        sentiment: 'Positive',
        category: 'Support & SLA',
        comment:
          'Quick turnaround on the SWIFT MT940 parser edge-case we reported on Thursday afternoon. Would love a self-service webhook retry button in the admin UI.',
        action_taken: 'Scoped webhook manual retry button for Sprint 5 backlog.',
        status: 'New',
        submitted_by: 'Elena Rostova, CTO at FinPulse',
        feedback_date: daysFromNow(0),
        recorded_by: sarah.id,
        is_testimonial: false,
      },
    ],
  });

  // 8. Seed 6 BAU Tickets across New, Work in progress, Pending, and Resolved states
  await prisma.bauTicket.createMany({
    data: [
      {
        ticket_number: 'BAU-101',
        client_id: client5.id,
        project_id: proj6.id,
        title: 'Apple Pay express checkout button alignment on iOS 18 Safari',
        description:
          'Guests booking from iPhone 16 Pro see a 4px overlap on the promo code input when Apple Pay express sheet dismisses.',
        category: 'Bug / Defect',
        priority: 'High',
        state: 'New',
        reported_by: 'Claire Fontaine, VP Digital at Oakridge',
        assignee_id: sarah.id,
        resolution_notes: 'Reproduced in BrowserStack iOS 18 simulator; preparing CSS safe-area patch.',
        sla_due_date: daysFromNow(2),
        created_at: daysFromNow(-1),
      },
      {
        ticket_number: 'BAU-102',
        client_id: client5.id,
        project_id: proj6.id,
        title: 'Add seasonal winter resort package badge to property cards',
        description:
          'Marketing team requested a configurable gold badge on the Aspen and Vail property tiles for Q4 ski season packages.',
        category: 'Change Request',
        priority: 'Medium',
        state: 'Work in progress',
        reported_by: 'Claire Fontaine, VP Digital at Oakridge',
        assignee_id: marcus.id,
        resolution_notes: 'CMS field added; deploying frontend component to staging today.',
        sla_due_date: daysFromNow(4),
        created_at: daysFromNow(-3),
      },
      {
        ticket_number: 'BAU-103',
        client_id: client1.id,
        project_id: proj1.id,
        title: 'SWIFT MT940 parser edge-case on non-UTF8 European bank memos',
        description:
          'Transactions originating from regional German savings banks with umlaut characters in field :86: were flagged as unparsed.',
        category: 'Bug / Defect',
        priority: 'Critical',
        state: 'Resolved',
        reported_by: 'Elena Rostova, CTO at FinPulse',
        assignee_id: sarah.id,
        resolution_notes: 'Patched ISO-8859-15 character decoder and reprocessed 142 queued statements.',
        sla_due_date: daysFromNow(-2),
        resolved_at: daysFromNow(-3),
        created_at: daysFromNow(-5),
      },
      {
        ticket_number: 'BAU-104',
        client_id: client4.id,
        project_id: proj4.id,
        title: 'Export CSV option for 100Hz propulsion vibration intervals',
        description:
          'Propulsion engineers need raw CSV export in addition to PDF post-burn summary reports.',
        category: 'Data / Reporting',
        priority: 'Medium',
        state: 'Work in progress',
        reported_by: 'Dr. Aris Thorne, Stratos Aerospace',
        assignee_id: admin.id,
        resolution_notes: 'Streaming worker endpoint implemented; testing 50MB download memory footprint.',
        sla_due_date: daysFromNow(3),
        created_at: daysFromNow(-2),
      },
      {
        ticket_number: 'BAU-105',
        client_id: client3.id,
        project_id: proj3.id,
        title: 'Rotate production IAM service account keys for customs EDI feed',
        description:
          'Quarterly security policy requires rotating the customs gateway IAM credentials and verifying zero packet drop.',
        category: 'Access & Security',
        priority: 'High',
        state: 'Pending',
        reported_by: 'Lucas Meyer, Nordic Freight',
        assignee_id: priya.id,
        resolution_notes: 'Waiting on client security officer approval for maintenance window.',
        sla_due_date: daysFromNow(1),
        created_at: daysFromNow(-4),
      },
      {
        ticket_number: 'BAU-106',
        client_id: client5.id,
        project_id: proj6.id,
        title: 'Stripe webhook retry optimization for delayed 3DS2 bank callbacks',
        description:
          'Ensure European 3D-Secure delayed payment intents automatically sync reservation status within 30 seconds.',
        category: 'Performance',
        priority: 'High',
        state: 'Resolved',
        reported_by: 'Claire Fontaine, VP Digital at Oakridge',
        assignee_id: sarah.id,
        resolution_notes: 'Configured idempotent webhook queue consumer; verified zero duplicate bookings.',
        sla_due_date: daysFromNow(-10),
        resolved_at: daysFromNow(-11),
        created_at: daysFromNow(-14),
      },
    ],
  });

  // 9. Seed Company Resources & Project Assignments
  const [res1, res2, res3, res4, res5, res6, res7, res8] = await Promise.all([
    prisma.resource.create({
      data: {
        name: 'Sarah Chen',
        email: 'sarah@nexcrm.io',
        role_title: 'Principal Full-Stack Architect',
        department: 'Engineering',
        seniority: 'Principal',
        skills: 'Node.js, TypeScript, React, PostgreSQL, Kafka, Distributed Systems',
        total_capacity: 100,
        hourly_rate: 145,
        on_leave: false,
        notes: 'Lead architect for FinTech and high-throughput web platforms.',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Marcus Vance',
        email: 'marcus@nexcrm.io',
        role_title: 'Senior Mobile & Web Engineer',
        department: 'Engineering',
        seniority: 'Senior',
        skills: 'React Native, TypeScript, WebRTC, iOS, GraphQL, Next.js',
        total_capacity: 100,
        hourly_rate: 120,
        on_leave: false,
        notes: 'Specializes in HIPAA-compliant mobile apps and real-time video.',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Priya Patel',
        email: 'priya@nexcrm.io',
        role_title: 'Lead Cloud & DevOps Engineer',
        department: 'Cloud & DevOps',
        seniority: 'Principal',
        skills: 'AWS EKS, Terraform, Kubernetes, ArgoCD, Prometheus, Zero-Trust IAM',
        total_capacity: 100,
        hourly_rate: 135,
        on_leave: false,
        notes: 'AWS Certified Solutions Architect Professional & CKA.',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Rohan Deshmukh',
        email: 'rohan.d@nexcrm.io',
        role_title: 'Senior AI & Data Engineer',
        department: 'AI & Data',
        seniority: 'Senior',
        skills: 'Python, FastAPI, TimescaleDB, PyTorch, RAG, Vector Databases',
        total_capacity: 100,
        hourly_rate: 130,
        on_leave: false,
        notes: 'Available for new AI/ML and data pipeline engagements.',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Elena Gomez',
        email: 'elena.g@nexcrm.io',
        role_title: 'Lead Product Designer (UI/UX)',
        department: 'Design & UX',
        seniority: 'Senior',
        skills: 'Figma, Design Systems, Prototyping, User Research, Tailwind CSS',
        total_capacity: 100,
        hourly_rate: 110,
        on_leave: false,
        notes: 'Led the Oakridge Hospitality redesign (+28% checkout conversion).',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Devon Brooks',
        email: 'devon.b@nexcrm.io',
        role_title: 'Full-Stack Software Engineer',
        department: 'Engineering',
        seniority: 'Mid-Level',
        skills: 'React, Three.js, WebGL, TypeScript, Node.js, Tailwind CSS',
        total_capacity: 100,
        hourly_rate: 95,
        on_leave: false,
        notes: 'Frontend visualization specialist.',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Aisha Khan',
        email: 'aisha.k@nexcrm.io',
        role_title: 'QA Automation & Release Lead',
        department: 'Delivery & QA',
        seniority: 'Senior',
        skills: 'Playwright, Cypress, k6 Load Testing, SOC2 Compliance, CI/CD',
        total_capacity: 100,
        hourly_rate: 90,
        on_leave: false,
        notes: 'Handles end-to-end automated regression and performance benchmarking.',
      },
    }),
    prisma.resource.create({
      data: {
        name: 'Liam O’Connor',
        email: 'liam.o@nexcrm.io',
        role_title: 'Cloud Infrastructure Engineer',
        department: 'Cloud & DevOps',
        seniority: 'Mid-Level',
        skills: 'Docker, Terraform, GitHub Actions, Linux, Datadog',
        total_capacity: 100,
        hourly_rate: 95,
        on_leave: true,
        notes: 'On planned paternity leave until next month.',
      },
    }),
  ]);

  await prisma.resourceAssignment.createMany({
    data: [
      {
        resource_id: res1.id, // Sarah Chen (100% allocated -> Fully Booked)
        project_id: proj1.id,
        assignment_role: 'Principal Architect & Tech Lead',
        allocation_pct: 60,
        start_date: daysFromNow(-25),
        end_date: daysFromNow(35),
        status: 'Active',
        notes: 'Leading core double-entry ledger & SWIFT connectors.',
      },
      {
        resource_id: res1.id, // Sarah Chen (+40% = 100%)
        project_id: proj4.id,
        assignment_role: 'WebGL Visualization Advisor',
        allocation_pct: 40,
        start_date: daysFromNow(-40),
        end_date: daysFromNow(10),
        status: 'Active',
        notes: 'Overseeing 60fps shader optimization for UAT.',
      },
      {
        resource_id: res2.id, // Marcus Vance (75% allocated -> 25% Available)
        project_id: proj2.id,
        assignment_role: 'Mobile Lead (React Native)',
        allocation_pct: 75,
        start_date: daysFromNow(-18),
        end_date: daysFromNow(45),
        status: 'Active',
        notes: 'Building biometric auth & WebRTC consultation rooms.',
      },
      {
        resource_id: res3.id, // Priya Patel (80% Active + 50% Planned -> 20% Available now)
        project_id: proj3.id,
        assignment_role: 'Lead Cloud Architect',
        allocation_pct: 80,
        start_date: daysFromNow(-12),
        end_date: daysFromNow(18),
        status: 'Active',
        notes: 'Driving multi-region Frankfurt EKS cutover.',
      },
      {
        resource_id: res3.id,
        project_id: proj5.id,
        assignment_role: 'Security & IAM Principal',
        allocation_pct: 50,
        start_date: daysFromNow(10),
        end_date: daysFromNow(50),
        status: 'Planned',
        notes: 'Scheduled once EKS migration completes.',
      },
      {
        resource_id: res4.id, // Rohan Deshmukh (40% allocated -> 60% Available)
        project_id: proj4.id,
        assignment_role: 'TimescaleDB & FastAPI Engineer',
        allocation_pct: 40,
        start_date: daysFromNow(-40),
        end_date: daysFromNow(10),
        status: 'Active',
        notes: 'Maintaining 100k/sec sensor ingestion pipeline.',
      },
      {
        resource_id: res5.id, // Elena Gomez (0% Active, 100% Completed -> 100% Available!)
        project_id: proj6.id,
        assignment_role: 'Lead UI/UX Designer',
        allocation_pct: 100,
        start_date: daysFromNow(-85),
        end_date: daysFromNow(-15),
        status: 'Completed',
        notes: 'Completed 14-property booking engine redesign.',
      },
      {
        resource_id: res6.id, // Devon Brooks (100% allocated -> Fully Booked)
        project_id: proj1.id,
        assignment_role: 'Frontend React Engineer',
        allocation_pct: 50,
        start_date: daysFromNow(-20),
        end_date: daysFromNow(35),
        status: 'Active',
        notes: 'Building exception handling & reconciliation UI.',
      },
      {
        resource_id: res6.id,
        project_id: proj2.id,
        assignment_role: 'React Native UI Engineer',
        allocation_pct: 50,
        start_date: daysFromNow(-15),
        end_date: daysFromNow(45),
        status: 'Active',
        notes: 'Patient intake & appointment scheduling screens.',
      },
      {
        resource_id: res7.id, // Aisha Khan (30% allocated -> 70% Available)
        project_id: proj1.id,
        assignment_role: 'QA & Load Testing Lead',
        allocation_pct: 30,
        start_date: daysFromNow(-10),
        end_date: daysFromNow(35),
        status: 'Active',
        notes: 'Automated k6 stress testing for 10k events/min.',
      },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
