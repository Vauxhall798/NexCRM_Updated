import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const timelineRouter = Router();
timelineRouter.use(requireAuth);

export const TIMELINE_TYPES = [
  'Milestone',
  'Task',
  'Meeting',
  'Delivery',
  'Issue',
  'Note',
] as const;

export const TIMELINE_STATUSES = ['Planned', 'In progress', 'Done', 'Delayed'] as const;

const timelineEntrySchema = z.object({
  project_id: z.string().min(1, 'Project is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  type: z.enum(TIMELINE_TYPES).default('Task'),
  start_date: z.string().min(1, 'Date is required'),
  end_date: z.string().nullable().optional(),
  status: z.enum(TIMELINE_STATUSES).default('Planned'),
  assignee_id: z.string().nullable().optional(),
  sort_order: z.coerce.number().optional(),
});

async function recalculateProjectProgress(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { timeline_entries: true },
  });

  if (!project) return null;

  const total = project.timeline_entries.length;
  const done = project.timeline_entries.filter((e: any) => e.status === 'Done').length;
  const computedProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!project.progress_override) {
    await prisma.project.update({
      where: { id: projectId },
      data: { progress: computedProgress },
    });
  }

  return {
    total,
    done,
    computedProgress,
    effectiveProgress: project.progress_override ? project.progress : computedProgress,
    progress_override: project.progress_override,
  };
}

timelineRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query as { project_id?: string };
    const where: Record<string, unknown> = {};
    if (project_id && project_id !== 'ALL') {
      where.project_id = project_id;
    }

    const entries = await prisma.timelineEntry.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            progress: true,
            progress_override: true,
            client: { select: { id: true, company: true } },
          },
        },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ sort_order: 'asc' }, { start_date: 'asc' }],
    });

    let stats = null;
    if (project_id && project_id !== 'ALL') {
      stats = await recalculateProjectProgress(project_id);
    }

    res.json({ entries, stats });
  } catch (err) {
    console.error('Error fetching timeline entries:', err);
    res.status(500).json({ error: 'Failed to fetch timeline entries' });
  }
});

timelineRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = timelineEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const existingCount = await prisma.timelineEntry.count({
    where: { project_id: data.project_id },
  });

  const entry = await prisma.timelineEntry.create({
    data: {
      project_id: data.project_id,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      type: data.type,
      start_date: new Date(data.start_date),
      end_date: data.end_date ? new Date(data.end_date) : null,
      status: data.status,
      assignee_id: data.assignee_id || null,
      sort_order: data.sort_order ?? existingCount + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const stats = await recalculateProjectProgress(data.project_id);

  res.status(201).json({ entry, stats });
});

timelineRouter.put('/reorder', async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    project_id: z.string(),
    ordered_ids: z.array(z.string()),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid reorder payload' });
    return;
  }

  const { project_id, ordered_ids } = parsed.data;

  await prisma.$transaction(
    ordered_ids.map((entryId: string, index: number) =>
      prisma.timelineEntry.update({
        where: { id: entryId },
        data: { sort_order: index + 1 },
      })
    )
  );

  const entries = await prisma.timelineEntry.findMany({
    where: { project_id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ sort_order: 'asc' }, { start_date: 'asc' }],
  });

  res.json({ entries });
});

timelineRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.timelineEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Timeline entry not found' });
    return;
  }

  const parsed = timelineEntrySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const entry = await prisma.timelineEntry.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.start_date !== undefined ? { start_date: new Date(data.start_date) } : {}),
      ...(data.end_date !== undefined
        ? { end_date: data.end_date ? new Date(data.end_date) : null }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.assignee_id !== undefined ? { assignee_id: data.assignee_id || null } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const stats = await recalculateProjectProgress(existing.project_id);

  res.json({ entry, stats });
});

timelineRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.timelineEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Timeline entry not found' });
    return;
  }

  await prisma.timelineEntry.delete({ where: { id } });
  const stats = await recalculateProjectProgress(existing.project_id);

  res.json({ success: true, stats });
});
