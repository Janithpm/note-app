import { useCallback, useSyncExternalStore } from "react";

import { normalizeRouteOwner } from "@/lib/workspace-query";

const RECENTS_KEY_PREFIX = "note-app:recents:";
const RECENTS_CHANGED_EVENT = "note-app:recents-changed";
const MAX_RECENTS = 12;

export type RecentNote = {
  path: string;
  openedAt: number;
};

function storageKey(routeOwner: string | null | undefined) {
  return `${RECENTS_KEY_PREFIX}${normalizeRouteOwner(routeOwner)}`;
}

export function getRecentNotes(routeOwner: string | null | undefined): RecentNote[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey(routeOwner));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is RecentNote =>
        typeof entry?.path === "string" && typeof entry?.openedAt === "number"
    );
  } catch {
    return [];
  }
}

export function recordRecentNote(
  routeOwner: string | null | undefined,
  path: string
): void {
  if (typeof window === "undefined" || !path) {
    return;
  }
  try {
    const existing = getRecentNotes(routeOwner).filter(
      (entry) => entry.path !== path
    );
    const next = [{ path, openedAt: Date.now() }, ...existing].slice(
      0,
      MAX_RECENTS
    );
    window.localStorage.setItem(storageKey(routeOwner), JSON.stringify(next));
    window.dispatchEvent(new Event(RECENTS_CHANGED_EVENT));
  } catch {
    // Ignore quota / private-mode failures — recents are a non-critical nicety.
  }
}

export function clearRecentNotes(routeOwner: string | null | undefined): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey(routeOwner));
    window.dispatchEvent(new Event(RECENTS_CHANGED_EVENT));
  } catch {
    // Ignore.
  }
}

// Cached snapshot per storage key so useSyncExternalStore gets a stable
// reference (only a new array when the underlying raw value actually changes).
const snapshotCache = new Map<string, { raw: string; value: RecentNote[] }>();
const EMPTY_RECENTS: RecentNote[] = [];

function getRecentNotesSnapshot(
  routeOwner: string | null | undefined
): RecentNote[] {
  if (typeof window === "undefined") {
    return EMPTY_RECENTS;
  }
  const key = storageKey(routeOwner);
  const raw = window.localStorage.getItem(key) ?? "";
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.value;
  }
  const value = getRecentNotes(routeOwner);
  snapshotCache.set(key, { raw, value });
  return value;
}

/**
 * Reactive recents for the current workspace owner, backed by localStorage via
 * useSyncExternalStore. Updates when any code records a recent (window event),
 * when localStorage changes in another tab, and when the owner changes.
 */
export function useRecentNotes(
  routeOwner: string | null | undefined
): RecentNote[] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(RECENTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(RECENTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => getRecentNotesSnapshot(routeOwner),
    () => EMPTY_RECENTS
  );
}
