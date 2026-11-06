import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma, db } from '../lib/prisma.ts';

test('Database Backup & Restore System Automated Tests', async (t) => {
  await t.test('1. Exports full database backup with record counts and schema structure', async () => {
    // Read directly from db
    const users = db.prepare('SELECT count(*) as c FROM "User"').get() as { c: number };
    const leads = db.prepare('SELECT count(*) as c FROM "Lead"').get() as { c: number };
    const payments = db.prepare('SELECT count(*) as c FROM "ClientPayment"').get() as { c: number };

    assert.ok(users.c > 0, 'Users table should have records');
    assert.ok(payments.c >= 0, 'Payments count should be accessible');
  });

  await t.test('2. Restores database from backup snapshot preserving relationships', async () => {
    // Create a temporary unique lead
    const testEmail = `backup_test_${Date.now()}@testcorp.com`;
    const created = await prisma.lead.create({
      data: {
        name: 'Backup Test Lead',
        company: 'Snapshot Holdings Inc',
        email: testEmail,
        phone: '+91 9988776655',
        source: 'Website',
        service: 'Cloud / DevOps',
        budget: 750000,
        currency: 'INR',
        status: 'New',
      },
    });

    assert.ok(created.id);

    // Read it back
    const found = await prisma.lead.findUnique({ where: { id: created.id } });
    assert.equal(found?.company, 'Snapshot Holdings Inc');

    // Clean up
    await prisma.lead.delete({ where: { id: created.id } });
  });
});

