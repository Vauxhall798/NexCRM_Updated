import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const conversionsRouter = Router();
conversionsRouter.use(requireAuth);

export const NOT_CONVERTED_REASONS = [
  'Budget',
  'Went to competitor',
  'No response',
  'Timing',
  'Requirements mismatch',
  'Other',
] as const;

const updateOutcomeSchema = z.object({
  outcome: z.enum(['in_progress', 'converted', 'not_converted'] as const),
  deal_value: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().optional(),
  decided_at: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
});

conversionsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const conversions = await prisma.conversion.findMany({
      include: {
        lead: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            client: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const total = conversions.length;
    const converted = conversions.filter((c) => c.outcome === 'converted').length;
    const not_converted = conversions.filter((c) => c.outcome === 'not_converted').length;
    const in_progress = conversions.filter((c) => c.outcome === 'in_progress').length;
    const conversion_rate = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

    res.json({
      conversions,
      summary: {
        total,
        converted,
        not_converted,
        in_progress,
        conversion_rate,
      },
    });
  } catch (err) {
    console.error('Error fetching conversions:', err);
    res.status(500).json({ error: 'Failed to fetch conversions' });
  }
});

conversionsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.conversion.findUnique({
    where: { id },
    include: {
      lead: {
        include: { client: true },
      },
    },
  });

  if (!existing) {
    res.status(404).json({ error: 'Conversion record not found' });
    return;
  }

  const parsed = updateOutcomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid conversion data',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;

  if (data.outcome === 'converted') {
    if (data.deal_value === undefined || data.deal_value === null || data.deal_value < 0) {
      res.status(400).json({ error: 'Deal value is required when marking a lead as Converted' });
      return;
    }
  }

  if (data.outcome === 'not_converted') {
    if (!data.reason || !data.reason.trim()) {
      res.status(400).json({ error: 'A reason is required when marking a lead as Not Converted' });
      return;
    }
  }

  let historyArr: Array<Record<string, unknown>> = [];
  try {
    historyArr = JSON.parse(existing.history || '[]');
  } catch {
    historyArr = [];
  }

  const decidedDate = data.decided_at ? new Date(data.decided_at) : new Date();

  const historyEntry = {
    timestamp: new Date().toISOString(),
    from_outcome: existing.outcome,
    to_outcome: data.outcome,
    deal_value: data.outcome === 'converted' ? data.deal_value : null,
    currency: data.currency || existing.currency || existing.lead.currency,
    reason: data.outcome === 'not_converted' ? data.reason : null,
    comment: data.comment || null,
    changed_by: req.user?.name || 'User',
  };

  historyArr.unshift(historyEntry);

  const updatedConversion = await prisma.conversion.update({
    where: { id },
    data: {
      outcome: data.outcome,
      deal_value:
        data.outcome === 'converted'
          ? (data.deal_value ?? existing.deal_value ?? existing.lead.budget)
          : existing.deal_value,
      currency: data.currency || existing.currency || existing.lead.currency || 'INR',
      reason: data.outcome === 'not_converted' ? data.reason : null,
      comment: data.comment !== undefined ? data.comment : existing.comment,
      decided_at: data.outcome === 'in_progress' ? null : decidedDate,
      history: JSON.stringify(historyArr),
    },
  });

  let clientRecord = existing.lead.client;

  if (data.outcome === 'converted') {
    if (!clientRecord) {
      clientRecord = await prisma.client.create({
        data: {
          lead_id: existing.lead.id,
          company: existing.lead.company,
          contact_name: existing.lead.name,
          email: existing.lead.email,
          phone: existing.lead.phone,
          status: 'Active',
          notes: data.comment
            ? `Converted from lead (${existing.lead.service}). Deal notes: ${data.comment}`
            : existing.lead.notes || `Converted from lead interested in ${existing.lead.service}.`,
          became_client_at: decidedDate,
        },
      });

      await prisma.clientNote.create({
        data: {
          client_id: clientRecord.id,
          text: `Client automatically created from converted lead (${existing.lead.name} - ${existing.lead.company}) with deal value ${updatedConversion.currency} ${updatedConversion.deal_value?.toLocaleString()}.`,
          created_by: req.user?.id || null,
        },
      });
    } else {
      clientRecord = await prisma.client.update({
        where: { id: clientRecord.id },
        data: {
          became_client_at: decidedDate,
          status: clientRecord.status === 'Inactive' ? 'Active' : clientRecord.status,
        },
      });
    }
  }

  if (data.outcome === 'converted') {
    await prisma.lead.update({
      where: { id: existing.lead.id },
      data: { status: 'Converted' },
    });
  } else if (data.outcome === 'not_converted') {
    await prisma.lead.update({
      where: { id: existing.lead.id },
      data: { status: 'Not converted' },
    });
  } else if (
    data.outcome === 'in_progress' &&
    (existing.lead.status === 'Converted' || existing.lead.status === 'Not converted')
  ) {
    await prisma.lead.update({
      where: { id: existing.lead.id },
      data: { status: 'Negotiation' },
    });
  }

  const outcomeLabel =
    data.outcome === 'converted'
      ? `Converted (Deal: ${updatedConversion.currency} ${updatedConversion.deal_value?.toLocaleString()})`
      : data.outcome === 'not_converted'
      ? `Not Converted (Reason: ${data.reason}${data.comment ? ` - ${data.comment}` : ''})`
      : 'In Progress';

  await prisma.leadNote.create({
    data: {
      lead_id: existing.lead.id,
      text: `Conversion outcome changed from "${existing.outcome}" to "${outcomeLabel}".`,
      created_by: req.user?.id || null,
    },
  });

  const fullConversion = await prisma.conversion.findUnique({
    where: { id },
    include: {
      lead: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          client: true,
        },
      },
    },
  });

  res.json({
    conversion: fullConversion,
    client: clientRecord,
  });
});

// POST /api/conversions/onboard — Official Client + Initial Project Onboarding for a Converted Lead
conversionsRouter.post('/onboard', async (req: AuthRequest, res: Response) => {
  try {
    const {
      lead_id,
      company,
      contact_name,
      email,
      phone,
      industry = '',
      website = '',
      address = '',
      client_notes = '',
      project_name,
      service_type,
      project_status = 'In progress',
      start_date,
      end_date,
      budget = 0,
      currency = 'USD',
      manager_id = null,
      tech_stack = '',
      project_description = '',
    } = req.body || {};

    if (!lead_id) {
      res.status(400).json({ error: 'lead_id is required for onboarding' });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: String(lead_id) },
      include: { client: true, conversion: true },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // 1. Ensure Lead is marked Converted
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'Converted' },
    });

    // 2. Ensure Conversion record is marked converted
    await prisma.conversion.upsert({
      where: { lead_id: lead.id },
      update: {
        outcome: 'converted',
        deal_value: Number(budget ?? lead.budget ?? 0),
        currency: currency || lead.currency || 'USD',
        decided_at: new Date(),
      },
      create: {
        lead_id: lead.id,
        outcome: 'converted',
        deal_value: Number(budget ?? lead.budget ?? 0),
        currency: currency || lead.currency || 'USD',
        decided_at: new Date(),
        history: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            from_outcome: null,
            to_outcome: 'converted',
            deal_value: Number(budget ?? lead.budget ?? 0),
            currency: currency || lead.currency || 'USD',
            changed_by: req.user?.name || 'User',
            note: 'Official Client & Project Onboarded',
          },
        ]),
      },
    });

    // 3. Create or Update Official Client Profile
    let client = await prisma.client.findUnique({ where: { lead_id: lead.id } });
    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          company: (company || lead.company).trim(),
          contact_name: (contact_name || lead.name).trim(),
          email: (email || lead.email).trim(),
          phone: (phone || lead.phone).trim(),
          industry: String(industry || client.industry || '').trim(),
          website: String(website || client.website || '').trim(),
          address: String(address || client.address || '').trim(),
          status: 'Active',
          notes: String(client_notes || client.notes || lead.notes || '').trim(),
        },
      });
    } else {
      client = await prisma.client.create({
        data: {
          lead_id: lead.id,
          company: (company || lead.company).trim(),
          contact_name: (contact_name || lead.name).trim(),
          email: (email || lead.email).trim(),
          phone: (phone || lead.phone).trim(),
          industry: String(industry || '').trim(),
          website: String(website || '').trim(),
          address: String(address || '').trim(),
          status: 'Active',
          notes: String(client_notes || lead.notes || '').trim(),
          became_client_at: new Date(),
        },
      });
    }

    // 4. Create the Onboarded Project if project_name is provided
    let project = null;
    if (project_name && String(project_name).trim()) {
      const startDateObj = start_date ? new Date(start_date) : new Date();
      const defaultEnd = new Date(startDateObj);
      defaultEnd.setDate(defaultEnd.getDate() + 45);
      const endDateObj = end_date ? new Date(end_date) : defaultEnd;

      project = await prisma.project.create({
        data: {
          client_id: client.id,
          name: String(project_name).trim(),
          description: String(project_description || lead.notes || '').trim(),
          service_type: service_type || lead.service || 'AI services',
          status: project_status || 'In progress',
          start_date: startDateObj,
          end_date: endDateObj,
          budget: Number(budget ?? lead.budget ?? 0),
          currency: currency || lead.currency || 'INR',
          manager_id: manager_id || lead.owner_id || req.user?.id || null,
          tech_stack: String(tech_stack || '').trim(),
          progress: 0,
          progress_override: false,
          notes: `Onboarded from converted lead (${lead.company}).`,
        },
      });

      await prisma.clientNote.create({
        data: {
          client_id: client.id,
          text: `Official client onboarding completed & project "${project.name}" kicked off (${project.currency} ${project.budget.toLocaleString()}).`,
          created_by: req.user?.id || null,
        },
      });
    } else {
      await prisma.clientNote.create({
        data: {
          client_id: client.id,
          text: `Official client profile onboarded from converted lead.`,
          created_by: req.user?.id || null,
        },
      });
    }

    res.status(201).json({ client, project });
  } catch (err) {
    console.error('Error onboarding client & project:', err);
    res.status(500).json({ error: 'Failed to onboard client and project' });
  }
});

