import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  FolderKanban,
  Compass,
  Download,
  Search,
  Building2,
  Receipt,
  BarChart3,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { NavTab, ProjectRevenueItem } from '../types/crm';
import {
  CURRENCIES,
  exportToCsv,
  formatCurrency,
  formatDate,
  getProjectStatusBadge,
} from '../lib/utils';
import { useToast } from '../components/ui/Toast';

interface RevenuePageProps {
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SOURCE_COLORS: Record<string, { badge: string; bar: string }> = {
  Website: {
    badge:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    bar: 'bg-sky-500',
  },
  Referral: {
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    bar: 'bg-emerald-500',
  },
  LinkedIn: {
    badge:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    bar: 'bg-indigo-500',
  },
  'Cold outreach': {
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    bar: 'bg-amber-500',
  },
  Event: {
    badge:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    bar: 'bg-purple-500',
  },
  Other: {
    badge:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    bar: 'bg-slate-500',
  },
};

export const RevenuePage: React.FC<RevenuePageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();

  const [items, setItems] = useState<ProjectRevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>('INR');

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [periodTab, setPeriodTab] = useState<'monthly' | 'yearly'>('monthly');

  const fetchRevenue = async (targetCurr: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ currency: string; projects: ProjectRevenueItem[] }>(
        `/revenue?currency=${encodeURIComponent(targetCurr)}`
      );
      setItems(res.projects || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load revenue data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue(currency);
  }, [currency]);

  // Available years across all projects
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    for (const item of items) {
      if (item.year) yearsSet.add(item.year);
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [items]);

  // Available sources
  const availableSources = useMemo(() => {
    const set = new Set<string>(['Website', 'Referral', 'LinkedIn', 'Cold outreach', 'Event']);
    for (const item of items) {
      if (item.source) set.add(item.source);
    }
    return Array.from(set);
  }, [items]);

  // Filtered project revenue items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedYear !== 'ALL' && String(item.year) !== selectedYear) return false;
      if (selectedSource !== 'ALL' && item.source !== selectedSource) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchProj = item.name.toLowerCase().includes(q);
        const matchClient = item.client_company.toLowerCase().includes(q);
        const matchService = item.service_type.toLowerCase().includes(q);
        const matchSource = item.source.toLowerCase().includes(q);
        if (!matchProj && !matchClient && !matchService && !matchSource) return false;
      }
      return true;
    });
  }, [items, selectedYear, selectedSource, search]);

  // Overall Totals (for filtered set)
  const totals = useMemo(() => {
    const grossRevenue = filteredItems.reduce((s, i) => s + i.gross_revenue, 0);
    const totalCost = filteredItems.reduce((s, i) => s + i.total_cost, 0);
    const vendorCost = filteredItems.reduce((s, i) => s + i.vendor_cost, 0);
    const resourceCost = filteredItems.reduce((s, i) => s + i.resource_cost, 0);
    const netProfit = filteredItems.reduce((s, i) => s + i.net_profit, 0);
    const marginPct =
      grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;

    return {
      projectCount: filteredItems.length,
      grossRevenue,
      totalCost,
      vendorCost,
      resourceCost,
      netProfit,
      marginPct,
    };
  }, [filteredItems]);

  // Yearly Aggregation (across all years matching source & search)
  const yearlyAggregation = useMemo(() => {
    const map = new Map<
      number,
      {
        year: number;
        projectCount: number;
        grossRevenue: number;
        totalCost: number;
        vendorCost: number;
        resourceCost: number;
        netProfit: number;
      }
    >();

    for (const y of availableYears) {
      map.set(y, {
        year: y,
        projectCount: 0,
        grossRevenue: 0,
        totalCost: 0,
        vendorCost: 0,
        resourceCost: 0,
        netProfit: 0,
      });
    }

    for (const item of items) {
      if (selectedSource !== 'ALL' && item.source !== selectedSource) continue;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.client_company.toLowerCase().includes(q) &&
          !item.service_type.toLowerCase().includes(q)
        ) {
          continue;
        }
      }
      const entry = map.get(item.year) || {
        year: item.year,
        projectCount: 0,
        grossRevenue: 0,
        totalCost: 0,
        vendorCost: 0,
        resourceCost: 0,
        netProfit: 0,
      };
      entry.projectCount += 1;
      entry.grossRevenue += item.gross_revenue;
      entry.totalCost += item.total_cost;
      entry.vendorCost += item.vendor_cost;
      entry.resourceCost += item.resource_cost;
      entry.netProfit += item.net_profit;
      map.set(item.year, entry);
    }

    return Array.from(map.values())
      .sort((a, b) => b.year - a.year)
      .map((row) => ({
        ...row,
        marginPct:
          row.grossRevenue > 0
            ? Math.round((row.netProfit / row.grossRevenue) * 1000) / 10
            : 0,
      }));
  }, [items, availableYears, selectedSource, search]);

  // Monthly Aggregation (Jan - Dec)
  const monthlyAggregation = useMemo(() => {
    const months = MONTH_NAMES.map((label, idx) => ({
      monthIndex: idx,
      label,
      projectCount: 0,
      grossRevenue: 0,
      totalCost: 0,
      vendorCost: 0,
      resourceCost: 0,
      netProfit: 0,
      marginPct: 0,
    }));

    for (const item of filteredItems) {
      const m = months[item.month_index];
      if (m) {
        m.projectCount += 1;
        m.grossRevenue += item.gross_revenue;
        m.totalCost += item.total_cost;
        m.vendorCost += item.vendor_cost;
        m.resourceCost += item.resource_cost;
        m.netProfit += item.net_profit;
      }
    }

    return months.map((m) => ({
      ...m,
      marginPct:
        m.grossRevenue > 0 ? Math.round((m.netProfit / m.grossRevenue) * 1000) / 10 : 0,
    }));
  }, [filteredItems]);

  const activeMonthsCount = useMemo(() => {
    const active = monthlyAggregation.filter((m) => m.grossRevenue > 0).length;
    return active > 0 ? active : 1;
  }, [monthlyAggregation]);

  const peakMonth = useMemo(() => {
    let best = monthlyAggregation[0];
    for (const m of monthlyAggregation) {
      if (m.grossRevenue > (best?.grossRevenue || 0)) {
        best = m;
      }
    }
    return best;
  }, [monthlyAggregation]);

  const maxMonthRevenue = useMemo(() => {
    return Math.max(1, ...monthlyAggregation.map((m) => m.grossRevenue));
  }, [monthlyAggregation]);

  // Aggregation by Lead Source
  const sourceAggregation = useMemo(() => {
    const map = new Map<
      string,
      {
        source: string;
        projectCount: number;
        grossRevenue: number;
        totalCost: number;
        netProfit: number;
      }
    >();

    // Use year + search filtered items so the user can see all sources and click one
    const baseItems = items.filter((item) => {
      if (selectedYear !== 'ALL' && String(item.year) !== selectedYear) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.client_company.toLowerCase().includes(q) &&
          !item.service_type.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    const grandTotalRevenue = baseItems.reduce((s, i) => s + i.gross_revenue, 0);

    for (const item of baseItems) {
      const src = item.source || 'Other';
      const entry = map.get(src) || {
        source: src,
        projectCount: 0,
        grossRevenue: 0,
        totalCost: 0,
        netProfit: 0,
      };
      entry.projectCount += 1;
      entry.grossRevenue += item.gross_revenue;
      entry.totalCost += item.total_cost;
      entry.netProfit += item.net_profit;
      map.set(src, entry);
    }

    return Array.from(map.values())
      .sort((a, b) => b.grossRevenue - a.grossRevenue)
      .map((row) => ({
        ...row,
        sharePct:
          grandTotalRevenue > 0
            ? Math.round((row.grossRevenue / grandTotalRevenue) * 1000) / 10
            : 0,
        marginPct:
          row.grossRevenue > 0
            ? Math.round((row.netProfit / row.grossRevenue) * 1000) / 10
            : 0,
      }));
  }, [items, selectedYear, search]);

  const handleExportRevenueCsv = () => {
    const rows = filteredItems.map((p) => ({
      Project: p.name,
      Client: p.client_company,
      Lead_Source: p.source,
      Service_Type: p.service_type,
      Status: p.status,
      Year: p.year,
      Month: MONTH_NAMES[p.month_index] || '',
      Gross_Revenue: p.gross_revenue,
      Vendor_Cost: p.vendor_cost,
      Resource_Cost: p.resource_cost,
      Total_Cost: p.total_cost,
      Net_Profit: p.net_profit,
      Margin_Pct: `${p.margin_pct}%`,
      Currency: p.currency,
    }));
    exportToCsv(`nexcrm-revenue-${currency.toLowerCase()}.csv`, rows);
    showToast(`Exported ${rows.length} project revenue records to CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Revenue &amp; Profitability Analytics
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-500 font-semibold">Currency:</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportRevenueCsv}
            disabled={filteredItems.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Revenue CSV
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards: Yearly Revenue, Monthly Revenue, Deducted Costs, Net Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>
              {selectedYear === 'ALL' ? 'Total Yearly Revenue' : `${selectedYear} Yearly Revenue`}
            </span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(totals.grossRevenue, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {totals.projectCount} project{totals.projectCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-sky-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            <span>Avg Monthly Revenue</span>
            <Calendar className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(Math.round(totals.grossRevenue / activeMonthsCount), currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Peak Month: <strong>{peakMonth?.label}</strong> (
            {formatCurrency(peakMonth?.grossRevenue || 0, currency)})
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <span>Vendor &amp; Resource Costs</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            - {formatCurrency(totals.totalCost, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Vendor/AWS: {formatCurrency(totals.vendorCost, currency)} &bull; Resource:{' '}
            {formatCurrency(totals.resourceCost, currency)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <span>Net Profit (After Costs)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div
            className={`text-2xl font-extrabold mt-1 ${
              totals.netProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(totals.netProfit, currency)}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-slate-600 dark:text-slate-400">Revenue &minus; Costs</span>
            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              {totals.marginPct}% margin
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar: Search, Year Filter, Source Filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name, client, service, or source..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Years (Yearly Aggregate)</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                Year {yr}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Lead Sources</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                Source: {src}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Middle Grid: Left (7 cols) Monthly & Yearly Revenue | Right (5 cols) Revenue by Source */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Monthly & Yearly Revenue Breakdown */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Monthly &amp; Yearly Revenue Breakdown
              </h3>
            </div>

            <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPeriodTab('monthly')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  periodTab === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Monthly Revenue
              </button>
              <button
                type="button"
                onClick={() => setPeriodTab('yearly')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  periodTab === 'yearly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Yearly Revenue
              </button>
            </div>
          </div>

          {periodTab === 'monthly' ? (
            <div className="space-y-5">
              {/* 12-Month Visual Bar Chart */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                  <span className="font-semibold">
                    Monthly Revenue vs Net Profit (
                    {selectedYear === 'ALL' ? 'All Years Combined' : selectedYear})
                  </span>
                  <div className="flex items-center gap-3 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" />
                      Gross Revenue
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                      Net Profit
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end h-40 pt-4">
                  {monthlyAggregation.map((m) => {
                    const revHeightPct =
                      m.grossRevenue > 0
                        ? Math.max(8, Math.round((m.grossRevenue / maxMonthRevenue) * 100))
                        : 0;
                    const profitHeightPct =
                      m.netProfit > 0
                        ? Math.max(6, Math.round((m.netProfit / maxMonthRevenue) * 100))
                        : 0;
                    return (
                      <div
                        key={m.label}
                        className="flex flex-col items-center h-full justify-end group"
                        title={`${m.label}: Revenue ${formatCurrency(
                          m.grossRevenue,
                          currency
                        )} | Profit ${formatCurrency(m.netProfit, currency)}`}
                      >
                        <div className="w-full flex items-end justify-center gap-1 h-28">
                          <div
                            className="w-2.5 bg-indigo-500 dark:bg-indigo-400 rounded-t transition-all"
                            style={{ height: `${revHeightPct}%` }}
                          />
                          <div
                            className="w-2.5 bg-emerald-500 dark:bg-emerald-400 rounded-t transition-all"
                            style={{ height: `${profitHeightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5">
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Breakdown Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-80">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3.5">Month</th>
                      <th className="py-2.5 px-3.5">Projects</th>
                      <th className="py-2.5 px-3.5 text-right">Gross Revenue</th>
                      <th className="py-2.5 px-3.5 text-right">Vendor &amp; Resource Cost</th>
                      <th className="py-2.5 px-3.5 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                    {monthlyAggregation.map((m) => (
                      <tr
                        key={m.label}
                        className={
                          m.projectCount > 0
                            ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            : 'bg-slate-50/40 dark:bg-slate-900/40 text-slate-400'
                        }
                      >
                        <td className="py-2.5 px-3.5 font-bold text-slate-800 dark:text-slate-200">
                          {m.label} {selectedYear !== 'ALL' ? selectedYear : ''}
                        </td>
                        <td className="py-2.5 px-3.5">{m.projectCount}</td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(m.grossRevenue, currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-medium text-rose-600 dark:text-rose-400">
                          {m.totalCost > 0
                            ? `- ${formatCurrency(m.totalCost, currency)}`
                            : formatCurrency(0, currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(m.netProfit, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Yearly Revenue View */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {yearlyAggregation.map((y) => (
                  <div
                    key={y.year}
                    onClick={() =>
                      setSelectedYear(
                        selectedYear === String(y.year) ? 'ALL' : String(y.year)
                      )
                    }
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedYear === String(y.year)
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        Year {y.year}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                        {y.projectCount} project{y.projectCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                      {formatCurrency(y.grossRevenue, currency)}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        Costs: - {formatCurrency(y.totalCost, currency)}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Profit: {formatCurrency(y.netProfit, currency)} ({y.marginPct}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Year</th>
                      <th className="py-3 px-4">Projects</th>
                      <th className="py-3 px-4 text-right">Yearly Gross Revenue</th>
                      <th className="py-3 px-4 text-right">Vendor &amp; Resource Costs</th>
                      <th className="py-3 px-4 text-right">Yearly Net Profit</th>
                      <th className="py-3 px-4 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                    {yearlyAggregation.map((y) => (
                      <tr
                        key={y.year}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {y.year}
                        </td>
                        <td className="py-3 px-4">{y.projectCount}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(y.grossRevenue, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                          - {formatCurrency(y.totalCost, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(y.netProfit, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                          {y.marginPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Revenue Aggregated by Source */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Revenue Aggregated by Source
              </h3>
            </div>
            {selectedSource !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedSource('ALL')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Reset Source Filter
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click any acquisition source below to filter the monthly breakdown and project revenue
            ledger.
          </p>

          {sourceAggregation.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No revenue data available for the selected filters.
            </div>
          ) : (
            <div className="space-y-3">
              {sourceAggregation.map((src) => {
                const style = SOURCE_COLORS[src.source] || SOURCE_COLORS.Other;
                const isSelected = selectedSource === src.source;
                return (
                  <div
                    key={src.source}
                    onClick={() =>
                      setSelectedSource(isSelected ? 'ALL' : src.source)
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${style.badge}`}
                        >
                          {src.source}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {src.projectCount} project{src.projectCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {formatCurrency(src.grossRevenue, currency)}
                        </span>
                        <span className="ml-1.5 text-[11px] font-bold text-slate-500">
                          ({src.sharePct}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full ${style.bar} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, src.sharePct)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        Costs:{' '}
                        <strong className="text-rose-600 dark:text-rose-400">
                          - {formatCurrency(src.totalCost, currency)}
                        </strong>
                      </span>
                      <span>
                        Net Profit:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(src.netProfit, currency)} ({src.marginPct}%)
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Revenue Aggregated by Projects Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Revenue Aggregated by Projects ({filteredItems.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Click any project to manage its vendor payments (AWS, etc.) &amp; resource allocation
            costs
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
            Loading project revenue aggregation...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No projects match your current year/source filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Project &amp; Service</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Lead Source</th>
                  <th className="py-3.5 px-4">Period</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Gross Revenue (Budget)</th>
                  <th className="py-3.5 px-4 text-right">Vendor &amp; Resource Costs</th>
                  <th className="py-3.5 px-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {filteredItems.map((proj) => {
                  const srcStyle = SOURCE_COLORS[proj.source] || SOURCE_COLORS.Other;
                  return (
                    <tr
                      key={proj.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onNavigate('projects', proj.id)}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 inline-flex items-center gap-1">
                            {proj.name}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {proj.service_type}
                          </div>
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onNavigate('clients', proj.client_id)}
                          className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {proj.client_company}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${srcStyle.badge}`}
                        >
                          {proj.source}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {MONTH_NAMES[proj.month_index]} {proj.year}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDate(proj.start_date)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${getProjectStatusBadge(
                            proj.status
                          )}`}
                        >
                          {proj.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(proj.gross_revenue, currency)}
                        </div>
                        {proj.native_currency !== currency && (
                          <div className="text-[10px] text-slate-400">
                            Native: {formatCurrency(proj.native_budget, proj.native_currency)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-bold text-rose-600 dark:text-rose-400">
                          - {formatCurrency(proj.total_cost, currency)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {proj.costs_count} cost item{proj.costs_count === 1 ? '' : 's'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className={`font-extrabold ${
                            proj.net_profit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatCurrency(proj.net_profit, currency)}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500">
                          {proj.margin_pct}% margin
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 text-xs font-extrabold">
                  <td colSpan={5} className="py-3.5 px-4 text-slate-900 dark:text-slate-100">
                    Total Aggregated Revenue ({filteredItems.length} Projects)
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(totals.grossRevenue, currency)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400">
                    - {formatCurrency(totals.totalCost, currency)}
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right ${
                      totals.netProfit >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(totals.netProfit, currency)} ({totals.marginPct}%)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

