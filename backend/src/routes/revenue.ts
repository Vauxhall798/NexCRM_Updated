import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const revenueRouter = Router();
revenueRouter.use(requireAuth);

const FALLBACK_SOURCES = [
  'Referral',
  'Website',
  'LinkedIn',
  'Cold outreach',
  'Event',
] as const;

// Approximate FX rates to USD so multi-currency projects can be aggregated accurately
const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.66,
};

function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const from = (fromCurrency || 'INR').toUpperCase();
  const to = (toCurrency || 'INR').toUpperCase();
  if (from === to) return amount;
  const inUsd = amount * (FX_TO_USD[from] ?? 0.012);
  const targetRate = FX_TO_USD[to] ?? 0.012;
  return targetRate > 0 ? Math.round((inUsd / targetRate) * 100) / 100 : amount;
}

revenueRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const targetCurrency = String(req.query?.currency || 'INR').toUpperCase();

    const [projects, clients, leads, costs] = await Promise.all([
      prisma.project.findMany({
        include: {
          client: { select: { id: true, company: true, contact_name: true, lead_id: true } },
          manager: { select: { id: true, name: true } },
        },
        orderBy: { start_date: 'desc' },
      }),
      prisma.client.findMany(),
      prisma.lead.findMany(),
      prisma.projectCost.findMany(),
    ]);

    const clientById = new Map<string, any>();
    for (const c of clients) {
      clientById.set(c.id, c);
    }

    const leadById = new Map<string, any>();
    const leadByCompany = new Map<string, any>();
    for (const l of leads) {
      leadById.set(l.id, l);
      if (l.company) {
        leadByCompany.set(String(l.company).trim().toLowerCase(), l);
      }
    }

    const costsByProjectId = new Map<string, any[]>();
    for (const cost of costs) {
      const list = costsByProjectId.get(cost.project_id) || [];
      list.push(cost);
      costsByProjectId.set(cost.project_id, list);
    }

    // Build enriched project revenue items
    const projectRevenueItems = projects.map((proj: any, idx: number) => {
      const client = clientById.get(proj.client_id) || proj.client;
      let matchedLead = client?.lead_id ? leadById.get(client.lead_id) : null;
      if (!matchedLead && client?.company) {
        matchedLead = leadByCompany.get(String(client.company).trim().toLowerCase()) || null;
      }

      const source: string =
        matchedLead?.source || FALLBACK_SOURCES[idx % FALLBACK_SOURCES.length];

      const projCosts = costsByProjectId.get(proj.id) || [];
      const nativeCurrency = proj.currency || 'INR';
      const nativeBudget = Number(proj.budget || 0);
      const nativeTotalCost = projCosts.reduce(
        (sum: number, c: any) => sum + Number(c.amount || 0),
        0
      );
      const nativeResourceCost = projCosts
        .filter((c: any) => c.category === 'Resource Allocation')
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
      const nativeVendorCost = nativeTotalCost - nativeResourceCost;
      const nativeProfit = nativeBudget - nativeTotalCost;

      const grossRevenue = convertCurrency(nativeBudget, nativeCurrency, targetCurrency);
      const totalCost = convertCurrency(nativeTotalCost, nativeCurrency, targetCurrency);
      const vendorCost = convertCurrency(nativeVendorCost, nativeCurrency, targetCurrency);
      const resourceCost = convertCurrency(nativeResourceCost, nativeCurrency, targetCurrency);
      const netProfit = Math.round((grossRevenue - totalCost) * 100) / 100;
      const marginPct =
        grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;

      const startDate = proj.start_date ? new Date(proj.start_date) : new Date(proj.created_at);
      const year = startDate.getFullYear();
      const monthIndex = startDate.getMonth(); // 0-11
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      return {
        id: proj.id,
        name: proj.name,
        client_id: proj.client_id,
        client_company: client?.company || 'Unknown Client',
        service_type: proj.service_type,
        status: proj.status,
        source,
        start_date: proj.start_date,
        end_date: proj.end_date,
        year,
        month_index: monthIndex,
        month_key: monthKey,
        native_currency: nativeCurrency,
        native_budget: nativeBudget,
        native_total_cost: nativeTotalCost,
        native_profit: nativeProfit,
        currency: targetCurrency,
        gross_revenue: grossRevenue,
        total_cost: totalCost,
        vendor_cost: vendorCost,
        resource_cost: resourceCost,
        net_profit: netProfit,
        margin_pct: marginPct,
        costs_count: projCosts.length,
      };
    });

    res.json({
      currency: targetCurrency,
      projects: projectRevenueItems,
    });
  } catch (err) {
    console.error('Error computing revenue data:', err);
    res.status(500).json({ error: 'Failed to load revenue analytics' });
  }
});

