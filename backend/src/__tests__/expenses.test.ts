import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';

test('Company Expenses Tracking Automated Tests', async (t) => {
  const testClient = await prisma.client.create({
    data: {
      company: 'Zenith Labs Global',
      contact_name: 'Dr. Vikram Malhotra',
      email: `vikram_${Date.now()}@zenithlabs.in`,
      phone: '+91 91234 56789',
      industry: 'Biotech & AI',
      status: 'Active',
      became_client_at: new Date(),
    },
  });

  const testProject = await prisma.project.create({
    data: {
      client_id: testClient.id,
      name: 'Genomic AI Pipeline',
      service_type: 'AI services',
      status: 'In progress',
      budget: 800000,
      currency: 'INR',
      start_date: new Date(),
      end_date: new Date(Date.now() + 60 * 86400000),
    },
  });

  let createdExpenseId = '';

  await t.test('1. Creates company overhead and project-linked expenses', async () => {
    // Overhead expense
    const overhead = await prisma.expense.create({
      data: {
        title: 'Monthly Office Cloud Leased Line (1 Gbps)',
        category: 'Office & Rent',
        amount: 15000,
        currency: 'INR',
        expense_date: new Date().toISOString(),
        status: 'Paid',
        payment_method: 'Corporate Credit Card',
        vendor: 'Tata Tele Business Services',
        invoice_number: 'INV-TT-2026-99',
        project_id: null,
        paid_by: 'IT Admin',
        notes: 'High-speed dedicated fiber connection',
      },
    });

    assert.ok(overhead.id);
    assert.equal(overhead.amount, 15000);
    assert.equal(overhead.status, 'Paid');
    assert.equal(overhead.project_id, null);

    // Project-linked expense
    const projectExp = await prisma.expense.create({
      data: {
        title: 'High-Memory GPU Cloud Cluster for Genomic Training',
        category: 'Cloud & Hosting',
        amount: 45000,
        currency: 'INR',
        expense_date: new Date().toISOString(),
        status: 'Pending',
        payment_method: 'Bank Transfer / NEFT',
        vendor: 'Lambda Labs Cloud GPU',
        invoice_number: 'INV-LL-8821',
        project_id: testProject.id,
        paid_by: 'AI Platform Team',
        notes: '8x A100 GPU compute instances for model fine-tuning',
      },
    });

    assert.ok(projectExp.id);
    assert.equal(projectExp.project_id, testProject.id);
    assert.equal(projectExp.status, 'Pending');
    createdExpenseId = projectExp.id;
  });

  await t.test('2. Updates expense status from Pending to Paid', async () => {
    const updated = await prisma.expense.update({
      where: { id: createdExpenseId },
      data: {
        status: 'Paid',
        notes: 'Paid via Corporate NEFT after invoice approval',
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    assert.equal(updated.status, 'Paid');
    assert.ok(updated.project);
    assert.equal(updated.project.name, 'Genomic AI Pipeline');
  });

  await t.test('3. Retrieves and aggregates expenses list accurately', async () => {
    const expenses = await prisma.expense.findMany({
      where: { project_id: testProject.id },
    });

    assert.ok(expenses.length >= 1);
    const gpuExpense = expenses.find((e: any) => e.id === createdExpenseId);
    assert.ok(gpuExpense);
    assert.equal(gpuExpense.amount, 45000);
  });

  await t.test('4. Deletes an expense record cleanly', async () => {
    await prisma.expense.delete({ where: { id: createdExpenseId } });
    const afterDelete = await prisma.expense.findUnique({ where: { id: createdExpenseId } });
    assert.equal(afterDelete, null);
  });

  await t.test('5. Validates and parses partial edit payloads safely', async () => {
    const { z } = await import('../lib/validator.ts');
    const testSchema = z.object({
      title: z.string().min(1, 'Title is required'),
      category: z.string().default('Cloud & Hosting'),
      amount: z.coerce.number().min(0, 'Amount must be non-negative'),
      currency: z.string().default('INR'),
      expense_date: z.string().optional(),
      status: z.enum(['Paid', 'Pending', 'Scheduled', 'Cancelled']).default('Paid'),
      payment_method: z.string().default('Bank Transfer / NEFT'),
      vendor: z.string().optional().default(''),
      invoice_number: z.string().optional().default(''),
      receipt_url: z.string().optional().default(''),
      project_id: z.string().nullable().optional(),
      paid_by: z.string().optional().default(''),
      notes: z.string().optional().default(''),
    });

    // Test quick mark-as-paid partial
    const quickPaidResult = testSchema.partial().safeParse({ status: 'Paid' });
    assert.equal(quickPaidResult.success, true);
    if (quickPaidResult.success) {
      assert.equal(quickPaidResult.data.status, 'Paid');
      assert.equal(quickPaidResult.data.title, undefined);
    }

    // Test editing form payload with string amount and null project
    const editResult = testSchema.partial().safeParse({
      title: 'Updated AWS Hosting',
      amount: '28500',
      category: 'Cloud & Hosting',
      project_id: null,
      status: 'Paid',
    });
    assert.equal(editResult.success, true);
    if (editResult.success) {
      assert.equal(editResult.data.amount, 28500);
      assert.equal(editResult.data.title, 'Updated AWS Hosting');
      assert.equal(editResult.data.project_id, null);
    }

    // Test parse() throws ZodError when invalid
    assert.throws(() => {
      testSchema.parse({ title: '' });
    }, (err: any) => err instanceof z.ZodError);
  });
});

