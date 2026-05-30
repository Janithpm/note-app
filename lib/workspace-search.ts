import { type WorkspaceTreeIndexEntry } from "@/app/workspace/actions";
import { isReservedWorkspaceSegment } from "@/lib/workspace";
import { type WorkspaceTreeItem } from "@/lib/workspace-query";

export type SearchableItem = {
  path: string;
  name: string;
  type: "dir" | "file";
  pending?: boolean;
  optimistic?: boolean;
};

export type RankedItem = SearchableItem & { score: number };

const DEFAULT_LIMIT = 50;

function isReservedPath(path: string) {
  const firstSegment = path.split("/").filter(Boolean)[0];
  return firstSegment ? isReservedWorkspaceSegment(firstSegment) : false;
}

export function treeItemsToSearchable(items: WorkspaceTreeItem[]): SearchableItem[] {
  return items
    .filter((item) => item.type === "dir" || item.type === "file")
    .map((item) => ({
      path: item.path,
      name: item.name,
      type: item.type === "dir" ? "dir" : "file",
      pending: item.pending,
      optimistic: item.optimistic,
    }));
}

export function indexEntriesToItems(
  entries: WorkspaceTreeIndexEntry[]
): SearchableItem[] {
  return entries.map((entry) => ({
    path: entry.path,
    name: entry.name,
    type: entry.type,
  }));
}

/**
 * Merges live-cache items over index items, deduped by path. Cache items win so
 * optimistic create/delete and pending flags from the in-memory cache override
 * the (possibly staler) recursive index.
 */
export function mergeSearchableItems(
  cacheItems: SearchableItem[],
  indexItems: SearchableItem[]
): SearchableItem[] {
  const byPath = new Map<string, SearchableItem>();
  for (const item of indexItems) {
    byPath.set(item.path, item);
  }
  for (const item of cacheItems) {
    byPath.set(item.path, item);
  }
  return [...byPath.values()].filter((item) => !isReservedPath(item.path));
}

function wordBoundaryStartsWith(name: string, query: string) {
  // Match the start of any segment split on space, hyphen, underscore, dot.
  return name
    .split(/[\s\-_.]+/)
    .some((segment) => segment.startsWith(query));
}

function isSubsequence(query: string, target: string) {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      qi++;
    }
  }
  return qi === query.length;
}

/** Returns the best match score for an item against the query, or -Infinity. */
function scoreItem(item: SearchableItem, query: string): number {
  const name = item.name.toLowerCase();
  const path = item.path.toLowerCase();

  let base: number;
  if (name === query) {
    base = 1000;
  } else if (name.startsWith(query)) {
    base = 800;
  } else if (wordBoundaryStartsWith(name, query)) {
    base = 700;
  } else if (name.includes(query)) {
    base = 500;
  } else if (path.includes(query)) {
    base = 300;
  } else if (isSubsequence(query, name)) {
    base = 150;
  } else {
    return -Infinity;
  }

  // Small bias so folders edge ahead on ties when the query has no extension hint.
  if (item.type === "dir" && !query.includes(".")) {
    base += 40;
  }
  return base;
}

/**
 * Ranks items for a query. Empty query returns [] (the palette shows recents
 * instead). Applies a recents boost, caps results, and tie-breaks by shorter
 * path (closer to root) then name.
 */
export function rankItems(
  items: SearchableItem[],
  query: string,
  opts?: { recentPaths?: string[]; limit?: number }
): RankedItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const recent = new Set(opts?.recentPaths ?? []);
  const ranked: RankedItem[] = [];

  for (const item of items) {
    let score = scoreItem(item, normalized);
    if (score === -Infinity) {
      continue;
    }
    if (recent.has(item.path)) {
      score += 120;
    }
    ranked.push({ ...item, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const depthA = a.path.split("/").length;
    const depthB = b.path.split("/").length;
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    return a.name.localeCompare(b.name);
  });

  return ranked.slice(0, opts?.limit ?? DEFAULT_LIMIT);
}
