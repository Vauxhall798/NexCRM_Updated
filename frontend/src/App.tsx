import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  GitPullRequestArrow,
  Briefcase,
  FolderKanban,
  CalendarRange,
  UsersRound,
  MessageSquareHeart,
  LifeBuoy,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  DollarSign,
  CreditCard,
  Database,
  Mail,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { apiFetch, getToken, setToken } from './lib/api';
import { NavTab, User } from './types/crm';
import { ToastProvider } from './components/ui/Toast';
import { NexBrandLockup } from './components/ui/NexLogo';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadConversionPage } from './pages/LeadConversionPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { ClientsPage } from './pages/ClientsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RevenuePage } from './pages/RevenuePage';
import { ClientPaymentsPage } from './pages/ClientPaymentsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { TimelinePage } from './pages/TimelinePage';
import { ResourcesPage } from './pages/ResourcesPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { BauPage } from './pages/BauPage';
import { AutoEmailPage } from './pages/AutoEmailPage';
import { DatabaseModal } from './components/DatabaseModal';

interface NavItem {
  id: NavTab;
  label: string;
  group: 'Overview & Pipeline' | 'Delivery & Resources' | 'Post-Delivery & CSAT';
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    group: 'Overview & Pipeline',
    icon: LayoutDashboard,
  },
  {
    id: 'reports',
    label: 'Reports',
    group: 'Overview & Pipeline',
    icon: BarChart3,
  },
  {
    id: 'leads',
    label: 'Leads',
    group: 'Overview & Pipeline',
    icon: Users,
  },
  {
    id: 'conversions',
    label: 'Lead Conversion',
    group: 'Overview & Pipeline',
    icon: GitPullRequestArrow,
  },
  {
    id: 'proposals',
    label: 'AI Proposals',
    group: 'Overview & Pipeline',
    icon: Sparkles,
  },
  {
    id: 'auto_email',
    label: 'Auto Email Configuration',
    group: 'Overview & Pipeline',
    icon: Mail,
  },
  {
    id: 'clients',
    label: 'Clients',
    group: 'Overview & Pipeline',
    icon: Briefcase,
  },
  {
    id: 'projects',
    label: 'Projects',
    group: 'Delivery & Resources',
    icon: FolderKanban,
  },
  {
    id: 'client_payments',
    label: 'Client Payments',
    group: 'Delivery & Resources',
    icon: CreditCard,
  },
  {
    id: 'expenses',
    label: 'Expenses',
    group: 'Delivery & Resources',
    icon: Receipt,
  },
  {
    id: 'revenue',
    label: 'Revenue',
    group: 'Delivery & Resources',
    icon: DollarSign,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    group: 'Delivery & Resources',
    icon: CalendarRange,
  },
  {
    id: 'resources',
    label: 'Resources',
    group: 'Delivery & Resources',
    icon: UsersRound,
  },
  {
    id: 'feedback',
    label: 'Client Feedback',
    group: 'Post-Delivery & CSAT',
    icon: MessageSquareHeart,
  },
  {
    id: 'bau',
    label: 'BAU',
    group: 'Post-Delivery & CSAT',
    icon: LifeBuoy,
  },
];

const NAV_GROUPS: Array<NavItem['group']> = [
  'Overview & Pipeline',
  'Delivery & Resources',
  'Post-Delivery & CSAT',
];

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [contextId, setContextId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('nexcrm_sidebar_collapsed') === 'true';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('nexcrm_theme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('nexcrm_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('nexcrm_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('nexcrm_theme', 'light');
    }
  }, [darkMode]);

  const loadWorkspaceData = async () => {
    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    try {
      const [meRes, usersRes] = await Promise.all([
        apiFetch<{ user: User }>('/auth/me'),
        apiFetch<{ users: User[] }>('/auth/users'),
      ]);
      setUser(meRes.user);
      setUsers(usersRes.users);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    try {
      const usersRes = await apiFetch<{ users: User[] }>('/auth/users');
      setUsers(usersRes.users);
    } catch {
      setUsers([loggedInUser]);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
  };

  const handleNavigate = (tab: NavTab, id?: string) => {
    setActiveTab(tab);
    setContextId(id || null);
    setMobileMenuOpen(false);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Loading NexCRM workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* Desktop Collapsible Left Sidebar */}
        <aside
          className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800 z-30 transition-all duration-300 ease-in-out select-none shadow-xs ${
            sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
          }`}
        >
          {/* Floating Edge Collapse/Expand Handle */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute -right-3 top-6 z-40 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-500 hover:text-[#0F2547] dark:hover:text-[#49AFCB] hover:scale-110 transition-all cursor-pointer"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Brand Header */}
          <div
            className={`h-16 flex items-center border-b border-slate-200/80 dark:border-slate-800 transition-all duration-300 ${
              sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5'
            }`}
          >
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:border-[#3596B0] transition-all group"
                title="Expand NexCRM Sidebar"
              >
                <img
                  src="/logo-mark.webp"
                  alt="NexCRM"
                  className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
                />
              </button>
            ) : (
              <>
                <NexBrandLockup size="sm" subtitle="" />
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F2547] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Grouped Interactive Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden">
            {NAV_GROUPS.map((groupName, groupIdx) => {
              const groupItems = NAV_ITEMS.filter((i) => i.group === groupName);
              return (
                <div key={groupName} className="space-y-1">
                  {sidebarCollapsed ? (
                    groupIdx > 0 && (
                      <div className="mx-2 my-2 border-t border-slate-200/70 dark:border-slate-800" />
                    )
                  ) : (
                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {groupName}
                    </div>
                  )}

                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <div key={item.id} className="relative group/nav">
                        <button
                          type="button"
                          onClick={() => handleNavigate(item.id)}
                          className={`w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer ${
                            sidebarCollapsed
                              ? 'justify-center py-2.5 px-0'
                              : 'gap-3 px-3 py-2.5 text-left'
                          } ${
                            active
                              ? 'bg-gradient-to-r from-[#0F2547] to-[#193B6E] dark:from-[#3596B0] dark:to-[#28788E] text-white shadow-md shadow-[#0F2547]/15 dark:shadow-[#3596B0]/20'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-[#EEF8FA]/80 dark:hover:bg-slate-800/80 hover:text-[#0F2547] dark:hover:text-slate-100'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/nav:scale-105 ${
                              active
                                ? 'bg-white/15 text-[#49AFCB] dark:text-white'
                                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 group-hover/nav:bg-white dark:group-hover/nav:bg-slate-700 group-hover/nav:text-[#3596B0]'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          {!sidebarCollapsed && (
                            <span className="text-xs font-semibold truncate flex-1">
                              {item.label}
                            </span>
                          )}

                          {!sidebarCollapsed && active && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#49AFCB] dark:bg-white shrink-0" />
                          )}
                        </button>

                        {/* Floating Tooltip when Collapsed */}
                        {sidebarCollapsed && (
                          <div className="pointer-events-none opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 fixed left-20 ml-2 px-2.5 py-1.5 rounded-lg bg-[#0F2547] dark:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shadow-lg z-50 border border-[#3596B0]/30">
                            {item.label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Bottom User Profile & Theme Controls */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/50">
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F2547] to-[#3596B0] text-white font-bold flex items-center justify-center text-xs shadow-xs"
                  title={`${user.name} (${user.role})`}
                >
                  {user.name.charAt(0)}
                </div>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F2547] to-[#3596B0] text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#0F2547] dark:text-slate-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md bg-[#EEF8FA] dark:bg-slate-700 text-[#3596B0] dark:text-[#7BC8DC]">
                    {user.role}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDarkMode(!darkMode)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#3596B0] transition-colors"
                  >
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    {darkMode ? 'Light' : 'Dark'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Exit
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Mobile Navigation Drawer Sheet */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden bg-slate-950/70 backdrop-blur-xs flex"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-80 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col justify-between shadow-2xl border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-800">
                  <NexBrandLockup size="sm" subtitle="INTELLIGENCE BEYOND DATA" />
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Grouped Nav Items with Smooth Scroll */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                  {NAV_GROUPS.map((groupName) => {
                    const groupItems = NAV_ITEMS.filter((i) => i.group === groupName);
                    return (
                      <div key={groupName} className="space-y-1">
                        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {groupName}
                        </div>
                        {groupItems.map((item) => {
                          const Icon = item.icon;
                          const active = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNavigate(item.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all ${
                                active
                                  ? 'bg-gradient-to-r from-[#0F2547] to-[#193B6E] dark:from-[#3596B0] dark:to-[#28788E] text-white shadow-sm'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  active
                                    ? 'bg-white/15 text-[#49AFCB] dark:text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate flex-1">{item.label}</span>
                              {active && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49AFCB] dark:bg-white shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </nav>
              </div>

              {/* Bottom Profile & Controls */}
              <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-2.5">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F2547] to-[#3596B0] text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#0F2547] dark:text-slate-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md bg-[#EEF8FA] dark:bg-slate-700 text-[#3596B0] dark:text-[#7BC8DC]">
                    {user.role}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDarkMode(!darkMode)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    {darkMode ? 'Light' : 'Dark'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace Content Column */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
        >
          {/* Top Header */}
          <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Open menu"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="lg:hidden">
                <img src="/logo-mark.webp" alt="NexCRM" className="w-6 h-6 object-contain" />
              </div>

              {sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="hidden lg:inline-flex p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#0F2547] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Expand sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}

              <div>
                <h1 className="text-sm sm:text-base font-bold text-[#0F2547] dark:text-slate-100 truncate max-w-[170px] sm:max-w-none">
                  {NAV_ITEMS.find((i) => i.id === activeTab)?.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDatabaseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-xs cursor-pointer"
                title="Database Status, Persistence & 1-Click Backup"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Database &amp; Backup</span>
              </button>

              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Toggle theme"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
                <div
                  className="w-7 h-7 rounded-full bg-[#0F2547] dark:bg-[#3596B0] text-white font-bold flex items-center justify-center text-xs"
                  title={user.name}
                >
                  {user.name.charAt(0)}
                </div>
                <span className="hidden sm:inline font-semibold text-[#0F2547] dark:text-slate-200 truncate max-w-[120px]">
                  {user.name}
                </span>
              </div>
            </div>
          </header>

          {/* Active Module View */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activeTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
            {activeTab === 'reports' && <ReportsPage onNavigate={handleNavigate} />}
            {activeTab === 'leads' && (
              <LeadsPage
                users={users}
                currentUser={user}
                initialLeadId={contextId}
                onClearInitialId={() => setContextId(null)}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'conversions' && (
              <LeadConversionPage
                initialLeadId={contextId}
                onClearInitialId={() => setContextId(null)}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'proposals' && (
              <ProposalsPage onNavigate={handleNavigate} />
            )}
            {activeTab === 'auto_email' && (
              <AutoEmailPage onNavigate={handleNavigate} />
            )}
            {activeTab === 'clients' && (
              <ClientsPage
                users={users}
                initialClientId={contextId}
                onClearInitialId={() => setContextId(null)}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsPage
                users={users}
                initialProjectId={contextId}
                onClearInitialId={() => setContextId(null)}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'client_payments' && (
              <ClientPaymentsPage
                initialProjectId={contextId}
                onClearInitialId={() => setContextId(null)}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'expenses' && (
              <ExpensesPage users={users} onNavigate={handleNavigate} />
            )}
            {activeTab === 'revenue' && <RevenuePage onNavigate={handleNavigate} />}
            {activeTab === 'timeline' && (
              <TimelinePage
                users={users}
                initialProjectId={contextId}
                onClearInitialId={() => setContextId(null)}
              />
            )}
            {activeTab === 'resources' && (
              <ResourcesPage onNavigate={handleNavigate} />
            )}
            {activeTab === 'feedback' && <FeedbackPage onNavigate={handleNavigate} />}
            {activeTab === 'bau' && (
              <BauPage users={users} onNavigate={handleNavigate} />
            )}
          </main>
        </div>
      </div>

      <DatabaseModal
        open={databaseModalOpen}
        onClose={() => setDatabaseModalOpen(false)}
        onDataRestored={() => window.location.reload()}
      />
    </ToastProvider>
  );
};
