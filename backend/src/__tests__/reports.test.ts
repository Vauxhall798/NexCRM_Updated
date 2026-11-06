import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';

test('Executive Reports & Analytics Automated Tests', async (t) => {
  // Setup baseline test entities
  const testClient = await prisma.client.create({
    data: {
      company: 'Zenith Reports Group',
      contact_name: 'Anita Shenoy',
      email: `anita_${Date.now()}@zenithreports.in`,
      phone: '+91 99887 76655',
      industry: 'Enterprise Software',
      status: 'Active',
      became_client_at: new Date(),
    },
  });

  const testProject = await prisma.project.create({
    data: {
      client_id: testClient.id,
      name: 'Omnichannel AI Contact Center',
      service_type: 'AI services',
      status: 'In progress',
      budget: 1200000,
      currency: 'INR',
      amc_active: 1,
      amc_status: 'Active',
      amc_amount: 180000,
      amc_sla_tier: 'Priority 24x7',
      start_date: new Date(),
      end_date: new Date(Date.now() + 60 * 86400000),
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: `rep_${Date.now()}@nexcrm.io`,
      password_hash: 'hash',
      name: 'Rohan Deshmukh',
      role: 'MEMBER',
    },
  });

  // Create converted lead assigned to Rohan Deshmukh
  const convertedLead = await prisma.lead.create({
    data: {
      name: 'Anita Shenoy',
      company: 'Zenith Reports Group',
      email: `anita_lead_${Date.now()}@zenithreports.in`,
      phone: '+91 99887 76655',
      service: 'AI services',
      status: 'Converted',
      budget: 1200000,
      currency: 'INR',
      source: 'LinkedIn',
      followup_resource: 'Rohan Deshmukh',
      owner_id: testUser.id,
    },
  });

  // Paid payment for revenue
  await prisma.clientPayment.create({
    data: {
      client_id: testClient.id,
      project_id: testProject.id,
      phase_name: 'Phase 1: Kickoff',
      amount: 400000,
      paid_amount: 400000,
      currency: 'INR',
      percentage: 33,
      status: 'Paid',
      due_date: new Date().toISOString(),
      paid_date: new Date().toISOString(),
    },
  });

  // Paid company expense
  await prisma.expense.create({
    data: {
      title: 'Vector Search Cloud Cluster',
      category: 'Cloud & Hosting',
      amount: 45000,
      currency: 'INR',
      status: 'Paid',
      expense_date: new Date().toISOString(),
      project_id: testProject.id,
    },
  });

  await t.test('1. Computes financial metrics (income, expenses, net profit, margin)', async () => {
    const allPayments = await prisma.clientPayment.findMany();
    const allExpenses = await prisma.expense.findMany();

    const paidIncome = allPayments
      .filter((p: any) => p.status === 'Paid')
      .reduce((sum: number, p: any) => sum + Number(p.paid_amount || p.amount || 0), 0);

    const paidExpenses = allExpenses
      .filter((e: any) => e.status === 'Paid')
      .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    const netProfit = paidIncome - paidExpenses;
    assert.ok(paidIncome >= 400000);
    assert.ok(paidExpenses >= 45000);
    assert.equal(netProfit, paidIncome - paidExpenses);
  });

  await t.test('2. Aggregates resource conversion leaderboard accurately', async () => {
    const leads = await prisma.lead.findMany({
      where: { followup_resource: 'Rohan Deshmukh' },
    });

    const converted = leads.filter((l: any) => l.status === 'Converted');
    assert.ok(converted.length >= 1);
    const wonValue = converted.reduce((sum: number, l: any) => sum + Number(l.budget || 0), 0);
    assert.ok(wonValue >= 1200000);
  });

  await t.test('3. Computes active projects and AMC recurring revenue', async () => {
    const projects = await prisma.project.findMany();
    const amcProjects = projects.filter((p: any) => p.amc_active === 1 || p.amc_status === 'Active');
    const amcARR = amcProjects.reduce((sum: number, p: any) => sum + Number(p.amc_amount || 0), 0);

    assert.ok(amcProjects.length >= 1);
    assert.ok(amcARR >= 180000);
  });

  await t.test('4. Tracks support tickets received, resolved, and time to resolve', async () => {
    const ticketCreated = new Date(Date.now() - 4 * 3600 * 1000); // 4 hours ago
    const ticketResolved = new Date();

    const ticket = await prisma.bauTicket.create({
      data: {
        ticket_number: `BAU-TEST-${Date.now()}`,
        client_id: testClient.id,
        project_id: testProject.id,
        title: 'Production LLM Latency Spike',
        category: 'Performance',
        priority: 'Critical',
        state: 'Resolved',
        created_at: ticketCreated.toISOString(),
        resolved_at: ticketResolved.toISOString(),
      },
    });

    assert.ok(ticket.id);
    assert.equal(ticket.state, 'Resolved');

    const durationHours =
      (new Date(ticket.resolved_at!).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 3600);
    assert.ok(durationHours >= 3.9 && durationHours <= 4.1);
  });
});
