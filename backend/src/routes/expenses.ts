import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { z } from '../lib/validator.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

const expenseInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().default('Cloud & Hosting'),
  amount: z.coerce.number().min(0, 'Amount must be non-negative'),
  currency: z.string().default('INR'),
  expense_date: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Scheduled', 'Cancelled']).default('Paid'),
  payment_method: z.string().default('Bank Transfer / NEFT'),
  vendor: z.string().optional().default(''),
  invoice_number: z.string().optional().default(''),
  receipt_url: z.string().optional().default(''),
  project_id: z.string().nullable().optional(),
  paid_by: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// GET /api/expenses — List and filter expenses with comprehensive aggregation metrics
expensesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const category = String(req.query?.category || 'ALL');
    const status = String(req.query?.status || 'ALL');
    const projectId = String(req.query?.project_id || 'ALL');

    const allExpenses = await prisma.expense.findMany({
      include: {
        project: { select: { id: true, name: true, currency: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { expense_date: 'desc' },
    });

    let filtered = allExpenses;

    if (search) {
      filtered = filtered.filter(
        (e: any) =>
          e.title?.toLowerCase().includes(search) ||
          e.vendor?.toLowerCase().includes(search) ||
          e.invoice_number?.toLowerCase().includes(search) ||
          e.notes?.toLowerCase().includes(search) ||
          e.paid_by?.toLowerCase().includes(search)
      );
    }

    if (category !== 'ALL') {
      filtered = filtered.filter((e: any) => e.category === category);
    }

    if (status !== 'ALL') {
      filtered = filtered.filter((e: any) => e.status === status);
    }

    if (projectId === 'OVERHEAD') {
      filtered = filtered.filter((e: any) => !e.project_id);
    } else if (projectId !== 'ALL') {
      filtered = filtered.filter((e: any) => e.project_id === projectId);
    }

    // Compute Summary Stats across the entire expense portfolio
    let totalExpenses = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalScheduled = 0;
    let overheadTotal = 0;
    let projectLinkedTotal = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const exp of allExpenses) {
      const amt = Number(exp.amount || 0);
      totalExpenses += amt;
      if (exp.status === 'Paid') totalPaid += amt;
      else if (exp.status === 'Pending') totalPending += amt;
      else if (exp.status === 'Scheduled') totalScheduled += amt;

      if (!exp.project_id) {
        overheadTotal += amt;
      } else {
        projectLinkedTotal += amt;
      }

      const cat = exp.category || 'Miscellaneous';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
    }

    let topCategory: { category: string; amount: number } | null = null;
    for (const [cat, amt] of Object.entries(categoryBreakdown)) {
      if (!topCategory || amt > topCategory.amount) {
        topCategory = { category: cat, amount: amt };
      }
    }

    res.json({
      expenses: filtered,
      total_count: filtered.length,
      summary: {
        total_expenses: totalExpenses,
        total_paid: totalPaid,
        total_pending: totalPending,
        total_scheduled: totalScheduled,
        overhead_total: overheadTotal,
        project_linked_total: projectLinkedTotal,
        category_breakdown: categoryBreakdown,
        top_category: topCategory,
      },
    });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Failed to fetch company expenses' });
  }
});

// POST /api/expenses — Record a new company expenditure
expensesRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = expenseInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Validation error' });
      return;
    }
    const parsed = parseResult.data;
    let expenseDate = new Date().toISOString();
    if (parsed.expense_date) {
      const d = new Date(parsed.expense_date);
      if (!isNaN(d.getTime())) {
        expenseDate = d.toISOString();
      }
    }

    const created = await prisma.expense.create({
      data: {
        title: parsed.title.trim(),
        category: parsed.category,
        amount: parsed.amount,
        currency: parsed.currency || 'INR',
        expense_date: expenseDate,
        status: parsed.status,
        payment_method: parsed.payment_method,
        vendor: parsed.vendor?.trim() || '',
        invoice_number: parsed.invoice_number?.trim() || '',
        receipt_url: parsed.receipt_url?.trim() || '',
        project_id: parsed.project_id || null,
        paid_by: parsed.paid_by?.trim() || req.user?.name || '',
        notes: parsed.notes?.trim() || '',
        created_by: req.user?.id || null,
      },
      include: {
        project: { select: { id: true, name: true, currency: true } },
        author: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ expense: created, message: 'Expense recorded successfully' });
  } catch (err: any) {
    console.error('Error creating expense:', err);
    res.status(500).json({ error: err?.message || 'Failed to record expense' });
  }
});

// PUT /api/expenses/:id — Update an existing expense
expensesRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense record not found' });
      return;
    }

    const parseResult = expenseInputSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Validation error' });
      return;
    }
    const parsed = parseResult.data;
    const updateData: Record<string, any> = {};

    if (parsed.title !== undefined) updateData.title = parsed.title.trim();
    if (parsed.category !== undefined) updateData.category = parsed.category;
    if (parsed.amount !== undefined) updateData.amount = parsed.amount;
    if (parsed.currency !== undefined) updateData.currency = parsed.currency;
    if (parsed.expense_date !== undefined) {
      const d = parsed.expense_date ? new Date(parsed.expense_date) : null;
      updateData.expense_date = d && !isNaN(d.getTime()) ? d.toISOString() : existing.expense_date;
    }
    if (parsed.status !== undefined) updateData.status = parsed.status;
    if (parsed.payment_method !== undefined) updateData.payment_method = parsed.payment_method;
    if (parsed.vendor !== undefined) updateData.vendor = parsed.vendor.trim();
    if (parsed.invoice_number !== undefined) updateData.invoice_number = parsed.invoice_number.trim();
    if (parsed.receipt_url !== undefined) updateData.receipt_url = parsed.receipt_url.trim();
    if (parsed.project_id !== undefined) updateData.project_id = parsed.project_id || null;
    if (parsed.paid_by !== undefined) updateData.paid_by = parsed.paid_by.trim();
    if (parsed.notes !== undefined) updateData.notes = parsed.notes.trim();

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, currency: true } },
        author: { select: { id: true, name: true } },
      },
    });

    res.json({ expense: updated, message: 'Expense updated successfully' });
  } catch (err: any) {
    console.error('Error updating expense:', err);
    res.status(500).json({ error: err?.message || 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id — Delete an expense record
expensesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense record not found' });
      return;
    }

    await prisma.expense.delete({ where: { id } });
    res.json({ message: 'Expense deleted successfully', id });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});
