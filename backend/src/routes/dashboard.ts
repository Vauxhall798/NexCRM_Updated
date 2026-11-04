import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { LEAD_STATUSES } from './leads.ts';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const [leads, clients, projects, conversions, recentTimeline] = await Promise.all([
      prisma.lead.findMany({
        include: {
          owner: { select: { id: true, name: true } },
          conversion: true,
        },
        orderBy: { next_followup: 'asc' },
      }),
      prisma.client.findMany(),
      prisma.project.findMany({
        include: {
          client: { select: { id: true, company: true } },
          manager: { select: { id: true, name: true } },
        },
        orderBy: { end_date: 'asc' },
      }),
      prisma.conversion.findMany(),
      prisma.timelineEntry.findMany({
        take: 8,
        orderBy: { created_at: 'desc' },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              client: { select: { id: true, company: true } },
            },
          },
          assignee: { select: { id: true, name: true } },
        },
      }),
    ]);

    const totalLeads = leads.length;
    const activeClients = clients.filter((c: any) => c.status === 'Active').length;
    const projectsInProgress = projects.filter((p: any) => p.status === 'In progress').length;

    const totalConversions = conversions.length;
    const convertedCount = conversions.filter((c: any) => c.outcome === 'converted').length;
    const conversionRate =
      totalConversions > 0 ? Math.round((convertedCount / totalConversions) * 1000) / 10 : 0;

    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const followupsDueThisWeek = leads
      .filter((l: any) => {
        if (!l.next_followup) return false;
        if (l.status === 'Converted' || l.status === 'Not converted') return false;
        if (l.conversion && l.conversion.outcome !== 'in_progress') return false;
        return new Date(l.next_followup) <= endOfWeek;
      })
      .slice(0, 8);

    const projectsEndingSoon = projects
      .filter(
        (p: any) =>
          p.status === 'In progress' || p.status === 'Planned' || p.status === 'On hold'
      )
      .slice(0, 6);

    const leadsByStatus = LEAD_STATUSES.map((status) => {
      const matching = leads.filter((l: any) => l.status === status);
      return {
        status,
        count: matching.length,
        totalBudget: matching.reduce((acc: number, l: any) => acc + (l.budget || 0), 0),
      };
    });

    const monthBuckets: Record<
      string,
      { month: string; converted: number; not_converted: number; in_progress: number }
    > = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthBuckets[key] = { month: label, converted: 0, not_converted: 0, in_progress: 0 };
    }

    for (const conv of conversions) {
      const refDate = conv.decided_at ? new Date(conv.decided_at) : new Date(conv.created_at);
      const key = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthBuckets[key]) {
        if (conv.outcome === 'converted') monthBuckets[key].converted += 1;
        else if (conv.outcome === 'not_converted') monthBuckets[key].not_converted += 1;
        else monthBuckets[key].in_progress += 1;
      }
    }

    res.json({
      cards: {
        totalLeads,
        activeClients,
        projectsInProgress,
        conversionRate,
        totalClients: clients.length,
        totalProjects: projects.length,
        convertedCount,
        totalConversions,
      },
      followupsDueThisWeek,
      projectsEndingSoon,
      recentTimeline,
      charts: {
        leadsByStatus,
        conversionsByMonth: Object.values(monthBuckets),
      },
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});
