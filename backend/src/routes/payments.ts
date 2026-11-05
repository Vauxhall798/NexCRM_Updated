import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

export const PAYMENT_STATUSES = [
  'Pending',
  'Invoiced',
  'Partially Paid',
  'Paid',
  'Overdue',
] as const;

export const PAYMENT_METHODS = [
  'Bank Transfer / NEFT',
  'Wire Transfer',
  'UPI',
  'Cheque',
  'Credit Card',
  'Other',
] as const;

export function generateInvoiceNumber(phaseNumber: number = 1): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${String(phaseNumber).padStart(2, '0')}-${randomNum}`;
}

const paymentInputSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  project_id: z.string().min(1, 'Project is required'),
  phase_name: z.string().min(1, 'Phase name is required'),
  phase_number: z.coerce.number().min(1).default(1),
  amount: z.coerce.number().min(0, 'Amount must be 0 or greater'),
  currency: z.string().min(1).default('INR'),
  percentage: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(PAYMENT_STATUSES).default('Pending'),
  due_date: z.string().min(1, 'Due date is required'),
  paid_date: z.string().nullable().optional(),
  paid_amount: z.coerce.number().min(0).optional().default(0),
  invoice_number: z.string().optional().default(''),
  payment_method: z.enum(PAYMENT_METHODS).optional().default('Bank Transfer / NEFT'),
  transaction_ref: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

paymentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, project_id, status, search } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (client_id && client_id !== 'ALL') where.client_id = client_id;
    if (project_id && project_id !== 'ALL') where.project_id = project_id;
    if (status && status !== 'ALL') where.status = status;

    let payments = await prisma.clientPayment.findMany({
      where,
      include: {
        client: { select: { id: true, company: true, contact_name: true, email: true } },
        project: { select: { id: true, name: true, budget: true, currency: true, status: true, service_type: true } },
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ phase_number: 'asc' }, { due_date: 'asc' }],
    });

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      payments = payments.filter((p: any) =>
        p.phase_name?.toLowerCase().includes(q) ||
        p.client?.company?.toLowerCase().includes(q) ||
        p.project?.name?.toLowerCase().includes(q) ||
        p.invoice_number?.toLowerCase().includes(q) ||
        p.transaction_ref?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    }

    const now = new Date();
    // Update any pending/invoiced that are past due_date to Overdue dynamically in response
    const enrichedPayments = payments.map((p: any) => {
      let isOverdue = false;
      if (p.status !== 'Paid' && p.due_date) {
        const dueDate = new Date(p.due_date);
        if (dueDate < now && p.status !== 'Overdue') {
          isOverdue = true;
        }
      }
      return {
        ...p,
        is_overdue: isOverdue || p.status === 'Overdue',
      };
    });

    // Summary KPIs
    let total_contract_value = 0;
    let total_collected = 0;
    let total_pending = 0;
    let total_overdue = 0;
    let paid_phases = 0;
    let pending_phases = 0;

    for (const p of enrichedPayments) {
      const amt = Number(p.amount || 0);
      const paid = Number(p.paid_amount || 0);
      total_contract_value += amt;

      if (p.status === 'Paid') {
        total_collected += paid > 0 ? paid : amt;
        paid_phases++;
      } else {
        pending_phases++;
        if (paid > 0) {
          total_collected += paid;
          total_pending += Math.max(0, amt - paid);
        } else {
          total_pending += amt;
        }

        if (p.is_overdue) {
          total_overdue += Math.max(0, amt - paid);
        }
      }
    }

    const collection_rate = total_contract_value > 0
      ? Math.round((total_collected / total_contract_value) * 1000) / 10
      : 0;

    // Group phases by Project for the "Phases by Project" view
    const projectMap = new Map<string, any>();
    for (const p of enrichedPayments) {
      const projId = p.project_id;
      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          project_id: projId,
          project_name: p.project?.name || 'Unnamed Project',
          client_id: p.client_id,
          client_name: p.client?.company || 'Unnamed Client',
          service_type: p.project?.service_type || 'General',
          project_status: p.project?.status || 'Planned',
          project_budget: Number(p.project?.budget || 0),
          currency: p.currency || p.project?.currency || 'INR',
          total_phases_amount: 0,
          total_collected: 0,
          phases: [],
        });
      }
      const group = projectMap.get(projId);
      const amt = Number(p.amount || 0);
      const paid = p.status === 'Paid' ? (Number(p.paid_amount || 0) || amt) : Number(p.paid_amount || 0);
      group.total_phases_amount += amt;
      group.total_collected += paid;
      group.phases.push(p);
    }

    const project_groups = Array.from(projectMap.values()).map((g) => {
      // Sort phases by phase_number
      g.phases.sort((a: any, b: any) => (a.phase_number || 1) - (b.phase_number || 1));
      const targetBudget = g.project_budget > 0 ? g.project_budget : g.total_phases_amount;
      const progress_pct = targetBudget > 0 ? Math.min(100, Math.round((g.total_collected / targetBudget) * 100)) : 0;
      return {
        ...g,
        collection_progress_pct: progress_pct,
      };
    });

    res.json({
      payments: enrichedPayments,
      project_groups,
      summary: {
        total_contract_value,
        total_collected,
        total_pending,
        total_overdue,
        collection_rate,
        total_phases: enrichedPayments.length,
        paid_phases,
        pending_phases,
      },
    });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch client payments' });
  }
});

paymentsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = paymentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }

    const data = parsed.data;
    const client = await prisma.client.findUnique({ where: { id: data.client_id } });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: data.project_id } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Auto-calculate percentage if 0 and project budget exists
    let percentage = data.percentage;
    if (percentage === 0 && project.budget && project.budget > 0) {
      percentage = Math.round((data.amount / project.budget) * 1000) / 10;
    }

    // If marked Paid, auto-fill paid_amount and paid_date if missing
    let paid_date = data.paid_date ? new Date(data.paid_date).toISOString() : null;
    let paid_amount = data.paid_amount || 0;
    if (data.status === 'Paid') {
      if (!paid_date) paid_date = new Date().toISOString();
      if (!paid_amount || paid_amount === 0) paid_amount = data.amount;
    }

    let invoice_number = data.invoice_number?.trim() || '';
    if (!invoice_number && (data.status === 'Paid' || data.status === 'Invoiced')) {
      invoice_number = generateInvoiceNumber(data.phase_number || 1);
    }

    const created = await prisma.clientPayment.create({
      data: {
        client_id: data.client_id,
        project_id: data.project_id,
        phase_name: data.phase_name.trim(),
        phase_number: data.phase_number,
        amount: data.amount,
        currency: data.currency || project.currency || 'INR',
        percentage,
        status: data.status,
        due_date: new Date(data.due_date).toISOString(),
        paid_date,
        paid_amount,
        invoice_number,
        payment_method: data.payment_method || 'Bank Transfer / NEFT',
        transaction_ref: data.transaction_ref?.trim() || '',
        notes: data.notes?.trim() || '',
        created_by: req.user?.id || null,
      },
      include: {
        client: { select: { id: true, company: true, contact_name: true, email: true } },
        project: { select: { id: true, name: true, budget: true, currency: true, status: true } },
        author: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({ payment: created });
  } catch (err) {
    console.error('Error creating payment phase:', err);
    res.status(500).json({ error: 'Failed to create payment phase' });
  }
});

// Get / Generate Full Tax Invoice & Payment Receipt for a payment phase
paymentsRouter.get('/:id/invoice', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    let payment = await prisma.clientPayment.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment phase not found' });
      return;
    }

    // Auto-generate invoice number if missing
    let invoiceNumber = payment.invoice_number?.trim();
    if (!invoiceNumber) {
      invoiceNumber = generateInvoiceNumber(payment.phase_number || 1);
      payment = await prisma.clientPayment.update({
        where: { id },
        data: { invoice_number: invoiceNumber },
        include: {
          client: true,
          project: true,
          author: { select: { id: true, name: true, email: true } },
        },
      });
    }

    const subtotal = Number(payment.amount || 0);
    const isDomesticInr = (payment.currency || 'INR') === 'INR';
    const taxRate = isDomesticInr ? 18 : 0;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const totalAmount = subtotal + taxAmount;
    const paidAmount = Number(payment.paid_amount || 0);
    const balanceDue = payment.status === 'Paid' ? 0 : Math.max(0, totalAmount - paidAmount);

    const invoicePayload = {
      invoice_number: invoiceNumber,
      issue_date: payment.paid_date || payment.created_at || new Date().toISOString(),
      due_date: payment.due_date,
      paid_date: payment.paid_date,
      status: payment.status,
      client: {
        id: payment.client?.id,
        company: payment.client?.company || 'Client Organization',
        contact_name: payment.client?.contact_name || '',
        email: payment.client?.email || '',
        phone: payment.client?.phone || '',
        address: payment.client?.address || 'Corporate Office',
        industry: payment.client?.industry || '',
      },
      project: {
        id: payment.project?.id,
        name: payment.project?.name || 'Client Project',
        service_type: payment.project?.service_type || 'Custom Software & AI Solutions',
        budget: payment.project?.budget,
        currency: payment.currency || 'INR',
      },
      phase: {
        id: payment.id,
        phase_name: payment.phase_name,
        phase_number: payment.phase_number,
        percentage: payment.percentage,
        amount: subtotal,
        currency: payment.currency || 'INR',
      },
      subtotal,
      tax_rate: taxRate,
      cgst_rate: isDomesticInr ? 9 : 0,
      cgst_amount: isDomesticInr ? Math.round(taxAmount / 2) : 0,
      sgst_rate: isDomesticInr ? 9 : 0,
      sgst_amount: isDomesticInr ? Math.round(taxAmount / 2) : 0,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_method: payment.payment_method || 'Bank Transfer / NEFT',
      transaction_ref: payment.transaction_ref || '',
      notes: payment.notes || '',
      company: {
        name: 'NexInt AI Technologies Pvt. Ltd.',
        tagline: 'Enterprise AI & Cloud Infrastructure Solutions',
        address: 'NexInt Tech Park, Level 4, Phase II, OMR IT Corridor, Chennai, TN - 600096, India',
        gstin: '33AABCN8291M1ZP',
        pan: 'AABCN8291M',
        cin: 'U72900TN2024PTC189201',
        email: 'billing@nexint.ai',
        phone: '+91 (044) 4801-9200',
        website: 'https://nexcrm.io',
        bank_details: {
          bank_name: 'HDFC Bank Ltd',
          account_name: 'NexInt AI Technologies Private Limited',
          account_number: '50200084729103',
          ifsc: 'HDFC0001234',
          branch: 'OMR Cyber City, Chennai',
          upi_id: 'nexint.ai@okhdfcbank',
        },
      },
    };

    res.json({ invoice: invoicePayload });
  } catch (err) {
    console.error('Error fetching/generating invoice:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

paymentsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.clientPayment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Payment phase not found' });
      return;
    }

    const parsed = paymentInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }

    const data = parsed.data;
    const updateData: Record<string, any> = {};

    if (data.phase_name !== undefined) updateData.phase_name = data.phase_name.trim();
    if (data.phase_number !== undefined) updateData.phase_number = data.phase_number;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.percentage !== undefined) updateData.percentage = data.percentage;
    if (data.due_date !== undefined) updateData.due_date = new Date(data.due_date).toISOString();
    if (data.invoice_number !== undefined) updateData.invoice_number = data.invoice_number.trim();
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.transaction_ref !== undefined) updateData.transaction_ref = data.transaction_ref.trim();
    if (data.notes !== undefined) updateData.notes = data.notes.trim();

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'Paid') {
        updateData.paid_date = data.paid_date ? new Date(data.paid_date).toISOString() : new Date().toISOString();
        updateData.paid_amount = data.paid_amount !== undefined ? data.paid_amount : (data.amount ?? existing.amount);
        // Automatically generate invoice number if missing when marked as Paid
        if (!updateData.invoice_number && !existing.invoice_number) {
          updateData.invoice_number = generateInvoiceNumber(existing.phase_number || 1);
        }
      } else if (data.status === 'Pending' || data.status === 'Invoiced') {
        if (data.paid_date === null) updateData.paid_date = null;
        if (data.paid_amount !== undefined) updateData.paid_amount = data.paid_amount;
        if (data.status === 'Invoiced' && !updateData.invoice_number && !existing.invoice_number) {
          updateData.invoice_number = generateInvoiceNumber(existing.phase_number || 1);
        }
      }
    } else {
      if (data.paid_date !== undefined) {
        updateData.paid_date = data.paid_date ? new Date(data.paid_date).toISOString() : null;
      }
      if (data.paid_amount !== undefined) updateData.paid_amount = data.paid_amount;
    }

    const updated = await prisma.clientPayment.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, company: true, contact_name: true, email: true } },
        project: { select: { id: true, name: true, budget: true, currency: true, status: true } },
        author: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ payment: updated });
  } catch (err) {
    console.error('Error updating payment phase:', err);
    res.status(500).json({ error: 'Failed to update payment phase' });
  }
});

paymentsRouter.delete('/:id', async (_req: AuthRequest, res: Response) => {
  try {
    const id = String(_req.params.id);
    const existing = await prisma.clientPayment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Payment phase not found' });
      return;
    }

    await prisma.clientPayment.delete({ where: { id } });
    res.json({ success: true, message: 'Payment phase deleted' });
  } catch (err) {
    console.error('Error deleting payment phase:', err);
    res.status(500).json({ error: 'Failed to delete payment phase' });
  }
});

// Auto-generate standard milestone phases for a project
paymentsRouter.post('/generate-phases', async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id,
      template = '4_phases',
      mark_advance_as_paid = false,
    } = req.body as {
      project_id: string;
      template?: string;
      mark_advance_as_paid?: boolean;
    };

    if (!project_id) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { client: true },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const budget = Number(project.budget || 500000);
    const currency = project.currency || 'INR';
    const startDate = project.start_date ? new Date(project.start_date) : new Date();
    const endDate = project.end_date ? new Date(project.end_date) : new Date(startDate.getTime() + 90 * 86400000);
    const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime());

    let templatePhases: Array<{ name: string; pct: number }> = [];

    if (template === '3_phases') {
      templatePhases = [
        { name: 'Phase 1: Advance / Kickoff', pct: 40 },
        { name: 'Phase 2: Milestone Delivery & Beta', pct: 40 },
        { name: 'Phase 3: Final Acceptance & Sign-off', pct: 20 },
      ];
    } else if (template === '5_phases') {
      templatePhases = [
        { name: 'Phase 1: Project Initiation & Scope Sign-off', pct: 20 },
        { name: 'Phase 2: Architecture & UI/UX Approval', pct: 20 },
        { name: 'Phase 3: Core Engineering & Backend Build', pct: 30 },
        { name: 'Phase 4: Client UAT & Security Audit', pct: 20 },
        { name: 'Phase 5: Production Deployment & Handover', pct: 10 },
      ];
    } else {
      // Default 4 phases (25% each)
      templatePhases = [
        { name: 'Phase 1: Project Kickoff & Advance', pct: 25 },
        { name: 'Phase 2: Architecture & Prototype Demo', pct: 25 },
        { name: 'Phase 3: Core Delivery & Client UAT', pct: 25 },
        { name: 'Phase 4: Final Go-Live & Warranty', pct: 25 },
      ];
    }

    const createdPhases = [];
    for (let i = 0; i < templatePhases.length; i++) {
      const t = templatePhases[i];
      const phaseAmount = Math.round((budget * t.pct) / 100);
      const phaseTime = new Date(startDate.getTime() + (totalDuration * (i + 1)) / templatePhases.length);
      const isFirst = i === 0;
      const shouldMarkPaid = isFirst && Boolean(mark_advance_as_paid);

      const p = await prisma.clientPayment.create({
        data: {
          client_id: project.client_id,
          project_id: project.id,
          phase_name: t.name,
          phase_number: i + 1,
          amount: phaseAmount,
          currency,
          percentage: t.pct,
          status: shouldMarkPaid ? 'Paid' : 'Pending',
          due_date: phaseTime.toISOString(),
          paid_date: shouldMarkPaid ? new Date().toISOString() : null,
          paid_amount: shouldMarkPaid ? phaseAmount : 0,
          invoice_number: shouldMarkPaid ? `INV-2026-${Math.floor(1000 + Math.random() * 9000)}` : '',
          payment_method: 'Bank Transfer / NEFT',
          transaction_ref: shouldMarkPaid ? `UTR${Math.floor(10000000 + Math.random() * 90000000)}` : '',
          notes: `Milestone phase (${t.pct}%) for ${project.name}`,
          created_by: req.user?.id || null,
        },
        include: {
          client: { select: { id: true, company: true, contact_name: true, email: true } },
          project: { select: { id: true, name: true, budget: true, currency: true, status: true } },
          author: { select: { id: true, name: true, email: true } },
        },
      });
      createdPhases.push(p);
    }

    res.status(201).json({
      message: `Successfully created ${createdPhases.length} payment phases for "${project.name}"`,
      phases: createdPhases,
    });
  } catch (err) {
    console.error('Error generating payment phases:', err);
    res.status(500).json({ error: 'Failed to generate payment phases' });
  }
});

