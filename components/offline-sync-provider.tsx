"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  flushQueuedSaves,
  resolveConflict,
  type SyncConflict,
} from "@/lib/offline-sync";
import { listQueuedSaves } from "@/lib/offline-queue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type OfflineSyncContextValue = {
  /** Hand a conflict to the resolver UI. */
  reportConflict: (conflict: SyncConflict) => void;
  /** Manually trigger a queue flush (e.g. a "retry now" button). */
  flushNow: () => void;
  /** True while a conflict for this path is awaiting the user's decision. */
  hasPendingConflict: (routeOwner: string | null, path: string) => boolean;
  /** Tell the provider the queue changed (e.g. after the editor enqueues). */
  notifyQueueChanged: () => void;
  /** Live sync state for status UI. */
  status: SyncStatus;
};

export type SyncStatus = {
  isOnline: boolean;
  isSyncing: boolean;
  /** Number of saves waiting in the offline queue. */
  pendingCount: number;
  /** Number of unresolved conflicts awaiting a decision. */
  conflictCount: number;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync must be used within <OfflineSyncProvider>");
  }
  return ctx;
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  // Conflicts are queued; we surface them one at a time.
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [resolving, setResolving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const active = conflicts[0] ?? null;

  const refreshPendingCount = useCallback(async () => {
    try {
      const queued = await listQueuedSaves();
      setPendingCount(queued.length);
    } catch {
      // IndexedDB unavailable (private mode, etc.) — leave the count as-is.
    }
  }, []);

  const reportConflict = useCallback((conflict: SyncConflict) => {
    setConflicts((current) => {
      // Collapse duplicate conflicts for the same file.
      const key = `${conflict.entry.routeOwner ?? ""} ${conflict.entry.path}`;
      const without = current.filter(
        (c) => `${c.entry.routeOwner ?? ""} ${c.entry.path}` !== key,
      );
      return [...without, conflict];
    });
  }, []);

  const flush = useCallback(() => {
    setIsSyncing(true);
    void flushQueuedSaves({ queryClient, onConflict: reportConflict })
      .finally(() => {
        setIsSyncing(false);
        void refreshPendingCount();
      });
  }, [queryClient, reportConflict, refreshPendingCount]);

  // Track connectivity. Initialize from navigator (client-only) on mount.
  useEffect(() => {
    setIsOnline(navigator.onLine);
    void refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Back online — syncing notes…");
      flush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Drain on mount in case saves were left queued from a previous session.
    flush();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush, refreshPendingCount]);

  const handleResolve = useCallback(
    async (choice: "mine" | "remote") => {
      if (!active) return;
      setResolving(true);
      try {
        const result = await resolveConflict(queryClient, active, choice);
        if (result && !result.ok) {
          toast.error("Couldn't resolve the conflict. Try again.");
        } else {
          toast.success(
            choice === "mine"
              ? "Your version was saved to GitHub."
              : "Adopted the version from GitHub.",
          );
          setConflicts((current) => current.slice(1));
          void refreshPendingCount();
        }
      } catch {
        toast.error("Couldn't resolve the conflict. Try again.");
      } finally {
        setResolving(false);
      }
    },
    [active, queryClient, refreshPendingCount],
  );

  const hasPendingConflict = useCallback(
    (routeOwner: string | null, path: string) =>
      conflicts.some(
        (c) => c.entry.routeOwner === routeOwner && c.entry.path === path,
      ),
    [conflicts],
  );

  const status: SyncStatus = {
    isOnline,
    isSyncing,
    pendingCount,
    conflictCount: conflicts.length,
  };

  return (
    <OfflineSyncContext.Provider
      value={{
        reportConflict,
        flushNow: flush,
        hasPendingConflict,
        notifyQueueChanged: refreshPendingCount,
        status,
      }}
    >
      {children}
      <ConflictDialog
        conflict={active}
        resolving={resolving}
        onResolve={handleResolve}
      />
    </OfflineSyncContext.Provider>
  );
}

function ConflictDialog({
  conflict,
  resolving,
  onResolve,
}: {
  conflict: SyncConflict | null;
  resolving: boolean;
  onResolve: (choice: "mine" | "remote") => void;
}) {
  return (
    <Dialog open={Boolean(conflict)}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Sync conflict</DialogTitle>
          <DialogDescription>
            {conflict
              ? `"${conflict.entry.path}" changed on GitHub while you were editing offline. Choose which version to keep.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            disabled={resolving}
            onClick={() => onResolve("mine")}
          >
            Keep my version (overwrite GitHub)
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={resolving}
            onClick={() => onResolve("remote")}
          >
            Keep GitHub&apos;s version (discard my edit)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
