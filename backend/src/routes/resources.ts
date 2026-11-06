import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const resourcesRouter = Router();
resourcesRouter.use(requireAuth);

export const RESOURCE_DEPARTMENTS = [
  'Executive Leadership',
  'Engineering',
  'Cloud & DevOps',
  'AI & Data',
  'Design & UX',
  'Delivery & QA',
] as const;

export const RESOURCE_SENIORITIES = [
  'Executive',
  'Principal',
  'Senior',
  'Mid-Level',
  'Junior',
] as const;

export const ASSIGNMENT_STATUSES = [
  'Active',
  'Planned',
  'Completed',
] as const;

const resourceSchema = z.object({
  name: z.string().min(2, 'Resource name is required'),
  email: z.string().email('Valid email is required'),
  role_title: z.string().min(2, 'Role title is required'),
  department: z.enum(RESOURCE_DEPARTMENTS).default('Engineering'),
  seniority: z.enum(RESOURCE_SENIORITIES).default('Senior'),
  skills: z.string().optional().default(''),
  total_capacity: z.number().min(10).max(100).default(100),
  hourly_rate: z.number().min(0).default(85),
  on_leave: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

const assignmentSchema = z.object({
  resource_id: z.string().min(1, 'Resource is required'),
  project_id: z.string().min(1, 'Project is required'),
  assignment_role: z.string().min(2, 'Project role is required'),
  allocation_pct: z.number().min(5).max(100).default(50),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  status: z.enum(ASSIGNMENT_STATUSES).default('Active'),
  notes: z.string().optional().default(''),
});

function enrichResourceAvailability(resource: any) {
  const assignments = Array.isArray(resource.assignments) ? resource.assignments : [];
  const activeAssignments = assignments.filter((a: any) => a.status === 'Active');
  const allocatedPct = activeAssignments.reduce(
    (sum: number, a: any) => sum + Number(a.allocation_pct || 0),
    0
  );
  const totalCap = Number(resource.total_capacity || 100);
  const availablePct = resource.on_leave ? 0 : Math.max(0, totalCap - allocatedPct);

  let availability_status: 'Available' | 'Partially Available' | 'Fully Booked' | 'On Leave' =
    'Available';
  if (resource.on_leave) {
    availability_status = 'On Leave';
  } else if (allocatedPct === 0) {
    availability_status = 'Available';
  } else if (availablePct > 0) {
    availability_status = 'Partially Available';
  } else {
    availability_status = 'Fully Booked';
  }

  return {
    ...resource,
    allocated_pct: allocatedPct,
    available_pct: availablePct,
    availability_status,
  };
}

// GET /api/resources
resourcesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { department, seniority, availability, project_id, search } = req.query as Record<
      string,
      string | undefined
    >;

    const where: Record<string, unknown> = {};
    if (department && department !== 'ALL') where.department = department;
    if (seniority && seniority !== 'ALL') where.seniority = seniority;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { role_title: { contains: q } },
        { skills: { contains: q } },
        { department: { contains: q } },
      ];
    }

    const rawResources = await prisma.resource.findMany({
      where,
      include: {
        assignments: {
          include: {
            project: {
              include: { client: true },
            },
          },
          orderBy: { start_date: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    let enriched = rawResources.map(enrichResourceAvailability);

    if (availability && availability !== 'ALL') {
      enriched = enriched.filter((r) => r.availability_status === availability);
    }

    if (project_id && project_id !== 'ALL') {
      enriched = enriched.filter((r) =>
        (r.assignments || []).some((a: any) => a.project_id === project_id)
      );
    }

    // Compute company-wide summary across all resources
    const allRaw = await prisma.resource.findMany({
      include: {
        assignments: {
          include: {
            project: { include: { client: true } },
          },
        },
      },
    });
    const allEnriched = allRaw.map(enrichResourceAvailability);

    const totalResources = allEnriched.length;
    const availableCount = allEnriched.filter(
      (r) => r.availability_status === 'Available'
    ).length;
    const partiallyAvailableCount = allEnriched.filter(
      (r) => r.availability_status === 'Partially Available'
    ).length;
    const fullyBookedCount = allEnriched.filter(
      (r) => r.availability_status === 'Fully Booked'
    ).length;
    const onLeaveCount = allEnriched.filter(
      (r) => r.availability_status === 'On Leave'
    ).length;

    const activePool = allEnriched.filter((r) => !r.on_leave);
    const totalCapSum = activePool.reduce((acc, r) => acc + Number(r.total_capacity || 100), 0);
    const totalAllocSum = activePool.reduce((acc, r) => acc + Number(r.allocated_pct || 0), 0);
    const avgUtilizationPct =
      totalCapSum > 0 ? Math.min(100, Math.round((totalAllocSum / totalCapSum) * 100)) : 0;

    res.json({
      resources: enriched,
      summary: {
        totalResources,
        availableCount,
        partiallyAvailableCount,
        fullyBookedCount,
        onLeaveCount,
        avgUtilizationPct,
      },
    });
  } catch (err) {
    console.error('Error fetching resources:', err);
    res.status(500).json({ error: 'Failed to fetch company resources' });
  }
});

// POST /api/resources
resourcesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = resourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const existingEmail = await prisma.resource.findUnique({
    where: { email: data.email.trim().toLowerCase() },
  });
  if (existingEmail) {
    res.status(400).json({ error: 'A resource with this email already exists' });
    return;
  }

  const created = await prisma.resource.create({
    data: {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role_title: data.role_title.trim(),
      department: data.department,
      seniority: data.seniority,
      skills: data.skills?.trim() || '',
      total_capacity: Number(data.total_capacity || 100),
      hourly_rate: Number(data.hourly_rate || 85),
      on_leave: Boolean(data.on_leave),
      notes: data.notes?.trim() || '',
    },
    include: {
      assignments: {
        include: { project: { include: { client: true } } },
      },
    },
  });

  res.status(201).json({ resource: enrichResourceAvailability(created) });
});

// PUT /api/resources/:id
resourcesRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  const parsed = resourceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const updated = await prisma.resource.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
      ...(data.role_title !== undefined ? { role_title: data.role_title.trim() } : {}),
      ...(data.department !== undefined ? { department: data.department } : {}),
      ...(data.seniority !== undefined ? { seniority: data.seniority } : {}),
      ...(data.skills !== undefined ? { skills: data.skills.trim() } : {}),
      ...(data.total_capacity !== undefined
        ? { total_capacity: Number(data.total_capacity) }
        : {}),
      ...(data.hourly_rate !== undefined ? { hourly_rate: Number(data.hourly_rate) } : {}),
      ...(data.on_leave !== undefined ? { on_leave: Boolean(data.on_leave) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
    },
    include: {
      assignments: {
        include: { project: { include: { client: true } } },
      },
    },
  });

  res.json({ resource: enrichResourceAvailability(updated) });
});

// DELETE /api/resources/:id
resourcesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  await prisma.resourceAssignment.deleteMany({ where: { resource_id: id } });
  await prisma.resource.delete({ where: { id } });
  res.json({ success: true });
});

// POST /api/resources/assignments
resourcesRouter.post('/assignments', async (req: AuthRequest, res: Response) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const resource = await prisma.resource.findUnique({ where: { id: data.resource_id } });
  if (!resource) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: data.project_id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const created = await prisma.resourceAssignment.create({
    data: {
      resource_id: data.resource_id,
      project_id: data.project_id,
      assignment_role: data.assignment_role.trim(),
      allocation_pct: Number(data.allocation_pct),
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      status: data.status,
      notes: data.notes?.trim() || '',
    },
    include: {
      resource: true,
      project: { include: { client: true } },
    },
  });

  res.status(201).json({ assignment: created });
});

// PUT /api/resources/assignments/:id
resourcesRouter.put('/assignments/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.resourceAssignment.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  const parsed = assignmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const updated = await prisma.resourceAssignment.update({
    where: { id },
    data: {
      ...(data.resource_id !== undefined ? { resource_id: data.resource_id } : {}),
      ...(data.project_id !== undefined ? { project_id: data.project_id } : {}),
      ...(data.assignment_role !== undefined
        ? { assignment_role: data.assignment_role.trim() }
        : {}),
      ...(data.allocation_pct !== undefined
        ? { allocation_pct: Number(data.allocation_pct) }
        : {}),
      ...(data.start_date !== undefined ? { start_date: new Date(data.start_date) } : {}),
      ...(data.end_date !== undefined ? { end_date: new Date(data.end_date) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
    },
    include: {
      resource: true,
      project: { include: { client: true } },
    },
  });

  res.json({ assignment: updated });
});

// DELETE /api/resources/assignments/:id
resourcesRouter.delete('/assignments/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.resourceAssignment.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  await prisma.resourceAssignment.delete({ where: { id } });
  res.json({ success: true });
});

