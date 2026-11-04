import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

export const CLIENT_STATUSES = ['Active', 'On hold', 'Completed', 'Inactive'] as const;

const clientInputSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  contact_name: z.string().min(1, 'Primary contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(3, 'Phone number is required'),
  address: z.string().optional().default(''),
  website: z.string().optional().default(''),
  industry: z.string().optional().default(''),
  status: z.enum(CLIENT_STATUSES).default('Active'),
  notes: z.string().optional().default(''),
  became_client_at: z.string().optional(),
  lead_id: z.string().nullable().optional(),
});

const noteSchema = z.object({
  text: z.string().min(1, 'Note text is required'),
});

clientsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { company: { contains: q } },
        { contact_name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { industry: { contains: q } },
        { address: { contains: q } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, company: true, source: true, service: true } },
        projects: {
          include: { manager: { select: { id: true, name: true } } },
          orderBy: { start_date: 'desc' },
        },
        client_notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { became_client_at: 'desc' },
    });

    res.json({ clients });
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

clientsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      lead: true,
      projects: {
        include: {
          manager: { select: { id: true, name: true, email: true } },
          timeline_entries: true,
        },
        orderBy: { start_date: 'desc' },
      },
      client_notes: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  res.json({ client });
});

clientsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = clientInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const client = await prisma.client.create({
    data: {
      company: data.company.trim(),
      contact_name: data.contact_name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || '',
      website: data.website?.trim() || '',
      industry: data.industry?.trim() || '',
      status: data.status,
      notes: data.notes?.trim() || '',
      became_client_at: data.became_client_at ? new Date(data.became_client_at) : new Date(),
      lead_id: data.lead_id || null,
    },
  });

  if (data.notes && data.notes.trim()) {
    await prisma.clientNote.create({
      data: {
        client_id: client.id,
        text: `Initial client note: ${data.notes.trim()}`,
        created_by: req.user?.id || null,
      },
    });
  }

  const fullClient = await prisma.client.findUnique({
    where: { id: client.id },
    include: {
      lead: true,
      projects: true,
      client_notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  res.status(201).json({ client: fullClient });
});

clientsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const parsed = clientInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  await prisma.client.update({
    where: { id },
    data: {
      ...(data.company !== undefined ? { company: data.company.trim() } : {}),
      ...(data.contact_name !== undefined ? { contact_name: data.contact_name.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() } : {}),
      ...(data.website !== undefined ? { website: data.website.trim() } : {}),
      ...(data.industry !== undefined ? { industry: data.industry.trim() } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
      ...(data.became_client_at !== undefined
        ? { became_client_at: new Date(data.became_client_at) }
        : {}),
    },
  });

  const fullClient = await prisma.client.findUnique({
    where: { id },
    include: {
      lead: true,
      projects: {
        include: { manager: { select: { id: true, name: true } } },
      },
      client_notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  res.json({ client: fullClient });
});

clientsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const force = req.query.force === 'true';

  const existing = await prisma.client.findUnique({
    where: { id },
    include: { projects: true },
  });

  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  if (existing.projects.length > 0 && !force) {
    res.status(409).json({
      error: `This client has ${existing.projects.length} associated project(s). Confirm cascade deletion to delete the client and all their projects.`,
      projectCount: existing.projects.length,
      requiresForceConfirmation: true,
    });
    return;
  }

  await prisma.client.delete({ where: { id } });
  res.json({ success: true, message: 'Client deleted successfully' });
});

clientsRouter.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Note text is required' });
    return;
  }

  const note = await prisma.clientNote.create({
    data: {
      client_id: id,
      text: parsed.data.text.trim(),
      created_by: req.user?.id || null,
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ note });
});
