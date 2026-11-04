import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const bauRouter = Router();
bauRouter.use(requireAuth);

export const BAU_STATES = [
  'New',
  'Work in progress',
  'Pending',
  'Resolved',
] as const;

export const BAU_PRIORITIES = [
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;

export const BAU_CATEGORIES = [
  'Bug / Defect',
  'Change Request',
  'Performance',
  'Access & Security',
  'Environment / Infra',
  'Data / Reporting',
] as const;

const bauTicketSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  project_id: z.string().min(1, 'Project is required'),
  title: z.string().min(3, 'Ticket title is required'),
  description: z.string().optional().default(''),
  category: z.enum(BAU_CATEGORIES).default('Bug / Defect'),
  priority: z.enum(BAU_PRIORITIES).default('Medium'),
  state: z.enum(BAU_STATES).default('New'),
  reported_by: z.string().optional().default(''),
  assignee_id: z.string().nullable().optional(),
  resolution_notes: z.string().optional().default(''),
  sla_due_date: z.string().nullable().optional(),
});

async function generateNextTicketNumber(): Promise<string> {
  const all = await prisma.bauTicket.findMany();
  let maxNum = 100;
  for (const t of all) {
    const match = String(t.ticket_number || '').match(/BAU-(\d+)/);
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `BAU-${maxNum + 1}`;
}

// GET /api/bau-tickets
bauRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { state, priority, client_id, project_id, assignee_id, search } = req.query as Record<
      string,
      string | undefined
    >;

    const where: Record<string, unknown> = {};
    if (state && state !== 'ALL') where.state = state;
    if (priority && priority !== 'ALL') where.priority = priority;
    if (client_id && client_id !== 'ALL') where.client_id = client_id;
    if (project_id && project_id !== 'ALL') where.project_id = project_id;
    if (assignee_id && assignee_id !== 'ALL') where.assignee_id = assignee_id;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { ticket_number: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { reported_by: { contains: q } },
        { resolution_notes: { contains: q } },
      ];
    }

    const tickets = await prisma.bauTicket.findMany({
      where,
      include: {
        client: { select: { id: true, company: true, contact_name: true, status: true } },
        project: { select: { id: true, name: true, status: true, service_type: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const allTickets = await prisma.bauTicket.findMany();
    const total = allTickets.length;
    const newCount = allTickets.filter((t: any) => t.state === 'New').length;
    const wipCount = allTickets.filter((t: any) => t.state === 'Work in progress').length;
    const pendingCount = allTickets.filter((t: any) => t.state === 'Pending').length;
    const resolvedCount = allTickets.filter((t: any) => t.state === 'Resolved').length;
    const criticalCount = allTickets.filter(
      (t: any) => t.priority === 'Critical' && t.state !== 'Resolved'
    ).length;

    res.json({
      tickets,
      summary: {
        total,
        newCount,
        wipCount,
        pendingCount,
        resolvedCount,
        criticalCount,
      },
    });
  } catch (err) {
    console.error('Error fetching BAU tickets:', err);
    res.status(500).json({ error: 'Failed to fetch BAU tickets' });
  }
});

// POST /api/bau-tickets
bauRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = bauTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const ticketNumber = await generateNextTicketNumber();

  const created = await prisma.bauTicket.create({
    data: {
      ticket_number: ticketNumber,
      client_id: data.client_id,
      project_id: data.project_id,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      category: data.category,
      priority: data.priority,
      state: data.state,
      reported_by: data.reported_by?.trim() || '',
      assignee_id: data.assignee_id || null,
      resolution_notes: data.resolution_notes?.trim() || '',
      sla_due_date: data.sla_due_date ? new Date(data.sla_due_date) : null,
      resolved_at: data.state === 'Resolved' ? new Date() : null,
    },
    include: {
      client: { select: { id: true, company: true, contact_name: true } },
      project: { select: { id: true, name: true, status: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.clientNote.create({
    data: {
      client_id: data.client_id,
      text: `BAU Ticket ${ticketNumber} logged (${data.priority} - ${data.state}): "${data.title.trim()}"`,
      created_by: req.user?.id || null,
    },
  });

  res.status(201).json({ ticket: created });
});

// PUT /api/bau-tickets/:id
bauRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.bauTicket.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'BAU ticket not found' });
    return;
  }

  const parsed = bauTicketSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  let resolvedAt = existing.resolved_at;
  if (data.state !== undefined) {
    if (data.state === 'Resolved' && existing.state !== 'Resolved') {
      resolvedAt = new Date().toISOString();
    } else if (data.state !== 'Resolved') {
      resolvedAt = null;
    }
  }

  const updated = await prisma.bauTicket.update({
    where: { id },
    data: {
      ...(data.client_id !== undefined ? { client_id: data.client_id } : {}),
      ...(data.project_id !== undefined ? { project_id: data.project_id } : {}),
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.reported_by !== undefined ? { reported_by: data.reported_by.trim() } : {}),
      ...(data.assignee_id !== undefined ? { assignee_id: data.assignee_id || null } : {}),
      ...(data.resolution_notes !== undefined
        ? { resolution_notes: data.resolution_notes.trim() }
        : {}),
      ...(data.sla_due_date !== undefined
        ? { sla_due_date: data.sla_due_date ? new Date(data.sla_due_date) : null }
        : {}),
      resolved_at: resolvedAt,
    },
    include: {
      client: { select: { id: true, company: true, contact_name: true } },
      project: { select: { id: true, name: true, status: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({ ticket: updated });
});

// DELETE /api/bau-tickets/:id
bauRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.bauTicket.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'BAU ticket not found' });
    return;
  }

  await prisma.bauTicket.delete({ where: { id } });
  res.json({ success: true });
});

