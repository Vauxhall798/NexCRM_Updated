import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

interface ResourcePerformance {
  resource_name: string;
  role: string;
  assigned_leads: number;
  converted_leads: number;
  lost_leads: number;
  in_progress_leads: number;
  conversion_rate_pct: number;
  total_deal_value_won: number;
  avg_deal_size: number;
}

// GET /api/reports — Complete executive intelligence & operational analytics
reportsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const period = String(req.query?.period || 'all').toLowerCase(); // 'all' | '30d' | '90d' | '12m'

    // Calculate period start date if filtered
    let periodStartDate: Date | null = null;
    const now = new Date();
    if (period === '30d') {
      periodStartDate = new Date(now.getTime() - 30 * 86400000);
    } else if (period === '90d') {
      periodStartDate = new Date(now.getTime() - 90 * 86400000);
    } else if (period === '12m') {
      periodStartDate = new Date(now.getTime() - 365 * 86400000);
    }

    const [
      allLeads,
      allClients,
      allProjects,
      allPayments,
      allExpenses,
      allConversions,
      allFeedbacks,
      allBauTickets,
      allUsers,
      allResources,
    ] = await Promise.all([
      prisma.lead.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true, role: true } },
          conversion: true,
        },
      }),
      prisma.client.findMany(),
      prisma.project.findMany({
        include: {
          client: { select: { id: true, company: true } },
          manager: { select: { id: true, name: true } },
        },
      }),
      prisma.clientPayment.findMany({
        include: {
          project: { select: { id: true, name: true } },
          client: { select: { id: true, company: true } },
        },
      }),
      prisma.expense.findMany({
        include: {
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.conversion.findMany(),
      prisma.feedback.findMany(),
      prisma.bauTicket.findMany(),
      prisma.user.findMany(),
      prisma.resource.findMany(),
    ]);

    // Apply optional period filtering where created_at / dates are present
    const leads = periodStartDate
      ? allLeads.filter((l: any) => !l.created_at || new Date(l.created_at) >= periodStartDate)
      : allLeads;

    const payments = periodStartDate
      ? allPayments.filter((p: any) => {
          const dt = p.paid_date || p.due_date || p.created_at;
          return !dt || new Date(dt) >= periodStartDate;
        })
      : allPayments;

    const expenses = periodStartDate
      ? allExpenses.filter((e: any) => {
          const dt = e.expense_date || e.created_at;
          return !dt || new Date(dt) >= periodStartDate;
        })
      : allExpenses;

    // 1. FINANCIAL P&L & CASHFLOW
    let totalIncomeReceived = 0;
    let totalReceivablesPending = 0;
    for (const p of payments) {
      const amt = Number(p.amount || 0);
      const paidAmt = Number(p.paid_amount || 0);
      if (p.status === 'Paid') {
        totalIncomeReceived += paidAmt > 0 ? paidAmt : amt;
      } else if (p.status !== 'Cancelled') {
        totalReceivablesPending += amt;
      }
    }

    let totalExpensesMade = 0; // Paid expenses
    let totalExpensesPending = 0; // Pending or scheduled
    let overheadExpenses = 0;
    let projectLinkedExpenses = 0;
    const expenseCategoryMap: Record<
      string,
      { total: number; paid: number; pending: number; count: number }
    > = {};

    for (const e of expenses) {
      const amt = Number(e.amount || 0);
      const cat = e.category || 'Miscellaneous';
      if (!expenseCategoryMap[cat]) {
        expenseCategoryMap[cat] = { total: 0, paid: 0, pending: 0, count: 0 };
      }
      expenseCategoryMap[cat].total += amt;
      expenseCategoryMap[cat].count += 1;

      if (e.status === 'Paid') {
        totalExpensesMade += amt;
        expenseCategoryMap[cat].paid += amt;
        if (!e.project_id) overheadExpenses += amt;
        else projectLinkedExpenses += amt;
      } else if (e.status !== 'Cancelled') {
        totalExpensesPending += amt;
        expenseCategoryMap[cat].pending += amt;
      }
    }

    const netProfit = totalIncomeReceived - totalExpensesMade;
    const netMarginPct =
      totalIncomeReceived > 0
        ? Math.round(((totalIncomeReceived - totalExpensesMade) / totalIncomeReceived) * 1000) / 10
        : 0;

    const expenseCategoryBreakdown = Object.entries(expenseCategoryMap).map(([category, stats]) => ({
      category,
      total_amount: stats.total,
      paid_amount: stats.paid,
      pending_amount: stats.pending,
      count: stats.count,
      share_pct:
        totalExpensesMade > 0 ? Math.round((stats.paid / totalExpensesMade) * 1000) / 10 : 0,
    })).sort((a, b) => b.total_amount - a.total_amount);

    // 2. LEAD CONVERSION & RESOURCE PERFORMANCE
    const totalLeadsCount = leads.length;
    const convertedLeads = leads.filter((l: any) => l.status === 'Converted');
    const convertedLeadsCount = convertedLeads.length;
    const lostLeads = leads.filter((l: any) => l.status === 'Not converted');
    const lostLeadsCount = lostLeads.length;
    const inPipelineCount = totalLeadsCount - convertedLeadsCount - lostLeadsCount;
    const conversionRatePct =
      totalLeadsCount > 0 ? Math.round((convertedLeadsCount / totalLeadsCount) * 1000) / 10 : 0;

    let totalDealValueConverted = 0;
    for (const cl of convertedLeads) {
      const dealVal = cl.conversion?.deal_value
        ? Number(cl.conversion.deal_value)
        : Number(cl.budget || 0);
      totalDealValueConverted += dealVal;
    }

    // Lead Converted by Resources Leaderboard
    const resourceMap: Record<
      string,
      {
        resource_name: string;
        role: string;
        assigned_leads: number;
        converted_leads: number;
        lost_leads: number;
        in_progress_leads: number;
        total_deal_value_won: number;
      }
    > = {};

    // Populate team roster from Users and Resources
    for (const u of allUsers) {
      const name = u.name?.trim();
      if (name && !resourceMap[name]) {
        resourceMap[name] = {
          resource_name: name,
          role: u.role === 'ADMIN' ? 'Admin / Lead Exec' : 'Sales / Account Rep',
          assigned_leads: 0,
          converted_leads: 0,
          lost_leads: 0,
          in_progress_leads: 0,
          total_deal_value_won: 0,
        };
      }
    }

    for (const r of allResources) {
      const name = r.name?.trim();
      if (name && !resourceMap[name]) {
        resourceMap[name] = {
          resource_name: name,
          role: `${r.seniority || 'Consultant'} (${r.department || 'Delivery'})`,
          assigned_leads: 0,
          converted_leads: 0,
          lost_leads: 0,
          in_progress_leads: 0,
          total_deal_value_won: 0,
        };
      }
    }

    // Tally leads by resource
    for (const l of leads) {
      const resourceKey =
        l.followup_resource?.trim() ||
        l.owner?.name?.trim() ||
        'Unassigned Team';

      if (!resourceMap[resourceKey]) {
        resourceMap[resourceKey] = {
          resource_name: resourceKey,
          role: 'Account Representative',
          assigned_leads: 0,
          converted_leads: 0,
          lost_leads: 0,
          in_progress_leads: 0,
          total_deal_value_won: 0,
        };
      }

      const entry = resourceMap[resourceKey];
      entry.assigned_leads += 1;

      if (l.status === 'Converted') {
        entry.converted_leads += 1;
        const dealVal = l.conversion?.deal_value
          ? Number(l.conversion.deal_value)
          : Number(l.budget || 0);
        entry.total_deal_value_won += dealVal;
      } else if (l.status === 'Not converted') {
        entry.lost_leads += 1;
      } else {
        entry.in_progress_leads += 1;
      }
    }

    const resourcePerformance: ResourcePerformance[] = Object.values(resourceMap)
      .map((r) => {
        const rate =
          r.assigned_leads > 0
            ? Math.round((r.converted_leads / r.assigned_leads) * 1000) / 10
            : 0;
        const avgDeal =
          r.converted_leads > 0
            ? Math.round(r.total_deal_value_won / r.converted_leads)
            : 0;
        return {
          ...r,
          conversion_rate_pct: rate,
          avg_deal_size: avgDeal,
        };
      })
      // Show resources with converted leads or active assignments first
      .sort((a, b) => {
        if (b.converted_leads !== a.converted_leads) return b.converted_leads - a.converted_leads;
        if (b.total_deal_value_won !== a.total_deal_value_won) return b.total_deal_value_won - a.total_deal_value_won;
        return b.assigned_leads - a.assigned_leads;
      });

    // 3. LEAD SOURCES & SERVICE TYPES DISTRIBUTION
    const sourceMap: Record<string, { total: number; converted: number; value: number }> = {};
    const serviceMap: Record<string, { total: number; converted: number; value: number }> = {};

    for (const l of leads) {
      const src = l.source || 'Other';
      if (!sourceMap[src]) sourceMap[src] = { total: 0, converted: 0, value: 0 };
      sourceMap[src].total += 1;

      const srv = l.service_type || 'Others';
      if (!serviceMap[srv]) serviceMap[srv] = { total: 0, converted: 0, value: 0 };
      serviceMap[srv].total += 1;

      const amt = Number(l.budget || 0);
      if (l.status === 'Converted') {
        sourceMap[src].converted += 1;
        sourceMap[src].value += amt;
        serviceMap[srv].converted += 1;
        serviceMap[srv].value += amt;
      }
    }

    const leadSourcesReport = Object.entries(sourceMap).map(([source, s]) => ({
      source,
      total_leads: s.total,
      converted_count: s.converted,
      conversion_rate_pct: s.total > 0 ? Math.round((s.converted / s.total) * 1000) / 10 : 0,
      total_value_won: s.value,
    })).sort((a, b) => b.total_leads - a.total_leads);

    const serviceTypesReport = Object.entries(serviceMap).map(([service_type, s]) => ({
      service_type,
      total_leads: s.total,
      converted_count: s.converted,
      conversion_rate_pct: s.total > 0 ? Math.round((s.converted / s.total) * 1000) / 10 : 0,
      total_value_won: s.value,
    })).sort((a, b) => b.total_leads - a.total_leads);

    // Lost Reasons Analysis
    const lostReasonMap: Record<string, number> = {};
    for (const c of allConversions) {
      if (c.outcome === 'not_converted' && c.reason) {
        lostReasonMap[c.reason] = (lostReasonMap[c.reason] || 0) + 1;
      }
    }
    const totalLostWithReason = Object.values(lostReasonMap).reduce((acc, v) => acc + v, 0);
    const lostReasonsReport = Object.entries(lostReasonMap).map(([reason, count]) => ({
      reason,
      count,
      pct: totalLostWithReason > 0 ? Math.round((count / totalLostWithReason) * 1000) / 10 : 0,
    })).sort((a, b) => b.count - a.count);

    // 4. PROJECTS & AMC RECURRING REVENUE
    const totalProjects = allProjects.length;
    const activeProjects = allProjects.filter((p: any) => p.status === 'In progress' || p.status === 'Planned').length;
    const completedProjects = allProjects.filter((p: any) => p.status === 'Completed').length;
    const onHoldProjects = allProjects.filter((p: any) => p.status === 'On hold').length;

    let totalContractValue = 0;
    let amcActiveCount = 0;
    let amcAnnualRecurringRevenue = 0;
    let amcExpiringSoonCount = 0;
    const amcTierMap: Record<string, { count: number; arr: number }> = {};

    const nowTime = now.getTime();
    const sixtyDaysLater = nowTime + 60 * 86400000;

    for (const p of allProjects) {
      totalContractValue += Number(p.budget || 0);

      const isAmcActive = Boolean(p.amc_active) || p.amc_status === 'Active';
      if (isAmcActive) {
        amcActiveCount += 1;
        const amcAmt = Number(p.amc_amount || 0);
        amcAnnualRecurringRevenue += amcAmt;

        const tier = p.amc_sla_tier || 'Standard 9x5';
        if (!amcTierMap[tier]) amcTierMap[tier] = { count: 0, arr: 0 };
        amcTierMap[tier].count += 1;
        amcTierMap[tier].arr += amcAmt;

        if (p.amc_end_date) {
          const endT = new Date(p.amc_end_date).getTime();
          if (endT >= nowTime && endT <= sixtyDaysLater) {
            amcExpiringSoonCount += 1;
          }
        }
      }
    }

    const amcTiersReport = Object.entries(amcTierMap).map(([tier, s]) => ({
      tier,
      active_contracts: s.count,
      annual_revenue: s.arr,
    }));

    // 5. CLIENT SATISFACTION (CSAT) & BAU QUALITY
    const feedbackCount = allFeedbacks.length;
    let totalRatingSum = 0;
    let positiveSentiment = 0;
    let constructiveSentiment = 0;
    let criticalSentiment = 0;

    for (const f of allFeedbacks) {
      totalRatingSum += Number(f.rating || 5);
      if (f.sentiment === 'Positive') positiveSentiment += 1;
      else if (f.sentiment === 'Constructive') constructiveSentiment += 1;
      else if (f.sentiment === 'Critical') criticalSentiment += 1;
    }

    const avgCsatRating =
      feedbackCount > 0 ? Math.round((totalRatingSum / feedbackCount) * 10) / 10 : 5.0;

    const bauTotalTickets = allBauTickets.length;
    const bauResolvedTickets = allBauTickets.filter((t: any) => t.state === 'Resolved').length;
    const bauResolutionRatePct =
      bauTotalTickets > 0 ? Math.round((bauResolvedTickets / bauTotalTickets) * 1000) / 10 : 100;

    // 6. 6-MONTH MONTHLY CASHFLOW & CONVERSION TREND
    const monthsTrend: Array<{
      month_key: string;
      label: string;
      income: number;
      expenses: number;
      net_profit: number;
      leads_converted: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const nextMonth = new Date(year, month + 1, 1);
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      // Income in month
      const monthIncome = allPayments
        .filter((p: any) => {
          if (p.status !== 'Paid') return false;
          const dt = p.paid_date ? new Date(p.paid_date) : new Date(p.created_at || 0);
          return dt >= d && dt < nextMonth;
        })
        .reduce((sum: number, p: any) => sum + Number(p.paid_amount || p.amount || 0), 0);

      // Expenses in month
      const monthExpenses = allExpenses
        .filter((e: any) => {
          if (e.status !== 'Paid') return false;
          const dt = e.expense_date ? new Date(e.expense_date) : new Date(e.created_at || 0);
          return dt >= d && dt < nextMonth;
        })
        .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

      // Leads converted in month
      const monthConversions = allLeads.filter((l: any) => {
        if (l.status !== 'Converted') return false;
        const dt = l.conversion?.decided_at
          ? new Date(l.conversion.decided_at)
          : new Date(l.created_at || 0);
        return dt >= d && dt < nextMonth;
      }).length;

      monthsTrend.push({
        month_key: monthKey,
        label,
        income: monthIncome,
        expenses: monthExpenses,
        net_profit: monthIncome - monthExpenses,
        leads_converted: monthConversions,
      });
    }

    res.json({
      period,
      financials: {
        total_income_received: totalIncomeReceived,
        total_receivables_pending: totalReceivablesPending,
        total_expenses_made: totalExpensesMade,
        total_expenses_pending: totalExpensesPending,
        net_profit: netProfit,
        net_margin_pct: netMarginPct,
        overhead_expenses: overheadExpenses,
        project_linked_expenses: projectLinkedExpenses,
        total_contract_value: totalContractValue,
      },
      conversions: {
        total_leads_count: totalLeadsCount,
        converted_leads_count: convertedLeadsCount,
        conversion_rate_pct: conversionRatePct,
        lost_leads_count: lostLeadsCount,
        in_pipeline_count: inPipelineCount,
        total_deal_value_converted: totalDealValueConverted,
      },
      resources_leaderboard: resourcePerformance,
      expense_categories: expenseCategoryBreakdown,
      lead_sources: leadSourcesReport,
      service_types: serviceTypesReport,
      lost_reasons: lostReasonsReport,
      projects_and_amc: {
        total_projects: totalProjects,
        active_projects: activeProjects,
        completed_projects: completedProjects,
        on_hold_projects: onHoldProjects,
        total_contract_value: totalContractValue,
        amc_active_count: amcActiveCount,
        amc_annual_recurring_revenue: amcAnnualRecurringRevenue,
        amc_expiring_soon_count: amcExpiringSoonCount,
        amc_tiers: amcTiersReport,
      },
      csat_and_quality: {
        avg_csat_rating: avgCsatRating,
        feedback_count: feedbackCount,
        sentiment: {
          positive: positiveSentiment,
          constructive: constructiveSentiment,
          critical: criticalSentiment,
        },
        bau_tickets: {
          total: bauTotalTickets,
          resolved: bauResolvedTickets,
          resolution_rate_pct: bauResolutionRatePct,
        },
      },
      monthly_trend: monthsTrend,
    });
  } catch (err: any) {
    console.error('Error generating executive reports:', err);
    res.status(500).json({ error: err?.message || 'Failed to generate executive reports' });
  }
});
