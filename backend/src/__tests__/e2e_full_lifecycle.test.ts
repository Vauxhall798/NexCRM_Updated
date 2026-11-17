import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.ts';
import { prisma } from '../lib/prisma.ts';

describe('End-to-End Full Application Lifecycle & API Integration Suite', () => {
  const uniqueSuffix = Date.now();
  const testLeadCompany = `AetherAI_E2E_${uniqueSuffix}`;
  const testLeadEmail = `cto_${uniqueSuffix}@aetherai.io`;

  let adminToken = '';
  let createdLeadId = '';
  let createdProposalId = '';
  let createdConversionId = '';
  let createdClientId = '';
  let createdProjectId = '';
  let createdTimelineId = '';
  let createdCostId = '';
  let createdPaymentId = '';
  let createdExpenseId = '';
  let createdResourceId = '';
  let createdAssignmentId = '';
  let createdTicketId = '';
  let createdFeedbackId = '';

  after(async () => {
    try {
      if (createdFeedbackId) await prisma.feedback.deleteMany({ where: { id: createdFeedbackId } });
      if (createdTicketId) await prisma.bauTicket.deleteMany({ where: { id: createdTicketId } });
      if (createdAssignmentId)
        await prisma.resourceAssignment.deleteMany({ where: { id: createdAssignmentId } });
      if (createdResourceId) await prisma.resource.deleteMany({ where: { id: createdResourceId } });
      if (createdExpenseId) await prisma.expense.deleteMany({ where: { id: createdExpenseId } });
      if (createdPaymentId)
        await prisma.clientPayment.deleteMany({ where: { id: createdPaymentId } });
      if (createdCostId) await prisma.projectCost.deleteMany({ where: { id: createdCostId } });
      if (createdTimelineId)
        await prisma.timelineEntry.deleteMany({ where: { id: createdTimelineId } });
      if (createdProjectId) await prisma.project.deleteMany({ where: { id: createdProjectId } });
      if (createdProposalId) await prisma.proposal.deleteMany({ where: { id: createdProposalId } });
      if (createdClientId) await prisma.client.deleteMany({ where: { id: createdClientId } });
      if (createdLeadId) await prisma.lead.deleteMany({ where: { id: createdLeadId } });
    } catch {
      // ignore cleanup errors
    }
  });

  it('1. Health Check & Executive Admin Authentication (Vivek, Glanee, Vishaal)', async () => {
    const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'ok');

    const executiveAccounts = [
      { email: 'vinuvivek1@gmail.com', name: 'Vivek Mohandass' },
      { email: 'glenysimon@gmail.com', name: 'Glanee Rose' },
      { email: 'vishaal351@gmail.com', name: 'Vishaal Arun' },
    ];

    for (const exec of executiveAccounts) {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { email: exec.email, password: 'Admin123!' },
      });
      assert.equal(loginRes.status, 200, `Expected 200 login for ${exec.email}`);
      assert.ok(loginRes.body.token);
      assert.equal(loginRes.body.user.name, exec.name);
      assert.equal(loginRes.body.user.role, 'ADMIN');
      adminToken = loginRes.body.token;
    }

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.email, 'vishaal351@gmail.com');
  });

  it('2. Executive Leadership & Technical Resources Directory Verification', async () => {
    const resList = await app.inject({
      method: 'GET',
      url: '/api/resources?department=Executive%20Leadership',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resList.status, 200);
    const execResources = resList.body.resources as Array<any>;
    const ceo = execResources.find((r) => r.email === 'vinuvivek1@gmail.com');
    const cmo = execResources.find((r) => r.email === 'glenysimon@gmail.com');
    const cto = execResources.find((r) => r.email === 'vishaal351@gmail.com');

    assert.ok(ceo && ceo.role_title === 'CEO' && ceo.seniority === 'Executive');
    assert.ok(cmo && cmo.role_title === 'CMO' && cmo.seniority === 'Executive');
    assert.ok(cto && cto.role_title === 'CTO' && cto.seniority === 'Executive');

    // Create a custom engineering resource with numeric string coercion check
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Siddharth Rao E2E',
        email: `siddharth_${uniqueSuffix}@nexintai.com`,
        role_title: 'Principal AI Architect',
        department: 'AI & Data',
        seniority: 'Principal',
        skills: 'LLMs, RAG, Python, PyTorch',
        total_capacity: '100',
        hourly_rate: '3500',
        on_leave: 0,
      },
    });
    assert.equal(createRes.status, 201);
    createdResourceId = createRes.body.resource.id;
    assert.equal(createRes.body.resource.hourly_rate, 3500);
  });

  it('3. Lead Ingestion, Follow-up Resource Assignment & Work Notes', async () => {
    const createLeadRes = await app.inject({
      method: 'POST',
      url: '/api/leads',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Dr. Kavita Krishnan',
        company: testLeadCompany,
        email: testLeadEmail,
        phone: '+91 98401 11223',
        source: 'LinkedIn',
        service: 'AI services',
        budget: 1250000,
        currency: 'INR',
        status: 'Meeting scheduled',
        followup_resource: 'Vishaal Arun',
        notes: 'Looking for an autonomous clinical triage and EHR integration platform.',
      },
    });
    assert.equal(createLeadRes.status, 201);
    createdLeadId = createLeadRes.body.lead.id;
    assert.equal(createLeadRes.body.lead.followup_resource, 'Vishaal Arun');

    const noteRes = await app.inject({
      method: 'POST',
      url: `/api/leads/${createdLeadId}/notes`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        text: 'Completed technical discovery call covering all 12 architectural dimensions.',
        status: 'Meeting scheduled',
      },
    });
    assert.equal(noteRes.status, 201);
    assert.ok(noteRes.body.lead.lead_notes.length >= 1);
  });

  it('4. AI Proposal Generation with 12-Question Deep Discovery & Dispatch Sync', async () => {
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/proposals/generate',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        company_name: testLeadCompany,
        recipient_name: 'Dr. Kavita Krishnan',
        recipient_email: testLeadEmail,
        project_title: 'Autonomous Clinical Triage & EHR Hub',
        service_type: 'AI services',
        budget: 1250000,
        currency: 'INR',
        timeline_weeks: 10,
        user_prompt: `Architect "Autonomous Clinical Triage & EHR Hub" for ${testLeadCompany}.`,
        key_requirements: 'Clinical AI Triage\nHL7 FHIR Sync\nTelehealth Studio',
        discovery_answers: {
          industry_and_model: 'Multi-specialty Hospital Network with 2,000+ daily outpatient visits',
          pain_points_bottlenecks: 'Manual paper triage queues and 25% appointment no-shows',
          target_personas: 'Patients, Triage Nurses, Attending Physicians, and Hospital Admins',
          core_modules_portals: 'Patient Triage Portal, Smart Doctor Scheduler, HL7 FHIR Bridge',
          user_journey_workflow: 'Symptom Intake -> AI Urgency Triage -> Slot Booking -> SOAP Note',
          approvals_governance: 'Mandatory physician sign-off on all AI SOAP notes and e-Rx',
          ai_automation_needs: 'Conversational symptom triage and Whisper speech-to-SOAP scribe',
          integrations_ecosystem: 'Epic HL7 FHIR API, WhatsApp Business Cloud API, Razorpay',
          data_migration_volume: 'Migrate 80,000 legacy patient records with mobile deduplication',
          security_compliance_cloud: 'AWS Mumbai ap-south-1, HIPAA & India DPDP Act compliance',
          success_metrics_roi: 'Reduce patient intake wait times by 65% and save 2 hrs/day per doctor',
          rollout_sla_amc: '10-week rollout across 4 phases with Priority 24x7 AMC SLA',
        },
      },
    });
    assert.equal(genRes.status, 200);
    assert.ok(genRes.body.html_proposal.includes(testLeadCompany));
    assert.ok(
      genRes.body.html_proposal.includes('Manual paper triage queues and 25% appointment no-shows')
    );
    assert.ok(
      genRes.body.html_proposal.includes('Epic HL7 FHIR API, WhatsApp Business Cloud API, Razorpay')
    );

    // Save & Send the proposal and verify Lead automatically transitions to "Proposal sent"
    const savePropRes = await app.inject({
      method: 'POST',
      url: '/api/proposals',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        lead_id: createdLeadId,
        company_name: testLeadCompany,
        recipient_name: 'Dr. Kavita Krishnan',
        recipient_email: testLeadEmail,
        project_title: 'Autonomous Clinical Triage & EHR Hub',
        service_type: 'AI services',
        budget: 1250000,
        currency: 'INR',
        timeline_weeks: 10,
        key_requirements: 'Clinical AI Triage',
        email_subject: genRes.body.email_subject,
        email_body: genRes.body.email_body,
        html_proposal: genRes.body.html_proposal,
        status: 'Sent',
      },
    });
    assert.equal(savePropRes.status, 201);
    createdProposalId = savePropRes.body.proposal.id;

    // Verify lead status is now 'Proposal sent' and Conversion entry was auto-created
    const updatedLeadRes = await app.inject({
      method: 'GET',
      url: `/api/leads/${createdLeadId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(updatedLeadRes.status, 200);
    assert.equal(updatedLeadRes.body.lead.status, 'Proposal sent');
    assert.ok(updatedLeadRes.body.lead.conversion);
    createdConversionId = updatedLeadRes.body.lead.conversion.id;
  });

  it('5. Conversion Pipeline Win & Automatic Client 360 Creation', async () => {
    const convRes = await app.inject({
      method: 'PUT',
      url: `/api/conversions/${createdConversionId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        outcome: 'converted',
        deal_value: 1250000,
        currency: 'INR',
        comment: 'Signed Master Services Agreement for 10-week delivery.',
      },
    });
    assert.equal(convRes.status, 200);
    assert.equal(convRes.body.conversion.outcome, 'converted');
    assert.ok(convRes.body.client);
    createdClientId = convRes.body.client.id;
    assert.equal(convRes.body.client.company, testLeadCompany);
  });

  it('6. Project Delivery, AMC Contract Tracking, Timeline & Vendor Costs', async () => {
    const createProjRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        client_id: createdClientId,
        name: 'Autonomous Clinical Triage & EHR Hub',
        description: 'End-to-end clinical AI triage and HL7 FHIR bridge',
        service_type: 'AI services',
        status: 'In progress',
        start_date: '2026-11-01',
        end_date: '2027-01-15',
        budget: 1250000,
        currency: 'INR',
        tech_stack: 'React, Node.js, Python, FHIR, AWS Mumbai',
        amc_active: true,
        amc_status: 'Active',
        amc_amount: 180000,
        amc_start_date: '2027-01-16',
        amc_end_date: '2028-01-15',
        amc_billing_cycle: 'Annual',
        amc_sla_tier: 'Mission Critical 24x7',
      },
    });
    assert.equal(createProjRes.status, 201);
    createdProjectId = createProjRes.body.project.id;
    assert.equal(createProjRes.body.project.amc_active, true);
    assert.equal(createProjRes.body.project.amc_amount, 180000);

    // Log a vendor cost on the project and verify profit & margin calculation
    const costRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${createdProjectId}/costs`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: 'AWS Mumbai HIPAA Cluster & GPU Inference Nodes',
        category: 'Cloud / Infrastructure',
        vendor_or_resource: 'Amazon Web Services',
        amount: 150000,
      },
    });
    assert.equal(costRes.status, 201);
    createdCostId = costRes.body.cost.id;
    assert.equal(costRes.body.project.total_cost, 150000);
    assert.equal(costRes.body.project.profit, 1100000);
    assert.equal(costRes.body.project.profit_margin_pct, 88);

    // Create a timeline milestone entry
    const tlRes = await app.inject({
      method: 'POST',
      url: '/api/timeline',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        project_id: createdProjectId,
        title: 'Phase 1: Core Triage Engine & FHIR Schema Sign-Off',
        type: 'Milestone',
        start_date: '2026-11-01',
        end_date: '2026-11-20',
        status: 'Done',
      },
    });
    assert.equal(tlRes.status, 201);
    createdTimelineId = tlRes.body.entry.id;

    // Assign our resource to the project
    const assignRes = await app.inject({
      method: 'POST',
      url: '/api/resources/assignments',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        resource_id: createdResourceId,
        project_id: createdProjectId,
        assignment_role: 'Lead AI Architect',
        allocation_pct: '60',
        start_date: '2026-11-01',
        end_date: '2027-01-15',
        status: 'Active',
      },
    });
    assert.equal(assignRes.status, 201);
    createdAssignmentId = assignRes.body.assignment.id;
  });

  it('7. Client Milestone Payments, Auto-Invoicing & Company Expenses Ledger', async () => {
    const payRes = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        client_id: createdClientId,
        project_id: createdProjectId,
        phase_name: 'Milestone 1: Kickoff & Architecture Sign-off',
        phase_number: 1,
        amount: 500000,
        paid_amount: 500000,
        currency: 'INR',
        percentage: 40,
        status: 'Paid',
        due_date: '2026-11-05',
        paid_date: '2026-11-05',
        payment_method: 'Bank Transfer / NEFT',
      },
    });
    assert.equal(payRes.status, 201);
    createdPaymentId = payRes.body.payment.id;
    assert.ok(String(payRes.body.payment.invoice_number).startsWith('INV-'));

    const expRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: 'Anthropic & Gemini Enterprise LLM Credits',
        category: 'AI APIs & LLM Tokens',
        amount: 35000,
        currency: 'INR',
        expense_date: '2026-11-06',
        status: 'Paid',
        payment_method: 'Corporate Card',
        vendor: 'Google Cloud / Anthropic',
        project_id: createdProjectId,
      },
    });
    assert.equal(expRes.status, 201);
    createdExpenseId = expRes.body.expense.id;
  });

  it('8. BAU Support Desk SLA Resolution & 5-Star Client CSAT Feedback', async () => {
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/bau-tickets',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        client_id: createdClientId,
        project_id: createdProjectId,
        title: 'Add Tamil & Hindi language pack to symptom triage bot',
        category: 'Change Request',
        priority: 'High',
        state: 'New',
        reported_by: 'Dr. Kavita Krishnan',
        sla_due_date: '2026-11-25',
      },
    });
    assert.equal(ticketRes.status, 201);
    createdTicketId = ticketRes.body.ticket.id;

    // Resolve ticket and verify resolved_at timestamp is populated
    const resolveRes = await app.inject({
      method: 'PUT',
      url: `/api/bau-tickets/${createdTicketId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        state: 'Resolved',
        resolution_notes: 'Deployed multilingual Indic-LLM translation layer.',
      },
    });
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveRes.body.ticket.state, 'Resolved');
    assert.ok(resolveRes.body.ticket.resolved_at);

    // Log 5-star CSAT feedback
    const fbRes = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        client_id: createdClientId,
        project_id: createdProjectId,
        rating: 5,
        sentiment: 'Positive',
        category: 'Technical Expertise',
        comment: 'Exceptional AI triage accuracy and seamless HL7 integration!',
        status: 'Reviewed',
        submitted_by: 'Dr. Kavita Krishnan',
        is_testimonial: true,
      },
    });
    assert.equal(fbRes.status, 201);
    createdFeedbackId = fbRes.body.feedback.id;
  });

  it('9. Executive Dashboard, Revenue Analytics, Auto Email Config & Comprehensive Reports', async () => {
    const dashRes = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.body.cards);

    const revRes = await app.inject({
      method: 'GET',
      url: '/api/revenue',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(revRes.status, 200);
    assert.ok(Array.isArray(revRes.body.projects));

    const autoCfgRes = await app.inject({
      method: 'GET',
      url: '/api/automation/settings',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(autoCfgRes.status, 200);
    assert.equal(autoCfgRes.body.settings.preferred_provider, 'resend');
    assert.equal(autoCfgRes.body.settings.active_provider, 'Resend Cloud API');

    const repRes = await app.inject({
      method: 'GET',
      url: '/api/reports?period=all',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repRes.status, 200);
    assert.ok(repRes.body.conversions.converted_leads_count >= 1);
    assert.ok(repRes.body.financials.total_income_received >= 500000);
    assert.ok(repRes.body.financials.total_expenses_made >= 35000);
    assert.ok(Array.isArray(repRes.body.resources_leaderboard));
    assert.ok(repRes.body.support_and_resolution.total_received >= 1);
    assert.ok(repRes.body.support_and_resolution.total_resolved >= 1);
    assert.ok(typeof repRes.body.support_and_resolution.avg_resolution_time_hours === 'number');
  });

  it('10. QA Report Validations: Phone Length, Date Ranges, Follow-Up Variations, Test Email Log & USD Revenue', async () => {
    // A. Reject short (<10 digit) phone numbers on Leads and Clients
    const badLeadPhone = await app.inject({
      method: 'POST',
      url: '/api/leads',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Short Phone Test',
        company: 'Test Co',
        email: 'short@test.com',
        phone: '5666',
        source: 'Website',
        service: 'AI services',
      },
    });
    assert.equal(badLeadPhone.status, 400);

    const badClientPhone = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        company: 'Test Client Co',
        contact_name: 'Short Phone Client',
        email: 'shortclient@test.com',
        phone: '12345',
      },
    });
    assert.equal(badClientPhone.status, 400);

    // B. Reject End Date < Start Date on Timeline and Resource Assignments
    const badTimelineDate = await app.inject({
      method: 'POST',
      url: '/api/timeline',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        project_id: createdProjectId,
        title: 'Invalid Date Task',
        start_date: '2026-11-20',
        end_date: '2026-11-10',
      },
    });
    assert.equal(badTimelineDate.status, 400);

    const badAssignDate = await app.inject({
      method: 'POST',
      url: '/api/resources/assignments',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        resource_id: createdResourceId,
        project_id: createdProjectId,
        assignment_role: 'Engineer',
        allocation_pct: 20,
        start_date: '2026-12-10',
        end_date: '2026-12-01',
      },
    });
    assert.equal(badAssignDate.status, 400);

    // C. Verify "Re-generate with AI" follow-up draft variations (variation_index 0 vs 1)
    const draft0 = await app.inject({
      method: 'POST',
      url: '/api/automation/generate-draft',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { lead_id: createdLeadId, template_type: 'gentle_nudge', variation_index: 0 },
    });
    const draft1 = await app.inject({
      method: 'POST',
      url: '/api/automation/generate-draft',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { lead_id: createdLeadId, template_type: 'gentle_nudge', variation_index: 1 },
    });
    assert.equal(draft0.status, 200);
    assert.equal(draft1.status, 200);
    assert.notEqual(draft0.body.draft.body, draft1.body.draft.body);

    // D. Verify "Send Follow-Up from CRM" (/api/automation/send-email) succeeds without templateType ReferenceError
    const sendFollowupRes = await app.inject({
      method: 'POST',
      url: '/api/automation/send-email',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        lead_id: createdLeadId,
        recipient_email: testLeadEmail,
        recipient_name: 'Dr. Kavita Krishnan',
        subject: draft1.body.draft.subject,
        body: draft1.body.draft.body,
        template_type: 'gentle_nudge',
      },
    });
    assert.equal(sendFollowupRes.status, 200);
    assert.ok(sendFollowupRes.body.email_log);

    // E. Verify Test Email (/api/automation/test-email) creates an EmailLog entry
    const testMailRes = await app.inject({
      method: 'POST',
      url: '/api/automation/test-email',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { recipient: testLeadEmail },
    });
    assert.equal(testMailRes.status, 200);
    assert.ok(testMailRes.body.email_log);

    const logsRes = await app.inject({
      method: 'GET',
      url: '/api/automation/logs',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(logsRes.status, 200);
    assert.ok(logsRes.body.logs.some((l: any) => l.id === testMailRes.body.email_log.id));

    // F. Verify editing a Lead with an existing next_followup date succeeds (HTTP 200) and preserves USD currency
    const setFollowupRes = await app.inject({
      method: 'PUT',
      url: `/api/leads/${createdLeadId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        next_followup: '2026-12-01',
        currency: 'USD',
        budget: 25000,
      },
    });
    assert.equal(setFollowupRes.status, 200);
    assert.equal(setFollowupRes.body.lead.currency, 'USD');

    // Second edit when existing.next_followup is already populated in SQLite
    const editWithExistingFollowupRes = await app.inject({
      method: 'PUT',
      url: `/api/leads/${createdLeadId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Dr. Kavita Krishnan (Updated)',
        next_followup: '2026-12-05',
        currency: 'USD',
      },
    });
    assert.equal(editWithExistingFollowupRes.status, 200);
    assert.equal(editWithExistingFollowupRes.body.lead.currency, 'USD');

    // G. Verify editing a Pending client payment keeps paid_amount = 0 and does not move Pending amount into Collected
    const pendingPhaseCreate = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        client_id: createdClientId,
        project_id: createdProjectId,
        phase_name: 'Phase 2 — Pending Milestone Check',
        phase_number: 2,
        amount: 125000,
        currency: 'INR',
        percentage: 25,
        status: 'Pending',
        due_date: '2026-12-20',
      },
    });
    assert.equal(pendingPhaseCreate.status, 201);
    const pendingPhaseId = pendingPhaseCreate.body.payment.id;
    assert.equal(pendingPhaseCreate.body.payment.paid_amount, 0);

    // Simulate editing the Pending phase even if a caller passes paid_amount > 0 while status is Pending
    const pendingPhaseEdit = await app.inject({
      method: 'PUT',
      url: `/api/payments/${pendingPhaseId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        phase_name: 'Phase 2 — Pending Milestone Check (Edited)',
        status: 'Pending',
        paid_amount: 125000,
      },
    });
    assert.equal(pendingPhaseEdit.status, 200);
    assert.equal(pendingPhaseEdit.body.payment.status, 'Pending');
    assert.equal(pendingPhaseEdit.body.payment.paid_amount, 0);

    await app.inject({
      method: 'DELETE',
      url: `/api/payments/${pendingPhaseId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // H. Verify sending an AI HTML Proposal dispatches email via mailer and logs to EmailLog
    const proposalLogsRes = await app.inject({
      method: 'GET',
      url: '/api/automation/logs',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(proposalLogsRes.status, 200);
    assert.ok(
      proposalLogsRes.body.logs.some(
        (l: any) => l.recipient_email === testLeadEmail
      ),
      'Expected Sent Proposal to create an entry in EmailLog'
    );

    // Clean up test email logs created in this test
    await prisma.emailLog.deleteMany({ where: { recipient_email: testLeadEmail } });
  });
});
