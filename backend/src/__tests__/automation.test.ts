import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';
import {
  generateFollowupDraft,
  executeFollowupEmail,
  runAutomatedFollowupBatch,
} from '../lib/followup-engine.ts';

test('Follow-Up & Email Automation Automated Tests', async (t) => {
  // Setup a test lead
  const testLead = await prisma.lead.create({
    data: {
      name: 'Rohan Sharma',
      company: 'Zenith Logistics Tech',
      email: `rohan_${Date.now()}@zenithlogistics.in`,
      phone: '+91 91234 56789',
      source: 'LinkedIn',
      service: 'Cloud / DevOps',
      budget: 600000,
      currency: 'INR',
      status: 'Proposal sent',
      next_followup: new Date(Date.now() - 86400000).toISOString(), // Overdue by 1 day
      followup_resource: 'Vijay (Solutions Architect)',
      notes: 'Sent architecture proposal, awaiting procurement approval',
    },
  });

  await t.test('1. Generates context-aware follow-up draft matching deal stage', async () => {
    const draft = await generateFollowupDraft({
      leadId: testLead.id,
      templateType: 'proposal_checkin',
      senderName: 'Vijay',
    });

    assert.equal(draft.recipient_email, testLead.email);
    assert.equal(draft.recipient_name, 'Rohan Sharma');
    assert.equal(draft.company, 'Zenith Logistics Tech');
    assert.ok(draft.subject.includes('Zenith Logistics Tech') || draft.subject.includes('Proposal'));
    assert.ok(draft.body.includes('Rohan'));
    assert.ok(draft.body.includes('Zenith Logistics Tech') || draft.body.includes('Cloud / DevOps'));
  });

  await t.test('2. Dispatches follow-up email from CRM, logs to EmailLog and appends LeadNote', async () => {
    const draft = await generateFollowupDraft({
      leadId: testLead.id,
      templateType: 'proposal_checkin',
    });

    const result = await executeFollowupEmail({
      leadId: testLead.id,
      recipientEmail: testLead.email,
      recipientName: testLead.name,
      subject: draft.subject,
      body: draft.body,
      nextFollowupDate: draft.suggested_next_followup,
      sentByUserName: 'Vijay',
    });

    assert.ok(result.emailLog.id);
    assert.equal(result.emailLog.recipient_email, testLead.email);
    assert.ok(['Sent', 'Simulated'].includes(result.emailResult.status));

    // Verify lead's next follow-up date was rolled forward
    const updatedLead = await prisma.lead.findUnique({
      where: { id: testLead.id },
      include: { lead_notes: true },
    });

    assert.ok(updatedLead);
    assert.ok(new Date(updatedLead.next_followup!) > new Date());

    // Verify work note was logged
    const hasEmailNote = updatedLead.lead_notes.some((n) => n.text.includes('[Email Follow-up Sent]'));
    assert.ok(hasEmailNote, 'Should record work note in lead history');
  });

  await t.test('3. Batch follow-up runner identifies due leads and executes automated follow-ups', async () => {
    // Set next_followup to yesterday to ensure it is eligible
    await prisma.lead.update({
      where: { id: testLead.id },
      data: { next_followup: new Date(Date.now() - 86400000).toISOString() },
    });

    const batch = await runAutomatedFollowupBatch('admin-id', 'NexCRM Automation');
    assert.ok(batch.total_due >= 1);
    assert.ok(batch.processed_count >= 1);

    const match = batch.results.find((r) => r.lead_id === testLead.id);
    assert.ok(match, 'Test lead should be processed in batch');
    assert.equal(match.company, 'Zenith Logistics Tech');
  });

  // Clean up
  await prisma.leadNote.deleteMany({ where: { lead_id: testLead.id } });
  await prisma.emailLog.deleteMany({ where: { lead_id: testLead.id } });
  await prisma.lead.delete({ where: { id: testLead.id } });
});
