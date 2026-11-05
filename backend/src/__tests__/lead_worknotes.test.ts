import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';

test('Lead Work Notes & Followup Author Tests', async (t) => {
  // Create a test user "login 1"
  const testUser = await prisma.user.create({
    data: {
      name: 'login 1',
      email: `login1_${Date.now()}@nexcrm.io`,
      password_hash: 'hashedpassword',
      role: 'MEMBER',
    },
  });

  // Create a test lead
  const testLead = await prisma.lead.create({
    data: {
      name: 'Michael Scott',
      company: 'Dunder Mifflin',
      email: 'michael@dundermifflin.com',
      phone: '555-0100',
      source: 'Website',
      service: 'Custom software',
      budget: 500000,
      currency: 'INR',
      status: 'New',
      owner_id: testUser.id,
      notes: 'Initial enquiry',
    },
  });

  await t.test('1. Creates a work note for followup with author = "login 1"', async () => {
    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + 7);

    // Create note with author
    const note = await prisma.leadNote.create({
      data: {
        lead_id: testLead.id,
        text: 'Called client to discuss software scope. Client requested demo next week.',
        created_by: testUser.id,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    assert.equal(note.text, 'Called client to discuss software scope. Client requested demo next week.');
    assert.equal(note.created_by, testUser.id);
    assert.equal(note.author?.name, 'login 1');
    assert.equal(note.author?.role, 'MEMBER');
  });

  await t.test('2. Lead queries include lead_notes with author name and role', async () => {
    const fetched = await prisma.lead.findUnique({
      where: { id: testLead.id },
      include: {
        lead_notes: {
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    assert.ok(fetched);
    assert.ok(fetched.lead_notes && fetched.lead_notes.length > 0);
    const latest = fetched.lead_notes[0];
    assert.equal(latest.author?.name, 'login 1');
  });

  // Cleanup
  await prisma.leadNote.deleteMany({ where: { lead_id: testLead.id } });
  await prisma.lead.delete({ where: { id: testLead.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
