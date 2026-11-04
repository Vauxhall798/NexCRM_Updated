import React, { useEffect, useState } from 'react';
import {
  Users,
  Briefcase,
  FolderKanban,
  TrendingUp,
  CalendarClock,
  Clock,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { DashboardData, NavTab } from '../types/crm';
import {
  formatCurrency,
  formatDate,
  getLeadStatusBadge,
  getProjectStatusBadge,
  getTimelineStatusBadge,
  getTimelineTypeBadge,
  isFollowupOverdue,
} from '../lib/utils';

interface DashboardPageProps {
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'status' | 'monthly'>('status');

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>('/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800"
            />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center justify-between">
        <span>{error || 'Unable to load dashboard'}</span>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxStatusCount = Math.max(
    1,
    ...data.charts.leadsByStatus.map((item) => item.count)
  );
  const maxMonthCount = Math.max(
    1,
    ...data.charts.conversionsByMonth.map(
      (m) => m.converted + m.not_converted + m.in_progress
    )
  );

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('leads')}
          className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Leads
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {data.cards.totalLeads}
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-0.5">
              View pipeline <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('clients')}
          className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Clients
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {data.cards.activeClients}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              of {data.cards.totalClients} total accounts
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Projects in Progress
            </span>
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {data.cards.projectsInProgress}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {data.cards.totalProjects} total projects
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('conversions')}
          className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Conversion Rate
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {data.cards.conversionRate}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {data.cards.convertedCount} of {data.cards.totalConversions} converted
            </span>
          </div>
        </button>
      </div>

      {/* Middle Row: Chart + Follow-ups Due This Week */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pipeline & Conversion Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {chartMode === 'status'
                      ? 'Leads by Pipeline Stage'
                      : 'Conversions per Month'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {chartMode === 'status'
                      ? 'Distribution of active enquiries and estimated deal volume'
                      : 'Monthly comparison of Converted vs Not Converted outcomes'}
                  </p>
                </div>
              </div>

              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 self-start">
                <button
                  type="button"
                  onClick={() => setChartMode('status')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    chartMode === 'status'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  By Status
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('monthly')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    chartMode === 'monthly'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Monthly Outcomes
                </button>
              </div>
            </div>

            {chartMode === 'status' ? (
              <div className="space-y-4">
                {data.charts.leadsByStatus.map((item) => {
                  const widthPct = Math.max(6, Math.round((item.count / maxStatusCount) * 100));
                  return (
                    <div key={item.status} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getLeadStatusBadge(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-slate-100">
                            {item.count}
                          </strong>{' '}
                          leads &bull; {formatCurrency(item.totalBudget, 'USD')}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pt-2">
                <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4 px-2 border-b border-slate-200 dark:border-slate-800">
                  {data.charts.conversionsByMonth.map((m) => {
                    const convHeight = Math.round((m.converted / maxMonthCount) * 120);
                    const lostHeight = Math.round((m.not_converted / maxMonthCount) * 120);
                    return (
                      <div key={m.month} className="flex flex-col items-center gap-2 h-full justify-end">
                        <div className="flex items-end gap-1.5 w-full justify-center">
                          <div
                            title={`Converted: ${m.converted}`}
                            className="w-4 bg-emerald-500 rounded-t-md transition-all"
                            style={{ height: `${Math.max(m.converted > 0 ? 14 : 4, convHeight)}px` }}
                          />
                          <div
                            title={`Not Converted: ${m.not_converted}`}
                            className="w-4 bg-rose-400 rounded-t-md transition-all"
                            style={{
                              height: `${Math.max(m.not_converted > 0 ? 14 : 4, lostHeight)}px`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 pb-2">
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                    Converted
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-rose-400 inline-block" />
                    Not Converted
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Follow-ups Due This Week */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Follow-ups Due This Week
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Overdue and upcoming 7-day lead check-ins
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('leads')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              All leads
            </button>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72 pr-1">
            {data.followupsDueThisWeek.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                No follow-ups due this week.
              </div>
            ) : (
              data.followupsDueThisWeek.map((lead) => {
                const overdue = isFollowupOverdue(lead.next_followup);
                return (
                  <div
                    key={lead.id}
                    onClick={() => onNavigate('leads', lead.id)}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      overdue
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/80 hover:border-rose-300'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {lead.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          &bull; {lead.company}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lead.service} &bull; Owner: {lead.owner?.name || 'Unassigned'}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          overdue
                            ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {overdue && <AlertCircle className="w-3 h-3" />}
                        {overdue ? 'Overdue: ' : 'Due: '}
                        {formatDate(lead.next_followup)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Projects Ending Soon & Recent Timeline Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects Ending Soon */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Projects Ending Soon
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Active engagements ordered by target completion date
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              All projects
            </button>
          </div>

          <div className="space-y-3">
            {data.projectsEndingSoon.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onNavigate('projects', proj.id)}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {proj.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Client: <span className="font-medium">{proj.client?.company}</span> &bull; PM:{' '}
                      {proj.manager?.name || 'Unassigned'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getProjectStatusBadge(
                      proj.status
                    )}`}
                  >
                    {proj.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {proj.progress}%
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Ends {formatDate(proj.end_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Timeline Updates */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Recent Timeline Updates
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Latest milestones, deliveries, tasks, and issues across projects
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('timeline')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Open timeline
            </button>
          </div>

          <div className="space-y-3">
            {data.recentTimeline.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onNavigate('timeline', entry.project_id)}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer transition-colors flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getTimelineTypeBadge(
                        entry.type
                      )}`}
                    >
                      {entry.type}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {entry.title}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {entry.project?.name} ({entry.project?.client?.company}) &bull;{' '}
                    {entry.assignee?.name || 'Unassigned'}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getTimelineStatusBadge(
                      entry.status
                    )}`}
                  >
                    {entry.status}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(entry.start_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

