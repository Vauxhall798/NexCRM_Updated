const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const AUTO_SNAPSHOT_KEY = 'nexcrm_auto_persistence_v2';

let hydrationChecked = false;
let hydrationPromise: Promise<void> | null = null;
let backupTimer: ReturnType<typeof setTimeout> | null = null;

const getCache = new Map<string, { data: unknown; timestamp: number }>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 12_000;

export function clearApiCache(): void {
  getCache.clear();
  inFlightGetRequests.clear();
}

export function getToken(): string | null {
  return localStorage.getItem('nexcrm_token');
}

export function setToken(token: string | null): void {
  clearApiCache();
  if (token) {
    localStorage.setItem('nexcrm_token', token);
  } else {
    localStorage.removeItem('nexcrm_token');
  }
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * Saves a live JSON snapshot of the database to localStorage after any CRM mutation
 * so that if an ephemeral cloud container restarts after inactivity, data is never lost.
 */
function scheduleAutoBackupSnapshot() {
  const token = getToken();
  if (!token) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/database/backup`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const snapshot = await res.json();
        if (snapshot?.data) {
          localStorage.setItem(AUTO_SNAPSHOT_KEY, JSON.stringify(snapshot));
        }
      }
    } catch {
      // ignore background backup errors
    }
  }, 600);
}

/**
 * Checks once per session whether the cloud backend container restarted with an empty DB
 * while localStorage holds a previously saved CRM snapshot, and transparently restores it.
 */
async function ensureHydratedFromSnapshotIfNeeded(token: string): Promise<void> {
  if (hydrationChecked) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    try {
      const rawSnapshot = localStorage.getItem(AUTO_SNAPSHOT_KEY);
      if (!rawSnapshot) {
        hydrationChecked = true;
        return;
      }
      const parsed = JSON.parse(rawSnapshot);
      const snapData = parsed?.data || {};
      const snapBusinessCount =
        (snapData.Lead?.length || 0) +
        (snapData.Client?.length || 0) +
        (snapData.Project?.length || 0) +
        (snapData.Expense?.length || 0) +
        (snapData.ClientPayment?.length || 0);

      if (snapBusinessCount === 0) {
        hydrationChecked = true;
        return;
      }

      const statusRes = await fetch(`${API_BASE}/system/database/status`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!statusRes.ok) {
        hydrationChecked = true;
        return;
      }
      const statusJson = await statusRes.json();
      const counts = statusJson?.database?.table_counts || {};
      const serverBusinessCount =
        (counts.Lead || 0) +
        (counts.Client || 0) +
        (counts.Project || 0) +
        (counts.Expense || 0) +
        (counts.ClientPayment || 0);

      // If server lost its business records due to container spin-down, auto-restore from snapshot
      if (serverBusinessCount === 0 && snapBusinessCount > 0) {
        await fetch(`${API_BASE}/system/database/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nexcrm_backup_version: '1.0',
            merge: true,
            data: snapData,
          }),
        });
      } else if (serverBusinessCount > 0) {
        // Server has live data — refresh local snapshot
        scheduleAutoBackupSnapshot();
      }
    } catch {
      // ignore hydration check errors
    } finally {
      hydrationChecked = true;
      hydrationPromise = null;
    }
  })();

  return hydrationPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const method = (options.method || 'GET').toUpperCase();

  if (
    token &&
    method === 'GET' &&
    !path.startsWith('/auth') &&
    !path.startsWith('/system')
  ) {
    // Run snapshot hydration check once per session without blocking subsequent module switches
    if (!hydrationChecked) {
      await ensureHydratedFromSnapshotIfNeeded(token);
    }

    const cached = getCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }

    const inFlight = inFlightGetRequests.get(path);
    if (inFlight) {
      return (await inFlight) as T;
    }
  } else if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    clearApiCache();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const performFetch = async (): Promise<T> => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.error || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    if (method === 'GET') {
      getCache.set(path, { data, timestamp: Date.now() });
    } else if (
      token &&
      (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') &&
      !path.startsWith('/auth') &&
      !path.startsWith('/proposals/generate') &&
      !path.startsWith('/automation/generate-draft')
    ) {
      clearApiCache();
      scheduleAutoBackupSnapshot();
    }

    return data as T;
  };

  if (method === 'GET') {
    const promise = performFetch().finally(() => {
      inFlightGetRequests.delete(path);
    });
    inFlightGetRequests.set(path, promise);
    return promise;
  }

  return performFetch();
}
