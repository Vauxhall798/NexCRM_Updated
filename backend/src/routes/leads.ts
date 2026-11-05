import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold outreach',
  'Event',
  'Other',
] as const;

export const SERVICE_TYPES = [
  'AI services',
  'Data Engineering',
  'Idea to Launch',
  'Others',
] as const;

export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Meeting scheduled',
  'Proposal sent',
  'Negotiation',
  'Converted',
  'Not converted',
] as const;

async function syncLeadConversionAndClient(lead: any, user?: { id?: string; name?: string }) {
  if (lead.status === 'Converted') {
    await prisma.conversion.upsert({
      where: { lead_id: lead.id },
      update: {
        outcome: 'converted',
        deal_value: lead.budget || 0,
        currency: lead.currency || 'USD',
        decided_at: new Date(),
      },
      create: {
        lead_id: lead.id,
        outcome: 'converted',
        deal_value: lead.budget || 0,
        currency: lead.currency || 'USD',
        decided_at: new Date(),
        history: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            from_outcome: null,
            to_outcome: 'converted',
            deal_value: lead.budget || 0,
            currency: lead.currency || 'USD',
            changed_by: user?.name || 'User',
            note: 'Marked as Converted via Lead status',
          },
        ]),
      },
    });

    const existingClient = await prisma.client.findUnique({
      where: { lead_id: lead.id },
    });
    if (!existingClient) {
      const createdClient = await prisma.client.create({
        data: {
          lead_id: lead.id,
          company: lead.company,
          contact_name: lead.name,
          email: lead.email,
          phone: lead.phone,
          status: 'Active',
          notes: lead.notes || `Converted from lead (${lead.service}).`,
          became_client_at: new Date(),
        },
      });
      await prisma.clientNote.create({
        data: {
          client_id: createdClient.id,
          text: `Client automatically created when lead status was set to Converted (${lead.currency} ${(lead.budget || 0).toLocaleString()}).`,
          created_by: user?.id || null,
        },
      });
    }
  } else if (lead.status === 'Not converted') {
    await prisma.conversion.upsert({
      where: { lead_id: lead.id },
      update: {
        outcome: 'not_converted',
        reason: 'Other',
        comment: 'Marked as Not converted via Lead status',
        decided_at: new Date(),
      },
      create: {
        lead_id: lead.id,
        outcome: 'not_converted',
        reason: 'Other',
        comment: 'Marked as Not converted via Lead status',
        currency: lead.currency || 'USD',
        deal_value: lead.budget || 0,
        decided_at: new Date(),
        history: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            from_outcome: null,
            to_outcome: 'not_converted',
            changed_by: user?.name || 'User',
            note: 'Marked as Not converted via Lead status',
          },
        ]),
      },
    });
  } else {
    const existingConv = await prisma.conversion.findUnique({
      where: { lead_id: lead.id },
    });
    if (existingConv && existingConv.outcome !== 'in_progress') {
      await prisma.conversion.update({
        where: { id: existingConv.id },
        data: {
          outcome: 'in_progress',
          decided_at: null,
        },
      });
    } else if (
      !existingConv &&
      (lead.status === 'Proposal sent' || lead.status === 'Negotiation')
    ) {
      await prisma.conversion.create({
        data: {
          lead_id: lead.id,
          outcome: 'in_progress',
          currency: lead.currency || 'USD',
          deal_value: lead.budget || 0,
          history: JSON.stringify([
            {
              timestamp: new Date().toISOString(),
              from_outcome: null,
              to_outcome: 'in_progress',
              changed_by: user?.name || 'User',
              note: `Lead entered ${lead.status}`,
            },
          ]),
        },
      });
    }
  }
}

const leadInputSchema = z.object({
  name: z.string().min(1, 'Lead name is required'),
  company: z.string().min(1, 'Company name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(3, 'Phone number is required'),
  source: z.enum(LEAD_SOURCES),
  service: z.enum(SERVICE_TYPES),
  budget: z.coerce.number().min(0, 'Budget must be 0 or greater').default(0),
  currency: z.string().min(1).default('INR'),
  status: z.enum(LEAD_STATUSES).default('New'),
  owner_id: z.string().nullable().optional(),
  next_followup: z.string().nullable().optional(),
  followup_resource: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const noteSchema = z.object({
  text: z.string().min(1, 'Note text cannot be empty'),
  next_followup: z.string().nullable().optional(),
  followup_resource: z.string().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
});

leadsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      source,
      owner_id,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_dir = 'desc',
    } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (source && source !== 'ALL') {
      where.source = source;
    }
    if (owner_id && owner_id !== 'ALL') {
      where.owner_id = owner_id;
    }
    if (date_from || date_to) {
      const createdAtFilter: Record<string, Date> = {};
      if (date_from) createdAtFilter.gte = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.lte = end;
      }
      where.created_at = createdAtFilter;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { company: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { service: { contains: q } },
      ];
    }

    const validSortFields = ['created_at', 'name', 'company', 'budget', 'next_followup', 'status'];
    const orderByField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const orderDirection = sort_dir === 'asc' ? 'asc' : 'desc';

    const leads = await prisma.lead.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        conversion: true,
        client: { select: { id: true, company: true, status: true } },
        lead_notes: {
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { [orderByField]: orderDirection },
    });

    res.json({ leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

leadsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      conversion: true,
      client: true,
      lead_notes: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  res.json({ lead });
});

leadsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = leadInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const lead = await prisma.lead.create({
    data: {
      name: data.name.trim(),
      company: data.company.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      source: data.source,
      service: data.service,
      budget: data.budget,
      currency: data.currency,
      status: data.status,
      owner_id: data.owner_id || null,
      next_followup: data.next_followup ? new Date(data.next_followup) : null,
      followup_resource: data.followup_resource?.trim() || '',
      notes: data.notes?.trim() || '',
    },
  });

  if (data.notes && data.notes.trim()) {
    await prisma.leadNote.create({
      data: {
        lead_id: lead.id,
        text: `Initial lead note: ${data.notes.trim()}`,
        created_by: req.user?.id || null,
      },
    });
  }

  await syncLeadConversionAndClient(lead, req.user);

  const refreshed = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      conversion: true,
      client: true,
      lead_notes: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  res.status(201).json({ lead: refreshed });
});

leadsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const parsed = leadInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const statusChanged = data.status && data.status !== existing.status;

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.company !== undefined ? { company: data.company.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.source !== undefined ? { source: data.source } : {}),
      ...(data.service !== undefined ? { service: data.service } : {}),
      ...(data.budget !== undefined ? { budget: data.budget } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.owner_id !== undefined ? { owner_id: data.owner_id || null } : {}),
      ...(data.next_followup !== undefined
        ? { next_followup: data.next_followup ? new Date(data.next_followup) : null }
        : {}),
      ...(data.followup_resource !== undefined
        ? { followup_resource: data.followup_resource.trim() }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
    },
  });

  let authorId: string | null = req.user?.id || null;
  if (authorId) {
    const userExists = await prisma.user.findUnique({ where: { id: authorId } });
    if (!userExists) authorId = null;
  }

  if (statusChanged) {
    await prisma.leadNote.create({
      data: {
        lead_id: updated.id,
        text: `Status updated from "${existing.status}" to "${data.status}"`,
        created_by: authorId,
      },
    });
    await syncLeadConversionAndClient(updated, req.user);
  }

  const workNote = typeof req.body.work_note === 'string' ? req.body.work_note.trim() : '';
  if (workNote) {
    await prisma.leadNote.create({
      data: {
        lead_id: updated.id,
        text: workNote,
        created_by: authorId,
      },
    });
  } else if (
    data.next_followup !== undefined &&
    ((data.next_followup === null && existing.next_followup !== null) ||
      (data.next_followup !== null &&
        existing.next_followup?.toISOString() !== new Date(data.next_followup).toISOString()))
  ) {
    const followupText = data.next_followup
      ? `Follow-up scheduled for ${new Date(data.next_followup).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`
      : 'Follow-up date cleared';
    await prisma.leadNote.create({
      data: {
        lead_id: updated.id,
        text: followupText,
        created_by: authorId,
      },
    });
  }

  const fullLead = await prisma.lead.findUnique({
    where: { id: updated.id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      conversion: true,
      client: true,
      lead_notes: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  res.json({ lead: fullLead });
});

leadsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  await prisma.lead.delete({ where: { id } });
  res.json({ success: true, message: 'Lead deleted successfully' });
});

leadsRouter.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Note text is required' });
    return;
  }

  const { text, next_followup, followup_resource, status } = parsed.data;

  // If next_followup, followup_resource, or status is provided, update the lead
  const updateData: any = {};
  if (next_followup !== undefined) {
    updateData.next_followup = next_followup ? new Date(next_followup) : null;
  }
  if (followup_resource !== undefined) {
    updateData.followup_resource = followup_resource.trim();
  }
  if (status && status !== lead.status) {
    updateData.status = status;
  }

  if (Object.keys(updateData).length > 0) {
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: updateData,
    });
    if (updateData.status) {
      await syncLeadConversionAndClient(updatedLead, req.user);
    }
  }

  let authorId: string | null = req.user?.id || null;
  if (authorId) {
    const userExists = await prisma.user.findUnique({ where: { id: authorId } });
    if (!userExists) authorId = null;
  }

  const note = await prisma.leadNote.create({
    data: {
      lead_id: lead.id,
      text: text.trim(),
      created_by: authorId,
    },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const refreshedLead = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      conversion: true,
      client: true,
      lead_notes: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  res.status(201).json({ note, lead: refreshedLead });
});

leadsRouter.delete('/:id/notes/:noteId', async (req: AuthRequest, res: Response) => {
  const noteId = String(req.params.noteId);
  const existing = await prisma.leadNote.findUnique({ where: { id: noteId } });
  if (!existing) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  await prisma.leadNote.delete({ where: { id: noteId } });
  res.json({ success: true });
});

leadsRouter.post('/:id/move-to-conversion', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { conversion: true },
  });

  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  if (lead.conversion) {
    res.json({
      conversion: lead.conversion,
      alreadyExists: true,
      message: 'Lead is already in the Conversion pipeline',
    });
    return;
  }

  const initialHistory = [
    {
      timestamp: new Date().toISOString(),
      from_outcome: null,
      to_outcome: 'in_progress',
      changed_by: req.user?.name || 'System',
      note: 'Moved lead to Conversion pipeline',
    },
  ];

  const conversion = await prisma.conversion.create({
    data: {
      lead_id: lead.id,
      outcome: 'in_progress',
      currency: lead.currency || 'USD',
      deal_value: lead.budget || 0,
      history: JSON.stringify(initialHistory),
    },
    include: {
      lead: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          client: true,
        },
      },
    },
  });

  await prisma.leadNote.create({
    data: {
      lead_id: lead.id,
      text: 'Moved lead to Conversion pipeline (In Progress).',
      created_by: req.user?.id || null,
    },
  });

  res.status(201).json({ conversion, alreadyExists: false });
});
