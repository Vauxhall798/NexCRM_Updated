import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Server,
  FileJson,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

interface DatabaseStatus {
  engine: string;
  path: string;
  is_persistent: boolean;
  storage_type: string;
  file_size_bytes: number;
  last_modified: string | null;
  table_counts: Record<string, number>;
  total_records: number;
}

interface DatabaseModalProps {
  open: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  open,
  onClose,
  onDataRestored,
}) => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'guide'>('status');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ database: DatabaseStatus }>('/system/database/status');
      setStatus(res.database);
    } catch (err) {
      console.warn('Could not fetch DB status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open]);

  // Download Full Database Snapshot
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backupData = await apiFetch<Record<string, any>>('/system/database/backup');
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `nexcrm_database_backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Database backup successfully exported (${backupData.total_records} records)!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export backup', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Restore Database from Snapshot JSON file
  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to restore database from "${file.name}"? This will sync all records from the snapshot.`)) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed?.data) {
        throw new Error('Invalid NexCRM backup format. Missing "data" root.');
      }

      const res = await apiFetch<{ message: string; total_restored: number }>('/system/database/restore', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });

      showToast(`Success! ${res.total_restored} records restored.`);
      fetchStatus();
      if (onDataRestored) onDataRestored();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restore database from file', 'error');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Backend Database &amp; Data Persistence"
      subtitle="Manage persistent cloud storage, disk volumes, and 1-click database backup/restore."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`pb-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Live Database &amp; Backup Tools
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            How to Set Up Permanent Cloud Storage
          </button>
        </div>

        {activeTab === 'status' ? (
          <div className="space-y-4">
            {/* Storage Health Warning / Success Banner */}
            {status && (
              <div>
                {!status.is_persistent ? (
                  <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Notice: Running on Ephemeral Container Storage (Render Default)
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                      On cloud hosting like Render Web Services, the container filesystem resets on every new Git push or deploy.
                      To preserve data permanently, connect a <strong>Render Persistent Disk</strong> (see the setup guide tab) or download backups below.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong>Persistent Storage Active</strong>: Database is stored on <code>{status.storage_type}</code>. Your records will survive all future code deployments!
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Records</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {status?.total_records ?? '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Storage Engine</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block">
                  {status?.engine ?? 'SQLite (WAL)'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Database Size</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {status ? formatBytes(status.file_size_bytes) : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Persistence</span>
                <span className={`text-xs font-bold ${status?.is_persistent ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {status?.is_persistent ? 'Persistent' : 'Ephemeral'}
                </span>
              </div>
            </div>

            {/* Backup & Restore Action Buttons */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                1-Click Backup &amp; Instant Data Restoration
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download a complete snapshot of all leads, payments, conversions, clients, invoices, and notes. If a deployment ever resets the container, restore it in 2 seconds.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {exporting ? 'Exporting...' : 'Download Full Database Snapshot (.json)'}
                </button>

                <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {restoring ? 'Restoring Data...' : 'Restore from Snapshot File'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileRestore}
                    disabled={restoring}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={fetchStatus}
                  disabled={loading}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title="Refresh Database Status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Table Counts Breakdown */}
            {status?.table_counts && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Database Records by Table:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  {Object.entries(status.table_counts).map(([tbl, count]) => (
                    <div key={tbl} className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-0.5">
                      <span>{tbl}:</span>
                      <strong className="text-slate-900 dark:text-slate-100">{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Guide Tab */
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
              <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-sm">
                Why does data disappear on new code deployments?
              </h4>
              <p className="leading-relaxed">
                When you deploy new code to hosting services like Render, they spin up a fresh virtual container with a clean disk and delete the old container.
                Since SQLite defaults to writing to <code>prisma/dev.db</code> inside that container, the database file gets wiped on every deploy unless saved to persistent storage.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-indigo-600" />
                  Option 1: Add a Persistent Disk on Render (Zero Code Changes)
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <li>Go to your Render Dashboard &rarr; Click your <strong>nexcrm-backend</strong> Web Service.</li>
                  <li>Click the <strong>Disks</strong> tab on the left menu &rarr; Click <strong>Add Disk</strong>.</li>
                  <li>Set <strong>Mount Path</strong> to <code>/var/data</code> and Size to <code>1 GB</code>.</li>
                  <li>Go to the <strong>Environment</strong> tab &rarr; Add environment variable:
                    <div className="mt-1 font-mono bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400">
                      DATABASE_PATH=/var/data/nexcrm.db
                    </div>
                  </li>
                  <li>Save changes. Render will restart the service with permanent disk storage!</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-indigo-600" />
                  Option 2: Automatic Git Snapshot Sync (Free on Any Plan)
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Click <strong>Download Full Database Snapshot</strong> from the tools tab, rename the file to <code>auto_backup.json</code>, and place it in <code>backend/prisma/auto_backup.json</code>.
                  Whenever you deploy new code, NexCRM automatically detects it on startup and restores your live database automatically!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
