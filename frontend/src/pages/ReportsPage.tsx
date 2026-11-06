import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Users,
  Award,
  Download,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Star,
  LifeBuoy,
  Briefcase,
  Layers,
  ArrowUpRight,
  FolderKanban,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { ExecutiveReportData, NavTab, ResourcePerformanceItem } from '../types/crm';
import { formatCurrency, exportToCsv } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

interface ReportsPageProps {
  onNavigate?: (tab: NavTab, contextId?: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<ExecutiveReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'all' | '30d' | '90d' | '12m'>('all');
  const [resourceSearch, setResourceSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async (selectedPeriod = period) => {
    try {
      setRefreshing(true);
      const res = await apiFetch<ExecutiveReportData>(`/reports?period=${selectedPeriod}`);
      setData(res);
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch executive reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports(period);
  }, [period]);

  const filteredResources = useMemo(() => {
    if (!data?.resources_leaderboard) return [];
    if (!resourceSearch.trim()) return data.resources_leaderboard;
    const q = resourceSearch.toLowerCase().trim();
    return data.resources_leaderboard.filter(
      (r) =>
        r.resource_name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
    );
  }, [data, resourceSearch]);

  const handleExportFullReport = () => {
    if (!data) return;

    // Export Resource Leaderboard CSV
    const rows = data.resources_leaderboard.map((r, idx) => ({
      Rank: idx + 1,
      'Resource Name': r.resource_name,
      Role: r.role,
      'Assigned Leads': r.assigned_leads,
      'Converted Leads': r.converted_leads,
      'Lost Leads': r.lost_leads,
      'In Pipeline': r.in_progress_leads,
      'Conversion Rate (%)': `${r.conversion_rate_pct}%`,
      'Total Revenue Won (INR)': r.total_deal_value_won,
      'Avg Deal Size (INR)': r.avg_deal_size,
    }));

    exportToCsv(`NexCRM_Resource_Performance_${period}_${new Date().toISOString().split('T')[0]}.csv`, rows);
    showToast('Exported Resource Conversion Performance Report!');
  };

  const handleExportFinancials = () => {
    if (!data) return;
    const f = data.financials;
    const rows = [
      { Metric: 'Total Income Received (Settled)', 'Amount (INR)': f.total_income_received },
      { Metric: 'Receivables Pending / Scheduled', 'Amount (INR)': f.total_receivables_pending },
      { Metric: 'Total Expenses Made (Paid)', 'Amount (INR)': f.total_expenses_made },
      { Metric: 'Expenses Pending / Scheduled', 'Amount (INR)': f.total_expenses_pending },
      { Metric: 'Net Operating Profit', 'Amount (INR)': f.net_profit },
      { Metric: 'Net Operating Margin (%)', 'Amount (INR)': `${f.net_margin_pct}%` },
      { Metric: 'General Company Overhead Expenses', 'Amount (INR)': f.overhead_expenses },
      { Metric: 'Direct Project-Linked Expenses', 'Amount (INR)': f.project_linked_expenses },
      { Metric: 'Total Active Projects Budget', 'Amount (INR)': f.total_contract_value },
      { Metric: 'Annual Maintenance Recurring Revenue (ARR)', 'Amount (INR)': data.projects_and_amc.amc_annual_recurring_revenue },
    ];
    exportToCsv(`NexCRM_Financial_PL_Summary_${new Date().toISOString().split('T')[0]}.csv`, rows);
    showToast('Exported Financial P&L Report!');
  };

  const handleExportSupportReport = () => {
    if (!data?.support_and_resolution) return;
    const sup = data.support_and_resolution;
    const rows = [
      { Metric: 'Total Support Tickets Received', Value: sup.total_received },
      { Metric: 'Total Support Tickets Resolved', Value: sup.total_resolved },
      { Metric: 'Overall Resolution Rate', Value: `${sup.resolution_rate_pct}%` },
      { Metric: 'Average Time to Resolve', Value: sup.avg_resolution_time_formatted },
      { Metric: 'Fastest Ticket Resolution', Value: sup.fastest_resolution_formatted },
      { Metric: 'Longest Ticket Resolution', Value: sup.longest_resolution_formatted },
      { Metric: 'SLA Adherence Rate', Value: `${sup.sla_adherence_rate_pct}%` },
      { Metric: 'Tickets Resolved Within SLA', Value: sup.within_sla_count },
      { Metric: 'Tickets Breaching SLA', Value: sup.breached_sla_count },
      ...sup.priority_breakdown.map((p) => ({
        Metric: `${p.priority} Priority - Resolved / Received`,
        Value: `${p.resolved} / ${p.total} (${p.resolution_rate_pct}%) — Avg Turnaround: ${p.avg_resolution_formatted} (Target SLA: ${p.sla_target})`,
      })),
      ...sup.category_breakdown.map((cat) => ({
        Metric: `Category: ${cat.category}`,
        Value: `${cat.resolved} / ${cat.total} resolved — Avg Turnaround: ${cat.avg_resolution_formatted}`,
      })),
    ];
    exportToCsv(`NexCRM_Support_Tickets_Resolution_Report_${new Date().toISOString().split('T')[0]}.csv`, rows);
    showToast('Exported Support Tickets & Resolution Report!');
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Synthesizing executive analytics and financial reports...</p>
      </div>
    );
  }

  const f = data?.financials || {
    total_income_received: 0,
    total_receivables_pending: 0,
    total_expenses_made: 0,
    total_expenses_pending: 0,
    net_profit: 0,
    net_margin_pct: 0,
    overhead_expenses: 0,
    project_linked_expenses: 0,
    total_contract_value: 0,
  };

  const c = data?.conversions || {
    total_leads_count: 0,
    converted_leads_count: 0,
    conversion_rate_pct: 0,
    lost_leads_count: 0,
    in_pipeline_count: 0,
    total_deal_value_converted: 0,
  };

  const isProfitPositive = f.net_profit >= 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Executive Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Executive Reports &amp; Analytics
              </h2>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Period Selector Tabs */}
          <div className="flex p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: '30d', label: 'Past 30D' },
                { id: '90d', label: 'Past 90D' },
                { id: '12m', label: 'Past 12M' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchReports(period)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportFullReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Print Report</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PRIMARY FINANCIAL & CONVERSION METRICS RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total Income Received */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Income Received</span>
            <span className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(f.total_income_received)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Pending:</span>
            <strong className="text-amber-600 dark:text-amber-400">
              {formatCurrency(f.total_receivables_pending)}
            </strong>
          </div>
        </div>

        {/* Total Expenses Made */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Expenses Made</span>
            <span className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Receipt className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-rose-600 dark:text-rose-400">
            {formatCurrency(f.total_expenses_made)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Overhead: <strong>{formatCurrency(f.overhead_expenses)}</strong>
          </div>
        </div>

        {/* Net Operating Profit */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Net Profit (P&amp;L)</span>
            <span
              className={`p-1 rounded-lg ${
                isProfitPositive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isProfitPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </span>
          </div>
          <div
            className={`mt-2 text-xl font-black ${
              isProfitPositive ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(f.net_profit)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            <span
              className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                isProfitPositive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              {f.net_margin_pct}% margin
            </span>
          </div>
        </div>

        {/* Converted Leads Count */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Converted Leads</span>
            <span className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5">
            <span>{c.converted_leads_count}</span>
            <span className="text-xs font-semibold text-slate-400">/ {c.total_leads_count} total</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Won: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(c.total_deal_value_converted)}</strong>
          </div>
        </div>

        {/* AMC Annual Recurring Revenue */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>AMC Annual (ARR)</span>
            <span className="p-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-purple-600 dark:text-purple-400">
            {formatCurrency(data?.projects_and_amc.amc_annual_recurring_revenue || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <strong>{data?.projects_and_amc.amc_active_count || 0}</strong> active contracts
          </div>
        </div>

        {/* Client CSAT & Resolution */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Support &amp; Resolution</span>
            <span className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <LifeBuoy className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400">
              {data?.support_and_resolution?.total_resolved || 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              / {data?.support_and_resolution?.total_received || 0} resolved
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Avg: <strong className="text-indigo-600 dark:text-indigo-400">{data?.support_and_resolution?.avg_resolution_time_formatted || '< 4 hrs'}</strong>
            </span>
            <span className="font-bold text-emerald-600">
              {data?.support_and_resolution?.resolution_rate_pct || 100}%
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: TOTAL LEADS CONVERTED BY OUR RESOURCES (LEADERBOARD) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Award className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Resource Conversion Performance &amp; Won Revenue
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                placeholder="Search resource or role..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {filteredResources.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No resources found matching &quot;{resourceSearch}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 w-12 text-center">Rank</th>
                  <th className="py-3 px-3.5">Resource / Rep</th>
                  <th className="py-3 px-3.5">Role</th>
                  <th className="py-3 px-3 text-center">Assigned</th>
                  <th className="py-3 px-3 text-center text-emerald-600 font-bold">Converted</th>
                  <th className="py-3 px-3 text-center text-rose-500">Lost</th>
                  <th className="py-3 px-3 text-center text-amber-500">In Pipeline</th>
                  <th className="py-3 px-3.5 w-36">Conversion Rate</th>
                  <th className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                    Won Value (₹)
                  </th>
                  <th className="py-3 px-3.5 text-right">Avg Deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredResources.map((res: ResourcePerformanceItem, idx: number) => {
                  const isTopRank = idx === 0 && res.converted_leads > 0;
                  return (
                    <tr
                      key={res.resource_name}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 text-center">
                        {isTopRank ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold text-[11px] shadow-2xs">
                            🥇
                          </span>
                        ) : idx === 1 && res.converted_leads > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px]">
                            🥈
                          </span>
                        ) : idx === 2 && res.converted_leads > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold text-[11px]">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-slate-100">
                        {res.resource_name}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400">
                        {res.role}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {res.assigned_leads}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                        {res.converted_leads}
                      </td>
                      <td className="py-3 px-3 text-center text-rose-500 font-medium">
                        {res.lost_leads}
                      </td>
                      <td className="py-3 px-3 text-center text-amber-600 dark:text-amber-400 font-medium">
                        {res.in_progress_leads}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className={res.conversion_rate_pct >= 50 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}>
                              {res.conversion_rate_pct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                res.conversion_rate_pct >= 60
                                  ? 'bg-emerald-500'
                                  : res.conversion_rate_pct >= 30
                                  ? 'bg-indigo-500'
                                  : 'bg-amber-400'
                              }`}
                              style={{ width: `${Math.min(res.conversion_rate_pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right font-black text-indigo-950 dark:text-indigo-300">
                        {formatCurrency(res.total_deal_value_won)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-slate-600 dark:text-slate-400">
                        {res.converted_leads > 0 ? formatCurrency(res.avg_deal_size) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: 6-MONTH MONTHLY CASHFLOW & CONVERSION TRAJECTORY */}
      {data?.monthly_trend && data.monthly_trend.length > 0 && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Monthly Financial Performance &amp; Conversion Trajectory
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">Income (₹)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-400">Expenses (₹)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.monthly_trend.map((m) => {
              const profit = m.net_profit;
              const isMonthProfitable = profit >= 0;
              return (
                <div
                  key={m.month_key}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>{m.label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      {m.leads_converted} converted
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="text-[11px] text-slate-500">In:</span>
                      <span>{formatCurrency(m.income)}</span>
                    </div>
                    <div className="flex justify-between text-rose-500 dark:text-rose-400">
                      <span className="text-[11px] text-slate-500">Out:</span>
                      <span>{formatCurrency(m.expenses)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-bold">
                    <span className="text-[10px] text-slate-400">Net:</span>
                    <span className={isMonthProfitable ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}>
                      {formatCurrency(profit)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: PIPELINE SOURCES & SERVICE TYPES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Conversion by Source */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <ArrowUpRight className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Lead Acquisition Channels (Sources)
              </h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {data?.lead_sources.map((s) => (
              <div
                key={s.source}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{s.source}</div>
                  <div className="text-[11px] text-slate-500">
                    {s.converted_count} of {s.total_leads} leads converted ({s.conversion_rate_pct}%)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(s.total_value_won)}
                  </div>
                  <div className="text-[10px] text-slate-400">Won Value</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Conversion by Service & Lost Reasons */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Briefcase className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Service Demand &amp; Lost Deal Reasons
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Top Service Types Won
              </span>
              {data?.service_types.map((srv) => (
                <div
                  key={srv.service_type}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {srv.service_type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">{srv.converted_count} won</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(srv.total_value_won)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            {data?.lost_reasons && data.lost_reasons.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Why Deals Were Lost
                </span>
                <div className="flex flex-wrap gap-2">
                  {data.lost_reasons.map((lr) => (
                    <span
                      key={lr.reason}
                      className="px-2.5 py-1 rounded-lg text-xs border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                    >
                      {lr.reason}: <strong>{lr.count}</strong> ({lr.pct}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: COMPANY EXPENSES BREAKDOWN & PROJECT AMC DELIVERY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Receipt className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Company Expenses Breakdown by Category
              </h3>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                View Expenses &rarr;
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {data?.expense_categories.map((cat) => (
              <div
                key={cat.category}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{cat.category}</div>
                  <div className="text-[11px] text-slate-500">
                    {cat.count} expense bills &bull; {cat.share_pct}% of total spend
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(cat.paid_amount)}
                  </div>
                  {cat.pending_amount > 0 && (
                    <div className="text-[10px] text-amber-600">
                      +{formatCurrency(cat.pending_amount)} pending
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects Delivery & AMC SLA Contracts */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FolderKanban className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Project Delivery &amp; AMC Maintenance SLA
              </h3>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                View Projects &rarr;
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Status cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Active</span>
                <strong className="text-lg text-indigo-600 dark:text-indigo-400">
                  {data?.projects_and_amc.active_projects || 0}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed</span>
                <strong className="text-lg text-emerald-600 dark:text-emerald-400">
                  {data?.projects_and_amc.completed_projects || 0}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Budget</span>
                <strong className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(data?.projects_and_amc.total_contract_value || 0)}
                </strong>
              </div>
            </div>

            {/* AMC SLA Tiers breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Active AMC SLA Tiers &amp; ARR
              </span>
              {data?.projects_and_amc.amc_tiers.map((tier) => (
                <div
                  key={tier.tier}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{tier.tier}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold">
                      {tier.active_contracts} active
                    </span>
                  </div>
                  <strong className="text-purple-700 dark:text-purple-300">
                    {formatCurrency(tier.annual_revenue)} / yr
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: SUPPORT TICKETS RECEIVED, RESOLVED & RESOLUTION TIME (BAU OPERATIONS) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <LifeBuoy className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Support Tickets Received, Resolved &amp; Time to Resolve
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSupportReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Export Support CSV</span>
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('bau')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                Open BAU Board &rarr;
              </button>
            )}
          </div>
        </div>

        {/* 5 High-Impact Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold text-slate-500 block">Tickets Received</span>
            <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
              {data?.support_and_resolution?.total_received || 0}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {data?.support_and_resolution?.open_tickets || 0} new incoming
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold text-slate-500 block">Tickets Resolved</span>
            <div className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
              {data?.support_and_resolution?.total_resolved || 0}
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
              {data?.support_and_resolution?.resolution_rate_pct || 100}% resolution rate
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold text-slate-500 block">Avg Time to Resolve</span>
            <div className="mt-1 text-xl font-black text-indigo-600 dark:text-indigo-400">
              {data?.support_and_resolution?.avg_resolution_time_formatted || '< 4 hrs'}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Fastest: {data?.support_and_resolution?.fastest_resolution_formatted || '30m'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold text-slate-500 block">SLA Adherence</span>
            <div className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
              {data?.support_and_resolution?.sla_adherence_rate_pct || 100}%
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {data?.support_and_resolution?.within_sla_count || 0} on-time &bull; {data?.support_and_resolution?.breached_sla_count || 0} breached
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold text-slate-500 block">Active Workload</span>
            <div className="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">
              {(data?.support_and_resolution?.in_progress_tickets || 0) + (data?.support_and_resolution?.pending_tickets || 0)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {data?.support_and_resolution?.in_progress_tickets || 0} in-progress &bull; {data?.support_and_resolution?.pending_tickets || 0} pending
            </span>
          </div>
        </div>

        {/* Priority SLA & Resolution Time Breakdown Table & Category Turnaround */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
          {/* By Priority */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Resolution Turnaround Time &amp; SLA by Priority
            </span>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-2.5 text-center">Received</th>
                    <th className="py-2.5 px-2.5 text-center text-emerald-600">Resolved</th>
                    <th className="py-2.5 px-3 text-center">Resolution Rate</th>
                    <th className="py-2.5 px-3 text-right">Avg Turnaround</th>
                    <th className="py-2.5 px-3 text-right text-slate-400">Target SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.support_and_resolution?.priority_breakdown.map((p) => {
                    const badgeClass =
                      p.priority === 'Critical'
                        ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200'
                        : p.priority === 'High'
                        ? 'text-orange-600 bg-orange-50 dark:bg-orange-950/60 border-orange-200'
                        : p.priority === 'Medium'
                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200'
                        : 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200';

                    return (
                      <tr key={p.priority} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass}`}>
                            {p.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {p.total}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-black text-emerald-600">
                          {p.resolved}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {p.total > 0 ? `${p.resolution_rate_pct}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                          {p.avg_resolution_formatted}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                          {p.sla_target}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Issue Category */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Resolution Turnaround Time by Issue Category
            </span>
            <div className="space-y-2">
              {data?.support_and_resolution?.category_breakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{cat.category}</span>
                    <span className="text-[11px] text-slate-400 block">
                      {cat.resolved} resolved of {cat.total} tickets
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-indigo-600 dark:text-indigo-400 block">
                      {cat.avg_resolution_formatted}
                    </span>
                    <span className="text-[10px] text-slate-400">avg turnaround</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

