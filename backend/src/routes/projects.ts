import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { SERVICE_TYPES } from './leads.ts';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

export const PROJECT_STATUSES = [
  'Planned',
  'In progress',
  'On hold',
  'Completed',
  'Cancelled',
] as const;

export const PROJECT_COST_CATEGORIES = [
  'Cloud / Infrastructure',
  'Resource Allocation',
  'Third-Party Vendor / API',
  'Software License / SaaS',
  'Contractor / Freelancer',
  'Other',
] as const;



function enrichProjectFinancials(project: any) {
  if (!project) return project;
  const costs = Array.isArray(project.project_costs) ? project.project_costs : [];
  const budget = Number(project.budget || 0);
  const total_cost = costs.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const resource_cost = costs
    .filter((c: any) => c.category === 'Resource Allocation')
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const vendor_cost = total_cost - resource_cost;
  const profit = budget - total_cost;
  const profit_margin_pct = budget > 0 ? Math.round((profit / budget) * 1000) / 10 : 0;

  return {
    ...project,
    project_costs: costs,
    total_cost,
    vendor_cost,
    resource_cost,
    profit,
    profit_margin_pct,
  };
}

const projectCostInputSchema = z.object({
  title: z.string().min(1, 'Cost title / description is required'),
  category: z.enum(PROJECT_COST_CATEGORIES).default('Cloud / Infrastructure'),
  vendor_or_resource: z.string().optional().default(''),
  amount: z.coerce.number().min(0, 'Cost amount must be 0 or greater'),
  incurred_date: z.string().optional(),
  notes: z.string().optional().default(''),
});

const projectInputSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().default(''),
  service_type: z.enum(SERVICE_TYPES),
  status: z.enum(PROJECT_STATUSES).default('Planned'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'Expected end date is required'),
  budget: z.coerce.number().min(0).default(0),
  currency: z.string().default('INR'),
  manager_id: z.string().nullable().optional(),
  tech_stack: z.string().optional().default(''),
  progress: z.coerce.number().min(0).max(100).default(0),
  progress_override: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

const standardProjectInclude = {
  client: { select: { id: true, company: true, contact_name: true, status: true } },
  manager: { select: { id: true, name: true, email: true } },
  timeline_entries: {
    orderBy: [{ sort_order: 'asc' as const }, { start_date: 'asc' as const }],
    include: { assignee: { select: { id: true, name: true } } },
  },
  project_costs: {
    orderBy: [{ incurred_date: 'desc' as const }, { created_at: 'desc' as const }],
    include: { author: { select: { id: true, name: true } } },
  },
};

projectsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {

    const { search, client_id, status, manager_id } = req.query as Record<
      string,
      string | undefined
    >;

    const where: Record<string, unknown> = {};

    if (client_id && client_id !== 'ALL') {
      where.client_id = client_id;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (manager_id && manager_id !== 'ALL') {
      where.manager_id = manager_id;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { tech_stack: { contains: q } },
        { service_type: { contains: q } },
      ];
    }

    const rawProjects = await prisma.project.findMany({
      where,
      include: standardProjectInclude,
      orderBy: { start_date: 'desc' },
    });

    const projects = rawProjects.map(enrichProjectFinancials);
    res.json({ projects });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

projectsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true, role: true } },
      timeline_entries: {
        orderBy: [{ sort_order: 'asc' }, { start_date: 'asc' }],
        include: { assignee: { select: { id: true, name: true, email: true } } },
      },
      project_costs: {
        orderBy: [{ incurred_date: 'desc' }, { created_at: 'desc' }],
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.json({ project: enrichProjectFinancials(project) });
});

projectsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = projectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const project = await prisma.project.create({
    data: {
      client_id: data.client_id,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      service_type: data.service_type,
      status: data.status,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      budget: data.budget,
      currency: data.currency || 'INR',
      manager_id: data.manager_id || null,
      tech_stack: data.tech_stack?.trim() || '',
      progress: data.progress,
      progress_override: data.progress_override ?? false,
      notes: data.notes?.trim() || '',
    },
    include: standardProjectInclude,
  });

  res.status(201).json({ project: enrichProjectFinancials(project) });
});

projectsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = projectInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(data.client_id !== undefined ? { client_id: data.client_id } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.service_type !== undefined ? { service_type: data.service_type } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.start_date !== undefined ? { start_date: new Date(data.start_date) } : {}),
      ...(data.end_date !== undefined ? { end_date: new Date(data.end_date) } : {}),
      ...(data.budget !== undefined ? { budget: data.budget } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.manager_id !== undefined ? { manager_id: data.manager_id || null } : {}),
      ...(data.tech_stack !== undefined ? { tech_stack: data.tech_stack.trim() } : {}),
      ...(data.progress !== undefined ? { progress: data.progress } : {}),
      ...(data.progress_override !== undefined
        ? { progress_override: data.progress_override }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
    },
    include: standardProjectInclude,
  });

  res.json({ project: enrichProjectFinancials(updated) });
});

// POST /api/projects/:id/costs — Add a Vendor Payment or Resource Allocation Cost
projectsRouter.post('/:id/costs', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const existingProject = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existingProject) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const parsed = projectCostInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
      return;
    }

    const data = parsed.data;
    const createdCost = await prisma.projectCost.create({
      data: {
        project_id: projectId,
        title: data.title.trim(),
        category: data.category,
        vendor_or_resource: data.vendor_or_resource?.trim() || '',
        amount: Number(data.amount || 0),
        incurred_date: data.incurred_date ? new Date(data.incurred_date) : new Date(),
        notes: data.notes?.trim() || '',
        created_by: req.user?.id || null,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    const refreshedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: standardProjectInclude,
    });

    res.status(201).json({
      cost: createdCost,
      project: enrichProjectFinancials(refreshedProject),
    });
  } catch (err) {
    console.error('Error adding project cost:', err);
    res.status(500).json({ error: 'Failed to add project cost' });
  }
});

// PUT /api/projects/:id/costs/:costId — Update a Vendor Payment or Resource Allocation Cost
projectsRouter.put('/:id/costs/:costId', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const costId = String(req.params.costId);

    const existingCost = await prisma.projectCost.findUnique({ where: { id: costId } });
    if (!existingCost || existingCost.project_id !== projectId) {
      res.status(404).json({ error: 'Project cost record not found' });
      return;
    }

    const parsed = projectCostInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
      return;
    }

    const data = parsed.data;
    const updatedCost = await prisma.projectCost.update({
      where: { id: costId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.vendor_or_resource !== undefined
          ? { vendor_or_resource: data.vendor_or_resource.trim() }
          : {}),
        ...(data.amount !== undefined ? { amount: Number(data.amount) } : {}),
        ...(data.incurred_date !== undefined
          ? { incurred_date: new Date(data.incurred_date) }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
      },
      include: { author: { select: { id: true, name: true } } },
    });

    const refreshedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: standardProjectInclude,
    });

    res.json({
      cost: updatedCost,
      project: enrichProjectFinancials(refreshedProject),
    });
  } catch (err) {
    console.error('Error updating project cost:', err);
    res.status(500).json({ error: 'Failed to update project cost' });
  }
});

// DELETE /api/projects/:id/costs/:costId — Delete a Vendor Payment or Resource Allocation Cost
projectsRouter.delete('/:id/costs/:costId', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const costId = String(req.params.costId);

    const existingCost = await prisma.projectCost.findUnique({ where: { id: costId } });
    if (!existingCost || existingCost.project_id !== projectId) {
      res.status(404).json({ error: 'Project cost record not found' });
      return;
    }

    await prisma.projectCost.delete({ where: { id: costId } });

    const refreshedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: standardProjectInclude,
    });

    res.json({
      success: true,
      project: enrichProjectFinancials(refreshedProject),
    });
  } catch (err) {
    console.error('Error deleting project cost:', err);
    res.status(500).json({ error: 'Failed to delete project cost' });
  }
});

projectsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  await prisma.project.delete({ where: { id } });
  res.json({ success: true, message: 'Project deleted successfully' });
});
