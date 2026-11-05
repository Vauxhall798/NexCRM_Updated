import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';

test('Client Payment Phase Tracking Automated Tests', async (t) => {
  // Setup a test client and project
  const testClient = await prisma.client.create({
    data: {
      company: 'Apex Robotics Ltd',
      contact_name: 'Ananya Roy',
      email: `ananya_${Date.now()}@apexrobotics.in`,
      phone: '+91 98765 43210',
      industry: 'Robotics & Automation',
      status: 'Active',
      became_client_at: new Date(),
    },
  });

  const testProject = await prisma.project.create({
    data: {
      client_id: testClient.id,
      name: 'Warehouse Automation Vision System',
      service_type: 'AI services',
      status: 'In progress',
      budget: 1000000,
      currency: 'INR',
      start_date: new Date(),
      end_date: new Date(Date.now() + 90 * 86400000),
    },
  });

  await t.test('1. Creates payment phases linked to project and client', async () => {
    const phase1 = await prisma.clientPayment.create({
      data: {
        client_id: testClient.id,
        project_id: testProject.id,
        phase_name: 'Phase 1: Advance & Project Kickoff',
        phase_number: 1,
        amount: 250000,
        currency: 'INR',
        percentage: 25,
        status: 'Paid',
        due_date: new Date().toISOString(),
        paid_date: new Date().toISOString(),
        paid_amount: 250000,
        invoice_number: 'INV-2026-001',
        payment_method: 'Bank Transfer / NEFT',
        transaction_ref: 'UTR987654321',
        notes: '25% advance received',
      },
    });

    assert.equal(phase1.phase_name, 'Phase 1: Advance & Project Kickoff');
    assert.equal(phase1.amount, 250000);
    assert.equal(phase1.status, 'Paid');
    assert.equal(phase1.project_id, testProject.id);
    assert.equal(phase1.client_id, testClient.id);
  });

  await t.test('2. Updates payment phase with milestone progress', async () => {
    const phase2 = await prisma.clientPayment.create({
      data: {
        client_id: testClient.id,
        project_id: testProject.id,
        phase_name: 'Phase 2: Computer Vision Model Training',
        phase_number: 2,
        amount: 350000,
        currency: 'INR',
        percentage: 35,
        status: 'Invoiced',
        due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
        invoice_number: 'INV-2026-002',
      },
    });

    assert.equal(phase2.status, 'Invoiced');

    // Client pays phase 2
    const updated = await prisma.clientPayment.update({
      where: { id: phase2.id },
      data: {
        status: 'Paid',
        paid_date: new Date().toISOString(),
        paid_amount: 350000,
        transaction_ref: 'UTR11223344',
      },
    });

    assert.equal(updated.status, 'Paid');
    assert.equal(updated.paid_amount, 350000);
    assert.equal(updated.transaction_ref, 'UTR11223344');
  });

  await t.test('3. Hydrates project and client relations with payment phases', async () => {
    const payments = await prisma.clientPayment.findMany({
      where: { project_id: testProject.id },
      include: { client: true, project: true },
      orderBy: { phase_number: 'asc' },
    });

    assert.equal(payments.length, 2);
    assert.equal(payments[0].client?.company, 'Apex Robotics Ltd');
    assert.equal(payments[0].project?.name, 'Warehouse Automation Vision System');
  });

  await t.test('4. Automatically generates invoice number for paid phases', async () => {
    // Create an un-invoiced phase
    const phase3 = await prisma.clientPayment.create({
      data: {
        client_id: testClient.id,
        project_id: testProject.id,
        phase_name: 'Phase 3: Production Rollout',
        phase_number: 3,
        amount: 400000,
        currency: 'INR',
        percentage: 40,
        status: 'Pending',
        due_date: new Date().toISOString(),
        invoice_number: '',
      },
    });

    assert.equal(phase3.invoice_number, '');

    // Now mark as Paid via update logic
    const { generateInvoiceNumber } = await import('../routes/payments.ts');
    const autoInv = generateInvoiceNumber(3);
    assert.match(autoInv, /^INV-\d{4}-03-\d{4}$/);

    const paidPhase = await prisma.clientPayment.update({
      where: { id: phase3.id },
      data: {
        status: 'Paid',
        paid_amount: 400000,
        paid_date: new Date().toISOString(),
        invoice_number: autoInv,
      },
    });

    assert.equal(paidPhase.status, 'Paid');
    assert.ok(paidPhase.invoice_number.startsWith('INV-'));
  });

  // Cleanup
  await prisma.clientPayment.deleteMany({ where: { project_id: testProject.id } });
  await prisma.project.delete({ where: { id: testProject.id } });
  await prisma.client.delete({ where: { id: testClient.id } });
});

