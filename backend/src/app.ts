import { createApp } from './lib/http-app.ts';
import type { Request, Response } from './lib/http-app.ts';
import { authRouter } from './routes/auth.ts';
import { leadsRouter } from './routes/leads.ts';
import { conversionsRouter } from './routes/conversions.ts';
import { clientsRouter } from './routes/clients.ts';
import { projectsRouter } from './routes/projects.ts';
import { timelineRouter } from './routes/timeline.ts';
import { dashboardRouter } from './routes/dashboard.ts';
import { feedbackRouter } from './routes/feedback.ts';
import { bauRouter } from './routes/bau.ts';
import { resourcesRouter } from './routes/resources.ts';
import { proposalsRouter } from './routes/proposals.ts';
import { revenueRouter } from './routes/revenue.ts';
import { paymentsRouter } from './routes/payments.ts';
import { systemRouter } from './routes/system.ts';

export const app = createApp();

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'NexCRM API', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/conversions', conversionsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/bau-tickets', bauRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/revenue', revenueRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/system', systemRouter);
