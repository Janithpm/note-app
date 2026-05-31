import { isReservedWorkspaceSegment } from "@/lib/workspace";
import { type WorkspaceFileData } from "@/lib/workspace-query";

/** A note whose body matched a content query, with a preview snippet. */
export type ContentMatch = {
  path: string;
  name: string;
  /** Plain-text excerpt around the first match, with surrounding context. */
  snippet: string;
  /** Character offset of the matched term within `snippet` (for highlighting). */
  matchStart: number;
  matchLength: number;
  score: number;
  /** "local" = from the in-memory cache, "remote" = from GitHub code search. */
  source: "local" | "remote";
};

const SNIPPET_RADIUS = 48;
const DEFAULT_LIMIT = 30;

function isReservedPath(path: string) {
  const firstSegment = path.split("/").filter(Boolean)[0];
  return firstSegment ? isReservedWorkspaceSegment(firstSegment) : false;
}

function getBaseName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/** Collapse whitespace/newlines so a snippet reads as a single tidy line. */
function tidy(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Builds a snippet around the first occurrence of `query` in `content`.
 * Returns null when the term isn't present. Offsets refer to the *tidied*
 * snippet so the caller can highlight the exact match.
 */
function buildSnippet(content: string, query: string): {
  snippet: string;
  matchStart: number;
  matchLength: number;
} | null {
  const haystack = content.toLowerCase();
  const index = haystack.indexOf(query);
  if (index === -1) return null;

  const rawStart = Math.max(0, index - SNIPPET_RADIUS);
  const rawEnd = Math.min(content.length, index + query.length + SNIPPET_RADIUS);

  const prefix = rawStart > 0 ? "… " : "";
  const suffix = rawEnd < content.length ? " …" : "";

  // Tidy each segment separately so we can compute the match offset precisely.
  const before = tidy(content.slice(rawStart, index));
  const matched = content.slice(index, index + query.length);
  const after = tidy(content.slice(index + query.length, rawEnd));

  const head = `${prefix}${before}${before ? " " : ""}`;
  const snippet = `${head}${matched}${after ? " " : ""}${after}${suffix}`;

  return {
    snippet,
    matchStart: head.length,
    matchLength: matched.length,
  };
}

/**
 * Counts non-overlapping occurrences of `query` in `haystack` (already lowered).
 * Used to bias notes that mention the term repeatedly.
 */
function countOccurrences(haystack: string, query: string) {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(query, from);
    if (at === -1) break;
    count++;
    from = at + query.length;
  }
  return count;
}

/**
 * Searches the bodies of locally-cached notes. Pure + synchronous: the caller
 * passes the cached files (see getWorkspaceFilesFromCache). Empty/short queries
 * return []. Title (filename) matches score highest, then early body matches,
 * then frequency.
 */
export function searchCachedContent(
  files: WorkspaceFileData[],
  query: string,
  opts?: { limit?: number },
): ContentMatch[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const matches: ContentMatch[] = [];

  for (const file of files) {
    if (!file?.path || typeof file.content !== "string") continue;
    if (isReservedPath(file.path)) continue;

    const built = buildSnippet(file.content, normalized);
    if (!built) continue;

    const haystack = file.content.toLowerCase();
    const firstAt = haystack.indexOf(normalized);
    const occurrences = countOccurrences(haystack, normalized);
    const name = getBaseName(file.path);

    // Base score for a body hit, plus bonuses for an early first match and for
    // multiple mentions. Kept below filename-match scores in workspace-search so
    // name matches still win in the merged list.
    let score = 200;
    if (name.toLowerCase().includes(normalized)) score += 60;
    score += Math.max(0, 40 - Math.floor(firstAt / 40)); // earlier = better
    score += Math.min(30, (occurrences - 1) * 6); // repeated mentions

    matches.push({
      path: file.path,
      name,
      snippet: built.snippet,
      matchStart: built.matchStart,
      matchLength: built.matchLength,
      score,
      source: "local",
    });
  }

  matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return matches.slice(0, opts?.limit ?? DEFAULT_LIMIT);
}

/**
 * Merges local and remote content matches, deduped by path. Local wins (fresher
 * body + a real snippet from the live cache). Remote-only matches are appended,
 * scored just below local hits since we trust the live cache more.
 */
export function mergeContentMatches(
  local: ContentMatch[],
  remote: ContentMatch[],
  opts?: { limit?: number },
): ContentMatch[] {
  const byPath = new Map<string, ContentMatch>();
  for (const match of remote) {
    if (!isReservedPath(match.path)) byPath.set(match.path, match);
  }
  for (const match of local) {
    byPath.set(match.path, match); // local overrides remote for the same path
  }

  const merged = [...byPath.values()];
  merged.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return merged.slice(0, opts?.limit ?? DEFAULT_LIMIT);
}
