import fs from 'node:fs';
import path from 'node:path';
import { Router } from '../lib/http-app.ts';
import type { Response } from '../lib/http-app.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { db, resolvedDbPath } from '../lib/prisma.ts';

export const systemRouter = Router();
systemRouter.use(requireAuth);

const ALL_TABLES = [
  'User',
  'Lead',
  'LeadNote',
  'Conversion',
  'Client',
  'ClientNote',
  'Project',
  'ProjectCost',
  'TimelineEntry',
  'Feedback',
  'BauTicket',
  'Resource',
  'ResourceAssignment',
  'Proposal',
  'ClientPayment',
] as const;

// Get Database Storage Health & Status
systemRouter.get('/database/status', async (_req: AuthRequest, res: Response) => {
  try {
    const counts: Record<string, number> = {};
    for (const table of ALL_TABLES) {
      try {
        const row = db.prepare(`SELECT count(*) as c FROM "${table}"`).get() as { c: number } | undefined;
        counts[table] = row?.c || 0;
      } catch {
        counts[table] = 0;
      }
    }

    let fileSizeBytes = 0;
    let lastModified: string | null = null;
    try {
      const stat = fs.statSync(resolvedDbPath);
      fileSizeBytes = stat.size;
      lastModified = stat.mtime.toISOString();
    } catch {}

    // Check if running on a persistent mount (e.g. /var/data on Render or explicit non-relative path)
    const isRenderDisk = resolvedDbPath.startsWith('/var/data') || resolvedDbPath.startsWith('/data');
    const isCustomPath = Boolean(process.env.DATABASE_PATH);
    const isPersistent = isRenderDisk || (isCustomPath && !resolvedDbPath.includes('/backend/prisma'));

    res.json({
      database: {
        engine: 'SQLite (WAL Mode)',
        path: resolvedDbPath,
        is_persistent: isPersistent,
        storage_type: isRenderDisk ? 'Render Persistent Disk' : isCustomPath ? 'Custom Volume Path' : 'Ephemeral Container Storage',
        file_size_bytes: fileSizeBytes,
        last_modified: lastModified,
        table_counts: counts,
        total_records: Object.values(counts).reduce((a, b) => a + b, 0),
      },
    });
  } catch (err) {
    console.error('Error fetching database status:', err);
    res.status(500).json({ error: 'Failed to fetch database status' });
  }
});

// Full Database Backup Export
systemRouter.get('/database/backup', async (req: AuthRequest, res: Response) => {
  try {
    const dump: Record<string, any[]> = {};
    const summary: Record<string, number> = {};

    for (const table of ALL_TABLES) {
      try {
        const rows = db.prepare(`SELECT * FROM "${table}"`).all() as any[];
        dump[table] = rows;
        summary[table] = rows.length;
      } catch {
        dump[table] = [];
        summary[table] = 0;
      }
    }

    const payload = {
      nexcrm_backup_version: '1.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user?.email || 'admin@nexcrm.io',
      summary,
      total_records: Object.values(summary).reduce((a, b) => a + b, 0),
      data: dump,
    };

    res.json(payload);
  } catch (err) {
    console.error('Error generating database backup:', err);
    res.status(500).json({ error: 'Failed to generate database backup' });
  }
});

// Full Database Restore from Snapshot
systemRouter.post('/database/restore', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body as {
      nexcrm_backup_version?: string;
      data?: Record<string, any[]>;
    };

    if (!payload?.data || typeof payload.data !== 'object') {
      res.status(400).json({ error: 'Invalid backup format. Missing "data" object.' });
      return;
    }

    const data = payload.data;
    const restoredSummary: Record<string, number> = {};

    // Execute in a single transactional block with foreign keys disabled
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.exec('BEGIN TRANSACTION;');

      for (const table of ALL_TABLES) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          restoredSummary[table] = 0;
          continue;
        }

        // Clear existing data for table
        db.exec(`DELETE FROM "${table}";`);

        // Insert rows dynamically matching their keys
        let insertCount = 0;
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;

          const placeholders = keys.map(() => '?').join(', ');
          const quotedColumns = keys.map((k) => `"${k}"`).join(', ');
          const values = keys.map((k) => row[k]);

          const stmt = db.prepare(`INSERT OR REPLACE INTO "${table}" (${quotedColumns}) VALUES (${placeholders})`);
          stmt.run(...values);
          insertCount++;
        }
        restoredSummary[table] = insertCount;
      }

      db.exec('COMMIT;');
    } catch (restoreErr) {
      db.exec('ROLLBACK;');
      throw restoreErr;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }

    res.json({
      message: 'Database successfully restored from snapshot!',
      restored_at: new Date().toISOString(),
      summary: restoredSummary,
      total_restored: Object.values(restoredSummary).reduce((a, b) => a + b, 0),
    });
  } catch (err) {
    console.error('Error restoring database:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to restore database' });
  }
});
