import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

export const FEEDBACK_SENTIMENTS = [
  'Positive',
  'Neutral',
  'Constructive',
  'Critical',
] as const;

export const FEEDBACK_CATEGORIES = [
  'Delivery Quality',
  'Communication',
  'Timeline & Speed',
  'Technical Expertise',
  'Support & SLA',
  'General',
] as const;

export const FEEDBACK_STATUSES = [
  'New',
  'Reviewed',
  'Action in progress',
  'Resolved',
] as const;

const feedbackInputSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  project_id: z.string().nullable().optional(),
  rating: z.coerce.number().min(1).max(5).default(5),
  sentiment: z.enum(FEEDBACK_SENTIMENTS).default('Positive'),
  category: z.enum(FEEDBACK_CATEGORIES).default('Delivery Quality'),
  comment: z.string().min(3, 'Client feedback comment is required'),
  action_taken: z.string().optional().default(''),
  status: z.enum(FEEDBACK_STATUSES).default('Reviewed'),
  submitted_by: z.string().optional().default(''),
  feedback_date: z.string().optional(),
  is_testimonial: z.boolean().optional().default(false),
});

// GET /api/feedback
feedbackRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, project_id, sentiment, category, status, search } = req.query as Record<
      string,
      string | undefined
    >;

    const where: Record<string, unknown> = {};
    if (client_id && client_id !== 'ALL') where.client_id = client_id;
    if (project_id && project_id !== 'ALL') where.project_id = project_id;
    if (sentiment && sentiment !== 'ALL') where.sentiment = sentiment;
    if (category && category !== 'ALL') where.category = category;
    if (status && status !== 'ALL') where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { comment: { contains: q } },
        { action_taken: { contains: q } },
        { submitted_by: { contains: q } },
        { category: { contains: q } },
      ];
    }

    const feedbacks = await prisma.feedback.findMany({
      where,
      include: {
        client: { select: { id: true, company: true, contact_name: true, industry: true } },
        project: { select: { id: true, name: true, service_type: true, status: true } },
        recorder: { select: { id: true, name: true, email: true } },
      },
      orderBy: { feedback_date: 'desc' },
    });

    // Calculate overall summary stats across all feedback records
    const allFeedbacks = await prisma.feedback.findMany();
    const totalCount = allFeedbacks.length;
    const sumRatings = allFeedbacks.reduce((acc: number, f: any) => acc + Number(f.rating || 0), 0);
    const averageRating = totalCount > 0 ? Math.round((sumRatings / totalCount) * 10) / 10 : 0;
    const positiveCount = allFeedbacks.filter((f: any) => f.sentiment === 'Positive').length;
    const positivePct = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;
    const pendingActionsCount = allFeedbacks.filter(
      (f: any) => f.status === 'New' || f.status === 'Action in progress'
    ).length;
    const testimonialCount = allFeedbacks.filter((f: any) => Boolean(f.is_testimonial)).length;

    const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: allFeedbacks.filter((f: any) => Number(f.rating) === star).length,
    }));

    res.json({
      feedbacks,
      summary: {
        totalCount,
        averageRating,
        positiveCount,
        positivePct,
        pendingActionsCount,
        testimonialCount,
        ratingDistribution,
      },
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    res.status(500).json({ error: 'Failed to fetch client feedback' });
  }
});

// POST /api/feedback
feedbackRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = feedbackInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const created = await prisma.feedback.create({
    data: {
      client_id: data.client_id,
      project_id: data.project_id || null,
      rating: data.rating,
      sentiment: data.sentiment,
      category: data.category,
      comment: data.comment.trim(),
      action_taken: data.action_taken?.trim() || '',
      status: data.status,
      submitted_by: data.submitted_by?.trim() || '',
      feedback_date: data.feedback_date ? new Date(data.feedback_date) : new Date(),
      recorded_by: req.user?.id || null,
      is_testimonial: data.is_testimonial ?? false,
    },
    include: {
      client: { select: { id: true, company: true, contact_name: true } },
      project: { select: { id: true, name: true, service_type: true } },
      recorder: { select: { id: true, name: true } },
    },
  });

  // Also record a note in the client's activity log so Client Details reflects the feedback!
  await prisma.clientNote.create({
    data: {
      client_id: data.client_id,
      text: `Client Feedback (${data.rating}/5 ★ - ${data.category}): "${data.comment.trim()}"`,
      created_by: req.user?.id || null,
    },
  });

  res.status(201).json({ feedback: created });
});

// PUT /api/feedback/:id
feedbackRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Feedback entry not found' });
    return;
  }

  const parsed = feedbackInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten(),
    });
    return;
  }

  const data = parsed.data;
  const updated = await prisma.feedback.update({
    where: { id },
    data: {
      ...(data.client_id !== undefined ? { client_id: data.client_id } : {}),
      ...(data.project_id !== undefined ? { project_id: data.project_id || null } : {}),
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.sentiment !== undefined ? { sentiment: data.sentiment } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.comment !== undefined ? { comment: data.comment.trim() } : {}),
      ...(data.action_taken !== undefined ? { action_taken: data.action_taken.trim() } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.submitted_by !== undefined ? { submitted_by: data.submitted_by.trim() } : {}),
      ...(data.feedback_date !== undefined
        ? { feedback_date: new Date(data.feedback_date) }
        : {}),
      ...(data.is_testimonial !== undefined ? { is_testimonial: data.is_testimonial } : {}),
    },
    include: {
      client: { select: { id: true, company: true, contact_name: true } },
      project: { select: { id: true, name: true, service_type: true } },
      recorder: { select: { id: true, name: true } },
    },
  });

  res.json({ feedback: updated });
});

// DELETE /api/feedback/:id
feedbackRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Feedback entry not found' });
    return;
  }

  await prisma.feedback.delete({ where: { id } });
  res.json({ success: true });
});

