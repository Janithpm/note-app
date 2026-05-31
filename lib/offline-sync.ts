import type { QueryClient } from "@tanstack/react-query";

import { saveNoteAction, type SaveNoteResult } from "@/app/workspace/actions";
import {
  enqueueSave,
  listQueuedSaves,
  removeQueuedSave,
  type PendingSave,
} from "@/lib/offline-queue";
import {
  getBaseName,
  setWorkspaceFileState,
  upsertWorkspaceTreeItem,
  workspaceKeys,
  type WorkspaceFileData,
} from "@/lib/workspace-query";

/**
 * A queued save whose replay hit a remote conflict (sha mismatch). The UI
 * resolves it by calling one of the resolver callbacks.
 */
export type SyncConflict = {
  entry: PendingSave;
  remoteSha?: string;
  remoteContent?: string;
};

/** True when the error looks like a connectivity failure rather than a 4xx/5xx. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  // Server Actions reject with a TypeError ("Failed to fetch") when the network
  // is unreachable. Treat any non-Response rejection during a save as offline.
  return (
    error instanceof TypeError ||
    (error instanceof Error && /fetch|network|load failed/i.test(error.message))
  );
}

/** Patch the cache to reflect a confirmed (synced) save. */
export function markFileSynced(
  queryClient: QueryClient,
  routeOwner: string | null,
  path: string,
  content: string,
  sha: string,
) {
  setWorkspaceFileState(queryClient, routeOwner, path, {
    path,
    content,
    sha,
    pending: false,
    optimistic: false,
    syncError: null,
  });
  upsertWorkspaceTreeItem(queryClient, routeOwner, {
    name: getBaseName(path),
    path,
    sha,
    type: "file",
    pending: false,
    optimistic: false,
    syncError: null,
  });
}

/** Mark a cached file as having a pending (queued, not yet synced) save. */
export function markFilePending(
  queryClient: QueryClient,
  entry: PendingSave,
) {
  const file: WorkspaceFileData = {
    path: entry.path,
    content: entry.content,
    sha: entry.sha,
    pending: true,
    optimistic: true,
    syncError: null,
  };
  setWorkspaceFileState(queryClient, entry.routeOwner, entry.path, file);
  upsertWorkspaceTreeItem(queryClient, entry.routeOwner, {
    name: getBaseName(entry.path),
    path: entry.path,
    sha: entry.sha ?? `optimistic:${entry.path}`,
    type: "file",
    pending: true,
    optimistic: true,
    syncError: null,
  });
}

type FlushOptions = {
  queryClient: QueryClient;
  /** Called for each entry that conflicts; the UI resolves it. */
  onConflict?: (conflict: SyncConflict) => void;
};

let flushing = false;

/**
 * Replays every queued save through the server action. Runs at most once at a
 * time (a re-entrant call is a no-op) so a reconnect burst doesn't double-commit.
 * Conflicts are reported via `onConflict` and left in the queue until resolved.
 */
export async function flushQueuedSaves({
  queryClient,
  onConflict,
}: FlushOptions): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;

  try {
    const pending = await listQueuedSaves();
    for (const entry of pending) {
      let result: SaveNoteResult;
      try {
        result = await saveNoteAction(
          entry.routeOwner,
          entry.path,
          entry.content,
          entry.sha,
          entry.isNew ? `Create ${entry.path}` : `Update ${entry.path}`,
        );
      } catch (error) {
        // Network dropped mid-flush — stop and leave the rest queued for the
        // next reconnect. Anything before this entry already succeeded.
        if (isNetworkError(error)) break;
        throw error;
      }

      if (result.ok) {
        markFileSynced(
          queryClient,
          entry.routeOwner,
          result.path,
          entry.content,
          result.sha,
        );
        await removeQueuedSave(entry.routeOwner, entry.path);
        if (entry.isNew) {
          queryClient.invalidateQueries({
            queryKey: workspaceKeys.treeIndex(entry.routeOwner),
          });
        }
      } else if (result.reason === "conflict") {
        // Leave it in the queue; the UI resolves via resolveConflict().
        onConflict?.({
          entry,
          remoteSha: result.remoteSha,
          remoteContent: result.remoteContent,
        });
      } else {
        // Hard error (auth, validation): drop the pending flag so the editor
        // shows it as failed rather than silently stuck pending forever.
        setWorkspaceFileState(queryClient, entry.routeOwner, entry.path, {
          path: entry.path,
          content: entry.content,
          sha: entry.sha,
          pending: false,
          optimistic: false,
          syncError: result.message,
        });
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Resolves a conflict the user chose to handle.
 * - "mine": re-commit the queued content against the *remote* sha (force win).
 * - "remote": discard the queued edit and adopt the remote version.
 */
export async function resolveConflict(
  queryClient: QueryClient,
  conflict: SyncConflict,
  choice: "mine" | "remote",
): Promise<SaveNoteResult | null> {
  const { entry, remoteSha, remoteContent } = conflict;

  if (choice === "remote") {
    await removeQueuedSave(entry.routeOwner, entry.path);
    if (remoteContent !== undefined && remoteSha) {
      markFileSynced(
        queryClient,
        entry.routeOwner,
        entry.path,
        remoteContent,
        remoteSha,
      );
    }
    return null;
  }

  // "mine": rebase onto the remote sha and retry.
  const result = await saveNoteAction(
    entry.routeOwner,
    entry.path,
    entry.content,
    remoteSha,
    `Update ${entry.path} (resolved conflict)`,
  );

  if (result.ok) {
    markFileSynced(
      queryClient,
      entry.routeOwner,
      result.path,
      entry.content,
      result.sha,
    );
    await removeQueuedSave(entry.routeOwner, entry.path);
  }
  return result;
}

/** Enqueue a save and reflect it as pending in the cache. */
export async function queueSaveOffline(
  queryClient: QueryClient,
  entry: PendingSave,
): Promise<void> {
  await enqueueSave(entry);
  markFilePending(queryClient, entry);
}
