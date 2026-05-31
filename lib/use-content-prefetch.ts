import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchWorkspaceFileAction } from "@/app/workspace/actions";
import { workspaceKeys, type WorkspaceFileData } from "@/lib/workspace-query";
import { type WorkspaceTreeIndexEntry } from "@/app/workspace/actions";

const CONCURRENCY = 3;
const MARKDOWN = /\.(md|markdown|mdx|txt)$/i;

/**
 * Background-fills the note-body cache so local (offline, instant) content
 * search becomes exhaustive instead of only covering opened notes.
 *
 * Behaviour:
 * - Runs only when `active` (e.g. the palette is open) and online.
 * - Walks the recursive tree index, skipping files already cached.
 * - Fetches bodies at low concurrency (CONCURRENCY) to avoid flooding GitHub.
 * - Seeds each result into the same `workspace/file` cache key the editor and
 *   search read from, so the IDB persister also makes it durable/offline.
 * - Best-effort: individual failures are swallowed; it never throws or retries
 *   aggressively. A module-level guard avoids two passes racing.
 */
export function useContentPrefetch(
  routeOwner: string | null,
  indexEntries: WorkspaceTreeIndexEntry[] | undefined,
  active: boolean
) {
  const queryClient = useQueryClient();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (!indexEntries || indexEntries.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (runningRef.current) return;

    let cancelled = false;
    runningRef.current = true;

    const targets = indexEntries.filter((entry) => {
      if (entry.type !== "file") return false;
      if (!MARKDOWN.test(entry.name)) return false;
      // Skip files whose body is already cached.
      const cached = queryClient.getQueryData<WorkspaceFileData>(
        workspaceKeys.file(routeOwner, entry.path)
      );
      return !(cached && typeof cached.content === "string");
    });

    const fetchOne = async (entry: WorkspaceTreeIndexEntry) => {
      try {
        const data = await fetchWorkspaceFileAction(routeOwner, entry.path);
        if (cancelled) return;
        queryClient.setQueryData(
          workspaceKeys.file(routeOwner, entry.path),
          data
        );
      } catch {
        // Best-effort: ignore (rate limit, deleted file, etc.).
      }
    };

    // Simple concurrency-limited worker pool over the target list.
    const run = async () => {
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < targets.length) {
          const entry = targets[cursor++];
          await fetchOne(entry);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker)
      );
    };

    void run().finally(() => {
      runningRef.current = false;
    });

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
    // routeOwner change or index growth should restart; queryClient is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, routeOwner, indexEntries]);
}
