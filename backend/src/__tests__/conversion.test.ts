import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.ts';
import { prisma } from '../lib/prisma.ts';
import { signToken } from '../middleware/auth.ts';

describe('Lead -> Conversion -> Client Automated Tests', () => {
  let authToken = '';
  let testUserId = '';
  let testLeadId = '';
  let testConversionId = '';

  before(async () => {
    await prisma.client.deleteMany({ where: { company: 'QuantumGrid Systems' } });
    await prisma.lead.deleteMany({ where: { company: 'QuantumGrid Systems' } });
    const testUser = await prisma.user.upsert({
      where: { email: 'test-runner@nexcrm.io' },
      update: {},
      create: {
        name: 'Test Runner',
        email: 'test-runner@nexcrm.io',
        password_hash: 'hashed',
        role: 'ADMIN',
      },
    });
    testUserId = testUser.id;
    authToken = signToken({
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
    });
  });

  after(async () => {
    if (testLeadId) {
      await prisma.client.deleteMany({ where: { lead_id: testLeadId } });
      await prisma.lead.deleteMany({ where: { id: testLeadId } });
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  it('1. creates a new Lead and moves it to Conversion (in_progress)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/leads',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        name: 'Jordan Blake',
        company: 'QuantumGrid Systems',
        email: 'jordan@quantumgrid.io',
        phone: '+1 (555) 234-5678',
        source: 'Website',
        service: 'AI services',
        budget: 750000,
        currency: 'INR',
        status: 'New',
        notes: 'Enterprise grid monitoring platform.',
      },
    });

    assert.equal(createRes.status, 201);
    assert.ok(createRes.body.lead);
    testLeadId = createRes.body.lead.id;

    const moveRes = await app.inject({
      method: 'POST',
      url: `/api/leads/${testLeadId}/move-to-conversion`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.equal(moveRes.status, 201);
    assert.equal(moveRes.body.conversion.outcome, 'in_progress');
    assert.equal(moveRes.body.conversion.lead_id, testLeadId);
    testConversionId = moveRes.body.conversion.id;
  });

  it('2. requires a reason when marking a lead as not_converted', async () => {
    const failRes = await app.inject({
      method: 'PUT',
      url: `/api/conversions/${testConversionId}`,
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        outcome: 'not_converted',
      },
    });

    assert.equal(failRes.status, 400);
    assert.ok(String(failRes.body.error).includes('reason is required'));

    const okRes = await app.inject({
      method: 'PUT',
      url: `/api/conversions/${testConversionId}`,
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        outcome: 'not_converted',
        reason: 'Timing',
        comment: 'Deferred to next quarter',
      },
    });

    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.conversion.outcome, 'not_converted');
    assert.equal(okRes.body.conversion.reason, 'Timing');
    assert.equal(okRes.body.client, null);
  });

  it('3. automatically creates and links exactly one Client when marked as converted, and records history', async () => {
    const decidedDate = '2026-11-01';
    const convertRes = await app.inject({
      method: 'PUT',
      url: `/api/conversions/${testConversionId}`,
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        outcome: 'converted',
        deal_value: 82000,
        currency: 'USD',
        decided_at: decidedDate,
        comment: 'Contract signed after revised proposal.',
      },
    });

    assert.equal(convertRes.status, 200);
    assert.equal(convertRes.body.conversion.outcome, 'converted');
    assert.equal(convertRes.body.conversion.deal_value, 82000);

    const createdClient = convertRes.body.client;
    assert.ok(createdClient);
    assert.equal(createdClient.lead_id, testLeadId);
    assert.equal(createdClient.company, 'QuantumGrid Systems');
    assert.equal(createdClient.contact_name, 'Jordan Blake');
    assert.equal(createdClient.email, 'jordan@quantumgrid.io');
    assert.equal(createdClient.phone, '+1 (555) 234-5678');

    const history = JSON.parse(convertRes.body.conversion.history);
    assert.equal(Array.isArray(history), true);
    assert.ok(history.length >= 3);
    assert.equal(history[0].from_outcome, 'not_converted');
    assert.equal(history[0].to_outcome, 'converted');
  });
});
