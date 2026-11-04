import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, ArrowRight } from 'lucide-react';
import { apiFetch, setToken } from '../lib/api';
import { User } from '../types/crm';
import { NexBrandLockup } from '../components/ui/NexLogo';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@nexcrm.io');
  const [password, setPassword] = useState('Admin123!');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { name, email, password, role };

      const res = await apiFetch<{ token: string; user: User }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Left branding panel in signature NexInt Deep Navy (#0F2547) & Cyan-Teal (#3596B0) */}
      <div className="lg:w-1/2 bg-[#0F2547] text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        {/* Decorative subtle teal radial glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3596B0 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3596B0 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <NexBrandLockup size="lg" variant="inverted" subtitle="INTELLIGENCE BEYOND DATA" />
            <span className="text-xs px-3 py-1 rounded-full bg-[#3596B0]/20 text-[#7BC8DC] border border-[#3596B0]/40 font-semibold">
              NexInt IT Services Suite
            </span>
          </div>

          <div className="mt-14 max-w-lg">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              From first client enquiry to{' '}
              <span className="text-[#49AFCB]">delivered software project.</span>
            </h1>
            <p className="mt-4 text-slate-200/90 text-base leading-relaxed">
              Manage your IT consultancy pipeline in one clean workspace: capture incoming leads,
              track conversion outcomes, onboard clients, and run manual project delivery timelines.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-xs font-bold text-[#49AFCB] uppercase tracking-wider">
                Full Lifecycle
              </div>
              <div className="text-sm font-semibold mt-1 text-white">
                Lead &rarr; Conversion &rarr; Client &rarr; Project &rarr; Timeline
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Zero Bloat
              </div>
              <div className="text-sm font-semibold mt-1 text-white">
                Fast manual entry, Kanban conversion board &amp; Gantt schedule
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-10 pt-6 border-t border-white/15 text-xs text-slate-300 flex items-center justify-between">
          <span>NexCRM by NexInt &bull; Intelligence Beyond Data</span>
          <span className="text-[#7BC8DC] font-medium">Role-based JWT Auth</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8">
          <div className="mb-6 flex flex-col items-start">
            <div className="mb-4">
              <NexBrandLockup size="sm" subtitle="INTELLIGENCE BEYOND DATA" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F2547] dark:text-slate-100">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create a team account'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {mode === 'login'
                ? 'Enter your admin credentials below to access your workspace.'
                : 'Register a new team member to assign leads and projects.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="NexInt AI admin"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3596B0]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nexcrm.io"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3596B0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3596B0]"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3596B0]"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0F2547] hover:bg-[#173461] dark:bg-[#3596B0] dark:hover:bg-[#28788E] text-white font-semibold text-sm shadow-md shadow-[#0F2547]/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                'Authenticating...'
              ) : mode === 'login' ? (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="text-xs font-semibold text-[#3596B0] hover:underline"
            >
              {mode === 'login'
                ? 'Need another account? Register a new team member'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
