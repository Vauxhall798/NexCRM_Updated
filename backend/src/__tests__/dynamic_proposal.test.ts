import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeDynamicDomainContent, buildNexIntMasterProposal } from '../routes/proposals.ts';

test('Dynamic Proposal Synthesis & HTML Generation Tests', async (t) => {
  await t.test('1. Healthcare Dynamic Prompt generates clinical triage and patient workflows', () => {
    const prompt = 'Build an AI conversational agent for healthcare patient triaging and hospital appointment booking';
    const content = synthesizeDynamicDomainContent({
      company_name: 'Apollo Health Tech',
      recipient_name: 'Dr. Ramesh Kumar',
      project_title: 'CarePulse AI',
      service_type: 'AI services',
      budget: 850000,
      currency: 'INR',
      timeline_weeks: 10,
      user_prompt: prompt,
      key_requirements: 'Automated triage, doctor appointment booking, EHR integration',
    });

    assert.ok(content.heroHeadline?.includes('Apollo Health Tech'));
    assert.ok(content.heroHeadline?.includes('CarePulse AI'));
    assert.ok(/patient|clinical|triage/i.test(content.heroHeadline || ''));
    assert.ok(Array.isArray(content.workflows) && content.workflows.length >= 8);
    assert.ok(Array.isArray(content.modules) && content.modules.length >= 8);
    assert.ok(Array.isArray(content.aiCapabilities) && content.aiCapabilities.length >= 10);
    assert.ok(Array.isArray(content.automationsList) && content.automationsList.length >= 10);

    const generated = buildNexIntMasterProposal({
      company_name: 'Apollo Health Tech',
      recipient_name: 'Dr. Ramesh Kumar',
      recipient_email: 'dr.ramesh@apollo.com',
      project_title: 'CarePulse AI',
      service_type: 'AI services',
      budget: 850000,
      currency: 'INR',
      timeline_weeks: 10,
      key_requirements: 'Automated triage, doctor appointment booking, EHR integration',
      user_prompt: prompt,
      tone: 'Executive & Consultative',
      sender_name: 'NexInt AI, Chennai',
      aiCustom: content,
    });

    assert.ok(generated.html_proposal.includes('Apollo Health Tech'));
    assert.ok(generated.html_proposal.includes('CarePulse AI'));
    assert.ok(generated.html_proposal.includes('Patient Intake & Digital Check-in'));
    assert.ok(generated.html_proposal.includes('Conversational Symptom Triaging'));
    // Make sure it doesn't fall back to Vendor Hub
    assert.ok(!generated.html_proposal.includes('HOTCULT / VENDOR HUB') && !generated.html_proposal.includes('The Hotcult Vendor Hub'));
  });

  await t.test('2. Data Engineering Prompt generates streaming and lakehouse architecture', () => {
    const prompt = 'Build real-time Kafka streaming pipelines and Snowflake data warehouse for analytics';
    const content = synthesizeDynamicDomainContent({
      company_name: 'DataFlow Inc',
      recipient_name: 'Priya Sharma',
      project_title: 'Enterprise Data Lakehouse',
      service_type: 'Data Engineering',
      budget: 1200000,
      currency: 'INR',
      timeline_weeks: 12,
      user_prompt: prompt,
      key_requirements: 'Kafka streams, Snowflake schemas, dbt transformations, data quality monitoring',
    });

    assert.ok(content.heroHeadline?.includes('DataFlow Inc'));
    assert.ok(/pipeline|data lakehouse|analytics/i.test(content.heroHeadline || ''));
    assert.ok(content.workflows?.some((w) => /ingestion|pipeline|schema/i.test(w.title)));
    assert.ok(content.modules?.some((m) => /lakehouse|pipeline|warehouse/i.test(m.title)));

    const generated = buildNexIntMasterProposal({
      company_name: 'DataFlow Inc',
      recipient_name: 'Priya Sharma',
      recipient_email: 'priya@dataflow.com',
      project_title: 'Enterprise Data Lakehouse',
      service_type: 'Data Engineering',
      budget: 1200000,
      currency: 'INR',
      timeline_weeks: 12,
      key_requirements: 'Kafka streams, Snowflake schemas, dbt transformations, data quality monitoring',
      user_prompt: prompt,
      tone: 'Technical & Authoritative',
      sender_name: 'NexInt AI, Chennai',
      aiCustom: content,
    });

    assert.ok(generated.html_proposal.includes('DataFlow Inc'));
    assert.ok(generated.html_proposal.includes('Enterprise Data Lakehouse'));
    assert.ok(generated.html_proposal.includes('₹12,00,000') || generated.html_proposal.includes('1,200,000'));
  });

  await t.test('3. Custom software / E-commerce prompt dynamically extracts requirements', () => {
    const prompt = 'B2B wholesale marketplace with live inventory tracking and automated PO generation';
    const content = synthesizeDynamicDomainContent({
      company_name: 'Global Mart',
      recipient_name: 'Vikram Seth',
      project_title: 'Wholesale B2B Portal',
      service_type: 'Others',
      budget: 950000,
      currency: 'INR',
      timeline_weeks: 10,
      user_prompt: prompt,
      key_requirements: 'Tiered wholesale pricing, invoice workflows, credit terms',
    });

    assert.ok(content.heroHeadline?.includes('Global Mart'));
    assert.ok(content.workflows?.some((w) => /order|inventory|catalog|po/i.test(w.title)));

    const generated = buildNexIntMasterProposal({
      company_name: 'Global Mart',
      recipient_name: 'Vikram Seth',
      recipient_email: 'vikram@globalmart.com',
      project_title: 'Wholesale B2B Portal',
      service_type: 'Others',
      budget: 950000,
      currency: 'INR',
      timeline_weeks: 10,
      key_requirements: 'Tiered wholesale pricing, invoice workflows, credit terms',
      user_prompt: prompt,
      tone: 'Executive & Consultative',
      sender_name: 'NexInt AI, Chennai',
      aiCustom: content,
    });

    assert.ok(generated.html_proposal.includes('Global Mart'));
    assert.ok(generated.html_proposal.includes('Wholesale B2B Portal'));
  });
});
