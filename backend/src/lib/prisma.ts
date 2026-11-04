import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
// @ts-ignore - node:sqlite is built-in in Node 22+
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, '..', '..', 'prisma', 'dev.db');
let rawPath = process.env.DATABASE_PATH || process.env.DATABASE_URL;
if (rawPath && rawPath.startsWith('file:')) {
  rawPath = rawPath.replace(/^file:/, '');
}
const dbPath = rawPath ? path.resolve(rawPath) : defaultPath;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

// Enable foreign keys and initialize all tables matching prisma/schema.prisma
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "created_at" TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "budget" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'New',
    "owner_id" TEXT,
    "next_followup" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "LeadNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE,
    FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "Conversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL UNIQUE,
    "outcome" TEXT NOT NULL DEFAULT 'in_progress',
    "reason" TEXT,
    "comment" TEXT,
    "deal_value" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "decided_at" TEXT,
    "history" TEXT NOT NULL DEFAULT '[]',
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT UNIQUE,
    "company" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT NOT NULL DEFAULT '',
    "became_client_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "ClientNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE,
    FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "service_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "budget" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "manager_id" TEXT,
    "tech_stack" TEXT NOT NULL DEFAULT '',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progress_override" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE,
    FOREIGN KEY ("manager_id") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "TimelineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'Task',
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "assignee_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE,
    FOREIGN KEY ("assignee_id") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "sentiment" TEXT NOT NULL DEFAULT 'Positive',
    "category" TEXT NOT NULL DEFAULT 'Delivery Quality',
    "comment" TEXT NOT NULL,
    "action_taken" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Reviewed',
    "submitted_by" TEXT NOT NULL DEFAULT '',
    "feedback_date" TEXT NOT NULL,
    "recorded_by" TEXT,
    "is_testimonial" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE,
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL,
    FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "BauTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket_number" TEXT NOT NULL UNIQUE,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Bug / Defect',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "state" TEXT NOT NULL DEFAULT 'New',
    "reported_by" TEXT NOT NULL DEFAULT '',
    "assignee_id" TEXT,
    "resolution_notes" TEXT NOT NULL DEFAULT '',
    "sla_due_date" TEXT,
    "resolved_at" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE,
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE,
    FOREIGN KEY ("assignee_id") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "role_title" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'Engineering',
    "seniority" TEXT NOT NULL DEFAULT 'Senior',
    "skills" TEXT NOT NULL DEFAULT '',
    "total_capacity" INTEGER NOT NULL DEFAULT 100,
    "hourly_rate" REAL NOT NULL DEFAULT 85,
    "on_leave" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "ResourceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "assignment_role" TEXT NOT NULL DEFAULT 'Software Engineer',
    "allocation_pct" INTEGER NOT NULL DEFAULT 50,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("resource_id") REFERENCES "Resource"("id") ON DELETE CASCADE,
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposal_number" TEXT NOT NULL UNIQUE,
    "lead_id" TEXT,
    "client_id" TEXT,
    "company_name" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "project_title" TEXT NOT NULL,
    "service_type" TEXT NOT NULL DEFAULT 'Custom software',
    "budget" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timeline_weeks" INTEGER NOT NULL DEFAULT 8,
    "key_requirements" TEXT NOT NULL DEFAULT '',
    "email_subject" TEXT NOT NULL,
    "email_body" TEXT NOT NULL,
    "html_proposal" TEXT NOT NULL,
    "ai_model" TEXT NOT NULL DEFAULT 'Gemini Argon AI',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "sent_at" TEXT,
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL,
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL,
    FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "ProjectCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Cloud / Infrastructure',
    "vendor_or_resource" TEXT NOT NULL DEFAULT '',
    "amount" REAL NOT NULL DEFAULT 0,
    "incurred_date" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE,
    FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL
  );

  -- Migrate any legacy non-INR records to INR for Indian IT company standardization
  UPDATE "ProjectCost"
  SET "amount" = "amount" * 10
  WHERE "project_id" IN (SELECT "id" FROM "Project" WHERE "currency" != 'INR');

  UPDATE "Project"
  SET "budget" = CASE WHEN "budget" < 250000 THEN "budget" * 10 ELSE "budget" END,
      "currency" = 'INR'
  WHERE "currency" != 'INR';

  UPDATE "Lead"
  SET "budget" = CASE WHEN "budget" < 250000 THEN "budget" * 10 ELSE "budget" END,
      "currency" = 'INR'
  WHERE "currency" != 'INR';

  UPDATE "Conversion"
  SET "deal_value" = CASE WHEN "deal_value" IS NOT NULL AND "deal_value" < 250000 THEN "deal_value" * 10 ELSE "deal_value" END,
      "currency" = 'INR'
  WHERE "currency" != 'INR';

  UPDATE "Proposal"
  SET "budget" = CASE WHEN "budget" < 250000 THEN "budget" * 10 ELSE "budget" END,
      "currency" = 'INR'
  WHERE "currency" != 'INR';

  UPDATE "Resource"
  SET "hourly_rate" = "hourly_rate" * 20
  WHERE "hourly_rate" < 500;

  -- Migrate legacy service types to the 4 core services: 'AI services', 'Data Engineering', 'Idea to Launch', 'Others'
  UPDATE "Lead"
  SET "service" = CASE
    WHEN "service" IN ('Other', 'Others') THEN 'Others'
    WHEN "service" IN ('Cloud/DevOps') THEN 'Data Engineering'
    WHEN "service" IN ('Web development', 'Mobile app', 'UI/UX') THEN 'Idea to Launch'
    ELSE 'AI services'
  END
  WHERE "service" NOT IN ('AI services', 'Data Engineering', 'Idea to Launch', 'Others');

  UPDATE "Project"
  SET "service_type" = CASE
    WHEN "service_type" IN ('Other', 'Others') THEN 'Others'
    WHEN "service_type" IN ('Cloud/DevOps') THEN 'Data Engineering'
    WHEN "service_type" IN ('Web development', 'Mobile app', 'UI/UX') THEN 'Idea to Launch'
    ELSE 'AI services'
  END
  WHERE "service_type" NOT IN ('AI services', 'Data Engineering', 'Idea to Launch', 'Others');

  UPDATE "Proposal"
  SET "service_type" = CASE
    WHEN "service_type" IN ('Other', 'Others') THEN 'Others'
    WHEN "service_type" IN ('Cloud/DevOps') THEN 'Data Engineering'
    WHEN "service_type" IN ('Web development', 'Mobile app', 'UI/UX') THEN 'Idea to Launch'
    ELSE 'AI services'
  END
  WHERE "service_type" NOT IN ('AI services', 'Data Engineering', 'Idea to Launch', 'Others');

  -- Ensure default admin user always exists with password Admin123!
  INSERT OR IGNORE INTO "User" ("id", "name", "email", "password_hash", "role", "created_at")
  VALUES (
    'admin-root-user-id',
    'NexInt AI admin',
    'admin@nexcrm.io',
    'scrypt$a1b2c3d4e5f678901234567890abcdef$66322d0118f4c63498721b960989d4727f69466a1235484eec1028cc7f8ae4d42376122a3cc95ca4656d21db33a7f6c91ac13683bddc12e3b33af45c11221326',
    'ADMIN',
    '2026-11-01T00:00:00.000Z'
  );

  UPDATE "User"
  SET "name" = 'NexInt AI admin',
      "role" = 'ADMIN'
  WHERE "email" = 'admin@nexcrm.io';
`);

function toIso(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function applySelect(row: any, select?: Record<string, boolean>): any {
  if (!row || !select) return row;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(select)) {
    if (v && k in row) out[k] = row[k];
  }
  return out;
}

function matchesWhere(row: any, where?: Record<string, any>): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR' && Array.isArray(cond)) {
      const anyMatch = cond.some((subCond) => matchesWhere(row, subCond));
      if (!anyMatch) return false;
      continue;
    }
    const val = row[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('contains' in cond) {
        const needle = String(cond.contains).toLowerCase();
        const hay = String(val ?? '').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if ('gte' in cond) {
        const minTime = new Date(cond.gte).getTime();
        const rowTime = val ? new Date(val).getTime() : 0;
        if (rowTime < minTime) return false;
      }
      if ('lte' in cond) {
        const maxTime = new Date(cond.lte).getTime();
        const rowTime = val ? new Date(val).getTime() : 0;
        if (rowTime > maxTime) return false;
      }
    } else {
      if (val !== cond) return false;
    }
  }
  return true;
}

function sortRows(rows: any[], orderBy?: any): any[] {
  if (!orderBy) return rows;
  const criteria = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const crit of criteria) {
      const [field, dir] = Object.entries(crit)[0] as [string, 'asc' | 'desc'];
      const va = a[field] ?? '';
      const vb = b[field] ?? '';
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

function getAllRows(table: string): any[] {
  const rows = db.prepare(`SELECT * FROM "${table}"`).all() as any[];
  if (table === 'Project') {
    return rows.map((r) => ({ ...r, progress_override: Boolean(r.progress_override) }));
  }
  if (table === 'Feedback') {
    return rows.map((r) => ({ ...r, is_testimonial: Boolean(r.is_testimonial) }));
  }
  if (table === 'Resource') {
    return rows.map((r) => ({ ...r, on_leave: Boolean(r.on_leave) }));
  }
  return rows;
}

function hydrateRelations(table: string, row: any, include?: Record<string, any>): any {
  if (!row || !include) return row;
  const result = { ...row };

  if (table === 'Lead') {
    if (include.owner) {
      const u = row.owner_id
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.owner_id) as any)
        : null;
      result.owner = u ? applySelect(u, include.owner.select) : null;
    }
    if (include.conversion) {
      result.conversion =
        (db.prepare(`SELECT * FROM "Conversion" WHERE lead_id = ?`).get(row.id) as any) || null;
    }
    if (include.client) {
      const c = (db.prepare(`SELECT * FROM "Client" WHERE lead_id = ?`).get(row.id) as any) || null;
      result.client = c ? applySelect(c, include.client.select) : null;
    }
    if (include.lead_notes) {
      let notes = db
        .prepare(`SELECT * FROM "LeadNote" WHERE lead_id = ?`)
        .all(row.id) as any[];
      const noteOpts = typeof include.lead_notes === 'object' ? include.lead_notes : {};
      if (noteOpts.orderBy) notes = sortRows(notes, noteOpts.orderBy);
      if (noteOpts.include?.author) {
        notes = notes.map((n) => hydrateRelations('LeadNote', n, noteOpts.include));
      }
      result.lead_notes = notes;
    }
  } else if (table === 'LeadNote') {
    if (include.author) {
      const u = row.created_by
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.created_by) as any)
        : null;
      result.author = u ? applySelect(u, include.author.select) : null;
    }
  } else if (table === 'Conversion') {
    if (include.lead) {
      const l = (db.prepare(`SELECT * FROM "Lead" WHERE id = ?`).get(row.lead_id) as any) || null;
      const leadOpts = typeof include.lead === 'object' ? include.lead : {};
      result.lead = l ? hydrateRelations('Lead', l, leadOpts.include) : null;
    }
  } else if (table === 'Client') {
    if (include.lead) {
      const l = row.lead_id
        ? (db.prepare(`SELECT * FROM "Lead" WHERE id = ?`).get(row.lead_id) as any)
        : null;
      result.lead = l ? applySelect(l, include.lead.select) : null;
    }
    if (include.projects) {
      let projs = (
        db.prepare(`SELECT * FROM "Project" WHERE client_id = ?`).all(row.id) as any[]
      ).map((p) => ({ ...p, progress_override: Boolean(p.progress_override) }));
      const projOpts = typeof include.projects === 'object' ? include.projects : {};
      if (projOpts.orderBy) projs = sortRows(projs, projOpts.orderBy);
      if (projOpts.include) {
        projs = projs.map((p) => hydrateRelations('Project', p, projOpts.include));
      }
      result.projects = projs;
    }
    if (include.client_notes) {
      let notes = db
        .prepare(`SELECT * FROM "ClientNote" WHERE client_id = ?`)
        .all(row.id) as any[];
      const noteOpts = typeof include.client_notes === 'object' ? include.client_notes : {};
      if (noteOpts.orderBy) notes = sortRows(notes, noteOpts.orderBy);
      if (noteOpts.include) {
        notes = notes.map((n) => hydrateRelations('ClientNote', n, noteOpts.include));
      }
      result.client_notes = notes;
    }
  } else if (table === 'ClientNote') {
    if (include.author) {
      const u = row.created_by
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.created_by) as any)
        : null;
      result.author = u ? applySelect(u, include.author.select) : null;
    }
  } else if (table === 'Project') {
    if (include.client) {
      const c =
        (db.prepare(`SELECT * FROM "Client" WHERE id = ?`).get(row.client_id) as any) || null;
      result.client = c ? applySelect(c, include.client.select) : null;
    }
    if (include.manager) {
      const u = row.manager_id
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.manager_id) as any)
        : null;
      result.manager = u ? applySelect(u, include.manager.select) : null;
    }
    if (include.timeline_entries) {
      let entries = db
        .prepare(`SELECT * FROM "TimelineEntry" WHERE project_id = ?`)
        .all(row.id) as any[];
      const entryOpts =
        typeof include.timeline_entries === 'object' ? include.timeline_entries : {};
      if (entryOpts.orderBy) entries = sortRows(entries, entryOpts.orderBy);
      if (entryOpts.include) {
        entries = entries.map((e) => hydrateRelations('TimelineEntry', e, entryOpts.include));
      }
      result.timeline_entries = entries;
    }
    if (include.project_costs) {
      let costs = db
        .prepare(`SELECT * FROM "ProjectCost" WHERE project_id = ?`)
        .all(row.id) as any[];
      const costOpts =
        typeof include.project_costs === 'object' ? include.project_costs : {};
      if (costOpts.orderBy) costs = sortRows(costs, costOpts.orderBy);
      if (costOpts.include) {
        costs = costs.map((c) => hydrateRelations('ProjectCost', c, costOpts.include));
      }
      result.project_costs = costs;
    }
  } else if (table === 'ProjectCost') {
    if (include.author) {
      const u = row.created_by
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.created_by) as any)
        : null;
      result.author = u ? applySelect(u, include.author.select) : null;
    }
  } else if (table === 'TimelineEntry') {
    if (include.project) {
      const pRaw =
        (db.prepare(`SELECT * FROM "Project" WHERE id = ?`).get(row.project_id) as any) || null;
      if (pRaw) {
        const p = { ...pRaw, progress_override: Boolean(pRaw.progress_override) };
        if (include.project.select) {
          const selected = applySelect(p, include.project.select);
          if (include.project.select.client) {
            const c =
              (db.prepare(`SELECT * FROM "Client" WHERE id = ?`).get(p.client_id) as any) || null;
            selected.client = c ? applySelect(c, include.project.select.client.select) : null;
          }
          result.project = selected;
        } else {
          result.project = p;
        }
      } else {
        result.project = null;
      }
    }
    if (include.assignee) {
      const u = row.assignee_id
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.assignee_id) as any)
        : null;
      result.assignee = u ? applySelect(u, include.assignee.select) : null;
    }
  } else if (table === 'Feedback') {
    if (include.client) {
      const c =
        (db.prepare(`SELECT * FROM "Client" WHERE id = ?`).get(row.client_id) as any) || null;
      result.client = c ? applySelect(c, include.client.select) : null;
    }
    if (include.project) {
      const p = row.project_id
        ? (db.prepare(`SELECT * FROM "Project" WHERE id = ?`).get(row.project_id) as any)
        : null;
      result.project = p ? applySelect(p, include.project.select) : null;
    }
    if (include.recorder) {
      const u = row.recorded_by
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.recorded_by) as any)
        : null;
      result.recorder = u ? applySelect(u, include.recorder.select) : null;
    }
  } else if (table === 'BauTicket') {
    if (include.client) {
      const c =
        (db.prepare(`SELECT * FROM "Client" WHERE id = ?`).get(row.client_id) as any) || null;
      result.client = c ? applySelect(c, include.client.select) : null;
    }
    if (include.project) {
      const p =
        (db.prepare(`SELECT * FROM "Project" WHERE id = ?`).get(row.project_id) as any) || null;
      result.project = p ? applySelect(p, include.project.select) : null;
    }
    if (include.assignee) {
      const u = row.assignee_id
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.assignee_id) as any)
        : null;
      result.assignee = u ? applySelect(u, include.assignee.select) : null;
    }
  } else if (table === 'Resource') {
    if (include.assignments) {
      let assigns = db
        .prepare(`SELECT * FROM "ResourceAssignment" WHERE resource_id = ?`)
        .all(row.id) as any[];
      const assignOpts =
        typeof include.assignments === 'object' ? include.assignments : {};
      if (assignOpts.orderBy) assigns = sortRows(assigns, assignOpts.orderBy);
      if (assignOpts.include) {
        assigns = assigns.map((a) =>
          hydrateRelations('ResourceAssignment', a, assignOpts.include)
        );
      }
      result.assignments = assigns;
    }
  } else if (table === 'ResourceAssignment') {
    if (include.resource) {
      const rRaw =
        (db.prepare(`SELECT * FROM "Resource" WHERE id = ?`).get(row.resource_id) as any) ||
        null;
      const r = rRaw ? { ...rRaw, on_leave: Boolean(rRaw.on_leave) } : null;
      result.resource = r ? applySelect(r, include.resource.select) : null;
    }
    if (include.project) {
      const pRaw =
        (db.prepare(`SELECT * FROM "Project" WHERE id = ?`).get(row.project_id) as any) || null;
      if (pRaw) {
        const p = { ...pRaw, progress_override: Boolean(pRaw.progress_override) };
        const selected = include.project.select ? applySelect(p, include.project.select) : p;
        if (include.project.include?.client || include.project.select?.client) {
          const c =
            (db.prepare(`SELECT * FROM "Client" WHERE id = ?`).get(p.client_id) as any) || null;
          selected.client = c;
        }
        result.project = selected;
      } else {
        result.project = null;
      }
    }
  } else if (table === 'Proposal') {
    if (include.lead) {
      const l = row.lead_id
        ? (db.prepare(`SELECT * FROM "Lead" WHERE id = ?`).get(row.lead_id) as any)
        : null;
      result.lead = l ? applySelect(l, include.lead.select) : null;
    }
    if (include.client) {
      const c = row.client_id
        ? (db.prepare(`SELECT * FROM "Client" WHERE id = ?`).get(row.client_id) as any)
        : null;
      result.client = c ? applySelect(c, include.client.select) : null;
    }
    if (include.author) {
      const u = row.created_by
        ? (db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(row.created_by) as any)
        : null;
      result.author = u ? applySelect(u, include.author.select) : null;
    }
  }

  return result;
}

function createModelDelegate(table: string, defaults: () => Record<string, any>) {
  return {
    async findMany(args: any = {}): Promise<any[]> {
      let rows = getAllRows(table).filter((r) => matchesWhere(r, args.where));
      if (args.orderBy) rows = sortRows(rows, args.orderBy);
      if (typeof args.take === 'number') rows = rows.slice(0, args.take);
      return rows.map((r) => {
        const hydrated = hydrateRelations(table, r, args.include);
        return args.select ? applySelect(hydrated, args.select) : hydrated;
      });
    },

    async findUnique(args: { where: Record<string, any>; include?: any; select?: any }): Promise<any> {
      const rows = getAllRows(table).filter((r) => matchesWhere(r, args.where));
      const row = rows[0] || null;
      if (!row) return null;
      const hydrated = hydrateRelations(table, row, args.include);
      return args.select ? applySelect(hydrated, args.select) : hydrated;
    },

    async count(args: { where?: Record<string, any> } = {}): Promise<number> {
      return getAllRows(table).filter((r) => matchesWhere(r, args.where)).length;
    },

    async create(args: { data: Record<string, any>; include?: any; select?: any }): Promise<any> {
      const record: Record<string, any> = {
        id: crypto.randomUUID(),
        ...defaults(),
        ...args.data,
      };

      for (const [k, v] of Object.entries(record)) {
        if (v instanceof Date) {
          record[k] = v.toISOString();
        } else if (typeof v === 'boolean') {
          record[k] = v ? 1 : 0;
        }
      }

      const keys = Object.keys(record);
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map((k) => record[k]);

      db.prepare(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`).run(...values);

      return this.findUnique({
        where: { id: record.id },
        include: args.include,
        select: args.select,
      });
    },

    async createMany(args: { data: Array<Record<string, any>> }): Promise<{ count: number }> {
      for (const item of args.data) {
        await this.create({ data: item });
      }
      return { count: args.data.length };
    },

    async update(args: {
      where: Record<string, any>;
      data: Record<string, any>;
      include?: any;
      select?: any;
    }): Promise<any> {
      const existing = await this.findUnique({ where: args.where });
      if (!existing) throw new Error(`${table} record not found`);

      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(args.data)) {
        if (v === undefined) continue;
        if (v instanceof Date) updates[k] = v.toISOString();
        else if (typeof v === 'boolean') updates[k] = v ? 1 : 0;
        else updates[k] = v;
      }

      const keys = Object.keys(updates);
      if (keys.length > 0) {
        const setClause = keys.map((k) => `"${k}" = ?`).join(', ');
        const values = keys.map((k) => updates[k]);
        db.prepare(`UPDATE "${table}" SET ${setClause} WHERE id = ?`).run(...values, existing.id);
      }

      return this.findUnique({
        where: { id: existing.id },
        include: args.include,
        select: args.select,
      });
    },

    async upsert(args: {
      where: Record<string, any>;
      update: Record<string, any>;
      create: Record<string, any>;
    }): Promise<any> {
      const existing = await this.findUnique({ where: args.where });
      if (existing) {
        return this.update({ where: { id: existing.id }, data: args.update });
      }
      return this.create({ data: args.create });
    },

    async delete(args: { where: Record<string, any> }): Promise<any> {
      const existing = await this.findUnique({ where: args.where });
      if (!existing) throw new Error(`${table} record not found`);
      db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(existing.id);
      return existing;
    },

    async deleteMany(args: { where?: Record<string, any> } = {}): Promise<{ count: number }> {
      if (!args.where || Object.keys(args.where).length === 0) {
        const all = getAllRows(table);
        db.prepare(`DELETE FROM "${table}"`).run();
        return { count: all.length };
      }
      const matching = getAllRows(table).filter((r) => matchesWhere(r, args.where));
      for (const row of matching) {
        db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(row.id);
      }
      return { count: matching.length };
    },
  };
}

export const prisma = {
  user: createModelDelegate('User', () => ({
    role: 'MEMBER',
    created_at: toIso(new Date()),
  })),
  lead: createModelDelegate('Lead', () => ({
    budget: 0,
    currency: 'INR',
    status: 'New',
    owner_id: null,
    next_followup: null,
    notes: '',
    created_at: toIso(new Date()),
  })),
  leadNote: createModelDelegate('LeadNote', () => ({
    created_by: null,
    created_at: toIso(new Date()),
  })),
  conversion: createModelDelegate('Conversion', () => ({
    outcome: 'in_progress',
    reason: null,
    comment: null,
    deal_value: null,
    currency: 'INR',
    decided_at: null,
    history: '[]',
    created_at: toIso(new Date()),
  })),
  client: createModelDelegate('Client', () => ({
    lead_id: null,
    address: '',
    website: '',
    industry: '',
    status: 'Active',
    notes: '',
    became_client_at: toIso(new Date()),
    created_at: toIso(new Date()),
  })),
  clientNote: createModelDelegate('ClientNote', () => ({
    created_by: null,
    created_at: toIso(new Date()),
  })),
  project: createModelDelegate('Project', () => ({
    description: '',
    status: 'Planned',
    budget: 0,
    currency: 'INR',
    manager_id: null,
    tech_stack: '',
    progress: 0,
    progress_override: 0,
    notes: '',
    created_at: toIso(new Date()),
  })),
  timelineEntry: createModelDelegate('TimelineEntry', () => ({
    description: '',
    type: 'Task',
    end_date: null,
    status: 'Planned',
    assignee_id: null,
    sort_order: 0,
    created_at: toIso(new Date()),
  })),
  feedback: createModelDelegate('Feedback', () => ({
    project_id: null,
    rating: 5,
    sentiment: 'Positive',
    category: 'Delivery Quality',
    action_taken: '',
    status: 'Reviewed',
    submitted_by: '',
    feedback_date: toIso(new Date()),
    recorded_by: null,
    is_testimonial: 0,
    created_at: toIso(new Date()),
  })),
  bauTicket: createModelDelegate('BauTicket', () => ({
    description: '',
    category: 'Bug / Defect',
    priority: 'Medium',
    state: 'New',
    reported_by: '',
    assignee_id: null,
    resolution_notes: '',
    sla_due_date: null,
    resolved_at: null,
    created_at: toIso(new Date()),
  })),
  resource: createModelDelegate('Resource', () => ({
    department: 'Engineering',
    seniority: 'Senior',
    skills: '',
    total_capacity: 100,
    hourly_rate: 2500,
    on_leave: 0,
    notes: '',
    created_at: toIso(new Date()),
  })),
  resourceAssignment: createModelDelegate('ResourceAssignment', () => ({
    assignment_role: 'Software Engineer',
    allocation_pct: 50,
    status: 'Active',
    notes: '',
    created_at: toIso(new Date()),
  })),
  proposal: createModelDelegate('Proposal', () => ({
    lead_id: null,
    client_id: null,
    service_type: 'AI services',
    budget: 0,
    currency: 'INR',
    timeline_weeks: 8,
    key_requirements: '',
    ai_model: 'NexInt AI',
    status: 'Draft',
    sent_at: null,
    created_by: null,
    created_at: toIso(new Date()),
  })),
  projectCost: createModelDelegate('ProjectCost', () => ({
    category: 'Cloud / Infrastructure',
    vendor_or_resource: '',
    amount: 0,
    incurred_date: toIso(new Date()),
    notes: '',
    created_by: null,
    created_at: toIso(new Date()),
  })),
  async $transaction(promises: Promise<any>[]): Promise<any[]> {
    return Promise.all(promises);
  },
  async $disconnect(): Promise<void> {
    // SQLite DatabaseSync closes automatically on process exit
  },
};
