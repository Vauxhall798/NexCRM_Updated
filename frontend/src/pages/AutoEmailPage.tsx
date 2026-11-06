import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Key,
  Server,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Clock,
  Sliders,
  Settings,
  History,
  Info,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { AutoEmailSettings, EmailLog, NavTab } from '../types/crm';
import { useToast } from '../components/ui/Toast';
import { formatDate, formatDateTime } from '../lib/utils';

interface AutoEmailPageProps {
  onNavigate?: (tab: NavTab) => void;
}

export const AutoEmailPage: React.FC<AutoEmailPageProps> = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'provider' | 'automation' | 'testing' | 'logs'>('provider');

  // Configuration Form State
  const [provider, setProvider] = useState<'resend' | 'brevo' | 'smtp' | 'simulated'>('resend');
  const [resendApiKey, setResendApiKey] = useState('');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [mailFrom, setMailFrom] = useState('info@nexintai.com');
  const [fromName, setFromName] = useState('NexInt AI');

  // Automation Cadence & Preferences
  const [defaultInterval, setDefaultInterval] = useState(4);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoLogNote, setAutoLogNote] = useState(true);
  const [noteAuthor, setNoteAuthor] = useState('login 1');

  // Status & Metadata from Server
  const [activeProviderName, setActiveProviderName] = useState('Checking...');
  const [aiGeneratorStatus, setAiGeneratorStatus] = useState('');

  // Password visibility toggles
  const [showResendKey, setShowResendKey] = useState(false);
  const [showBrevoKey, setShowBrevoKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Live Test Email State
  const [testEmail, setTestEmail] = useState('');
  const [testingSend, setTestingSend] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider: string;
    messageId: string;
    latencyMs: number;
    error?: string;
    status: string;
    mailtoUrl?: string;
  } | null>(null);

  // Email Logs
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ settings: AutoEmailSettings }>('/automation/settings');
      if (res?.settings) {
        const s = res.settings;
        setProvider(s.preferred_provider || (s.resend_api_key ? 'resend' : s.smtp_host ? 'smtp' : 'simulated'));
        setResendApiKey(s.resend_api_key || '');
        setBrevoApiKey(s.brevo_api_key || '');
        setSmtpHost(s.smtp_host || '');
        setSmtpPort(s.smtp_port || 587);
        setSmtpUser(s.smtp_user || '');
        setSmtpPass(s.smtp_pass || '');
        setMailFrom(s.mail_from || 'info@nexintai.com');
        setFromName(s.from_name || 'NexInt AI');
        setDefaultInterval(s.default_followup_interval_days || 4);
        setAutoAdvance(s.auto_advance_status !== false);
        setAutoLogNote(s.auto_log_note !== false);
        setNoteAuthor(s.note_author_name || 'login 1');
        setActiveProviderName(s.active_provider || 'Resend Cloud API');
        setAiGeneratorStatus(s.ai_generator_status || 'Active');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch email settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await apiFetch<{ logs: EmailLog[] }>('/automation/logs');
      if (res?.logs) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/automation/settings', {
        method: 'POST',
        body: JSON.stringify({
          preferred_provider: provider,
          resend_api_key: resendApiKey,
          brevo_api_key: brevoApiKey,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
          mail_from: mailFrom,
          from_name: fromName,
          default_followup_interval_days: defaultInterval,
          auto_advance_status: autoAdvance,
          auto_log_note: autoLogNote,
          note_author_name: noteAuthor,
        }),
      });
      showToast('Auto Email configuration saved and activated successfully!');
      fetchSettings();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save email configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      showToast('Please enter a valid recipient email address', 'error');
      return;
    }

    setTestingSend(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        provider: string;
        messageId: string;
        latencyMs: number;
        error?: string;
        status: string;
        mailtoUrl?: string;
      }>('/automation/test-email', {
        method: 'POST',
        body: JSON.stringify({ recipient: testEmail }),
      });

      setTestResult(res);
      if (res.success) {
        showToast(`Test email delivered via ${res.provider}!`);
      } else {
        showToast(res.error || 'Test email failed to send', 'error');
      }
      fetchLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        provider: 'Dispatcher',
        messageId: '',
        latencyMs: 0,
        error: err?.message || 'Failed to send test email',
        status: 'Failed',
      });
      showToast(err?.message || 'Test email dispatch failed', 'error');
    } finally {
      setTestingSend(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#0F2547] via-[#173461] to-[#1E3F73] text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-teal-400/20 text-[#49AFCB]">
              <Mail className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold">Auto Email Configuration</h2>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Live Engine
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Configure your email transport (Resend API, SMTP Server, or Brevo), sender branding, follow-up automation intervals, and test real-time inbox delivery.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              fetchSettings();
              fetchLogs();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#3596B0] hover:bg-[#49AFCB] text-white transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Provider
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeProviderName}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Sender Address
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {mailFrom || 'info@nexintai.com'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Follow-up Cadence
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
            Every {defaultInterval} Days
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            AI Composer
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            {aiGeneratorStatus.includes('Active') ? 'Gemini Argon + Templates' : 'Template Engine'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('provider')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'provider'
              ? 'bg-[#0F2547] text-white dark:bg-indigo-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          Email Service Provider
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automation')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'automation'
              ? 'bg-[#0F2547] text-white dark:bg-indigo-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Automation &amp; Cadence
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('testing')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'testing'
              ? 'bg-[#0F2547] text-white dark:bg-indigo-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Test Email Dispatcher
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-[#0F2547] text-white dark:bg-indigo-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Sent Email Logs ({logs.length})
        </button>
      </div>

      {/* Tab 1: Email Service Provider Selection & Credentials */}
      {activeTab === 'provider' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            {/* Resend Option */}
            <div
              onClick={() => setProvider('resend')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'resend'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Recommended
                  </span>
                  <input
                    type="radio"
                    name="provider_choice"
                    checked={provider === 'resend'}
                    onChange={() => setProvider('resend')}
                    className="text-indigo-600"
                  />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Resend Cloud API</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Modern API, high inbox deliverability, free 3,000 emails/month.
                </p>
              </div>
              <div className="mt-3 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Active on your system
              </div>
            </div>

            {/* Custom SMTP Server Option */}
            <div
              onClick={() => setProvider('smtp')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'smtp'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Standard</span>
                  <input
                    type="radio"
                    name="provider_choice"
                    checked={provider === 'smtp'}
                    onChange={() => setProvider('smtp')}
                    className="text-indigo-600"
                  />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Custom SMTP Server</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Google Workspace, Zoho, Microsoft 365, AWS SES SMTP.
                </p>
              </div>
              <div className="mt-3 text-[10px] font-medium text-slate-400">Port 465 (SSL) / 587 (TLS)</div>
            </div>

            {/* Brevo Option */}
            <div
              onClick={() => setProvider('brevo')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'brevo'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">API</span>
                  <input
                    type="radio"
                    name="provider_choice"
                    checked={provider === 'brevo'}
                    onChange={() => setProvider('brevo')}
                    className="text-indigo-600"
                  />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Brevo (Sendinblue)</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Direct HTTP relay API, free 300 emails/day.
                </p>
              </div>
              <div className="mt-3 text-[10px] font-medium text-slate-400">API Key integration</div>
            </div>

            {/* CRM Local / Simulated Mode */}
            <div
              onClick={() => setProvider('simulated')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                provider === 'simulated'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Zero API</span>
                  <input
                    type="radio"
                    name="provider_choice"
                    checked={provider === 'simulated'}
                    onChange={() => setProvider('simulated')}
                    className="text-indigo-600"
                  />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">CRM Local Sandbox</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Drafts follow-ups, records notes &amp; schedule, provides mailto fallback.
                </p>
              </div>
              <div className="mt-3 text-[10px] font-medium text-slate-400">No external key needed</div>
            </div>
          </div>

          {/* Sender Identity Section (Always Visible) */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              Sender Identity &amp; Branding
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={mailFrom}
                  onChange={(e) => setMailFrom(e.target.value)}
                  placeholder="e.g. info@nexintai.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  The email address clients see and reply to.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="e.g. NexInt AI Technologies"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  The sender name that appears in client inboxes.
                </p>
              </div>
            </div>
          </div>

          {/* Provider Specific Configuration Box */}
          {provider === 'resend' && (
            <div className="p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-600" />
                    Resend API Configuration
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Enter the API key generated in your Resend Dashboard.
                  </p>
                </div>
                <a
                  href="https://resend.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Get Resend Key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resend API Key (`re_...`)
                </label>
                <div className="relative">
                  <input
                    type={showResendKey ? 'text' : 'password'}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResendKey(!showResendKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Verified Domain Guidance */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Smart Domain Fallback Built-in: </span>
                  If your custom domain (`nexintai.com`) is still pending DNS verification in Resend, the system automatically routes the message through Resend&apos;s verified onboarding relay (`onboarding@resend.dev`) while keeping your <span className="font-semibold text-indigo-600 dark:text-indigo-400">reply-to</span> set to `{mailFrom}`.
                </div>
              </div>
            </div>
          )}

          {provider === 'smtp' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                Custom SMTP Server Credentials
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host *
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="e.g. smtp.gmail.com or smtp.zoho.in"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Port *
                  </label>
                  <input
                    type="number"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    placeholder="465 or 587"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Username / Email *
                  </label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="e.g. your-work-email@company.com"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Password / App Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {provider === 'brevo' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  Brevo API Key (`xkeysib-...`)
                </h3>
                <a
                  href="https://app.brevo.com/settings/keys/api"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Get Brevo Key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showBrevoKey ? 'text' : 'password'}
                  value={brevoApiKey}
                  onChange={(e) => setBrevoApiKey(e.target.value)}
                  placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowBrevoKey(!showBrevoKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showBrevoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving Changes...' : 'Save & Activate Provider'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Automation Rules & Cadence */}
      {activeTab === 'automation' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Follow-Up Cadence &amp; Automation Rules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Follow-up Interval
                </label>
                <select
                  value={defaultInterval}
                  onChange={(e) => setDefaultInterval(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value={2}>Every 2 Days (High urgency / Active negotiation)</option>
                  <option value={3}>Every 3 Days (Fast-paced deals)</option>
                  <option value={4}>Every 4 Days (Standard Recommended Cadence)</option>
                  <option value={7}>Every 7 Days (Weekly check-in)</option>
                  <option value={14}>Every 14 Days (Bi-weekly nurturing)</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  When a follow-up email is sent, the next follow-up date advances by this interval.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Note Author Attribution
                </label>
                <input
                  type="text"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                  placeholder="e.g. login 1 or NexCRM Automated Bot"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Recorded in Lead Work Notes when emails are dispatched automatically in batch runs.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Automatically roll forward Next Follow-up Date on email dispatch
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Ensures leads don&apos;t stay flagged as overdue once contacted.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoLogNote}
                  onChange={(e) => setAutoLogNote(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Auto-create Lead Work Note upon dispatch
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Appends an audit log with timestamp, subject, and delivery provider to the lead&apos;s activity history.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving Settings...' : 'Save Automation Rules'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Live Deliverability Test */}
      {activeTab === 'testing' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                Live Inbox Deliverability Test
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Send a real test email through your active provider ({activeProviderName}) to confirm end-to-end delivery before messaging actual clients.
              </p>
            </div>

            <form onSubmit={handleTestEmail} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter your personal or work email address..."
                className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="submit"
                disabled={testingSend}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {testingSend ? 'Dispatching Test Email...' : 'Send Test Email'}
              </button>
            </form>

            {/* Test Results Output Card */}
            {testResult && (
              <div
                className={`p-4 rounded-xl border mt-4 ${
                  testResult.success
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <h4
                    className={`text-sm font-bold ${
                      testResult.success
                        ? 'text-emerald-900 dark:text-emerald-100'
                        : 'text-rose-900 dark:text-rose-100'
                    }`}
                  >
                    {testResult.success ? 'Test Email Successfully Dispatched!' : 'Delivery Notice / Failure'}
                  </h4>
                </div>

                <div className="mt-2.5 space-y-1 text-xs text-slate-700 dark:text-slate-300 font-mono">
                  <div>
                    <span className="font-semibold text-slate-500">Transport:</span> {testResult.provider}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Latency:</span> {testResult.latencyMs}ms
                  </div>
                  {testResult.messageId && (
                    <div className="truncate">
                      <span className="font-semibold text-slate-500">Message ID:</span> {testResult.messageId}
                    </div>
                  )}
                  {testResult.error && (
                    <div className="text-rose-600 dark:text-rose-400 font-sans mt-2">
                      <span className="font-bold">Error Diagnosis:</span> {testResult.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Sent Email Logs */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Dispatched Follow-up History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit log of automated batch runs and manual follow-up emails sent through the CRM.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              Refresh Logs
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No follow-up emails have been dispatched yet. When emails are sent, they will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Dispatched At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{log.recipient_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{log.recipient_email}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">
                        {log.subject}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{log.provider}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'Sent'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : log.status === 'Simulated'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {log.status === 'Sent' && <CheckCircle2 className="w-3 h-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                        {formatDateTime(log.sent_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

