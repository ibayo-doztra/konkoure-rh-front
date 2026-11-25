const STORAGE_KEY = "konkoure:applied-jobs";

/** Public offers have no id: an application is remembered by its organization and job slugs. */
export const appliedKey = (orgSlug: string, jobSlug: string) => `${orgSlug}/${jobSlug}`;

type Entry = { appliedAt: string; deadline: string | null };
type Store = Record<string, Entry>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function isStillValid(entry: Entry): boolean {
  if (!entry.deadline) return true;
  const d = new Date(entry.deadline);
  if (isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now();
}

export function pruneExpired() {
  const store = read();
  let changed = false;
  for (const [k, v] of Object.entries(store)) {
    if (!isStillValid(v)) {
      delete store[k];
      changed = true;
    }
  }
  if (changed) write(store);
}

export function hasApplied(jobId: string, deadline?: string | null): boolean {
  const store = read();
  const entry = store[jobId];
  if (!entry) return false;
  if (!isStillValid(entry)) {
    delete store[jobId];
    write(store);
    return false;
  }
  // If the job's current deadline is past, no need to block anymore
  if (deadline) {
    const d = new Date(deadline);
    if (!isNaN(d.getTime()) && d.getTime() < Date.now()) return false;
  }
  return true;
}

export function markApplied(jobId: string, deadline?: string | null) {
  const store = read();
  store[jobId] = {
    appliedAt: new Date().toISOString(),
    deadline: deadline ?? null,
  };
  write(store);
}
