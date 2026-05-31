"use client";

import { Check, CloudOff, Loader2, RefreshCcw, TriangleAlert } from "lucide-react";

import { useOfflineSync } from "@/components/offline-sync-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Compact sync state for the workspace header. Reflects the live offline-queue
 * state from OfflineSyncProvider: offline, syncing, pending count, conflicts,
 * or all-synced. Clicking it triggers a manual flush when there's pending work.
 */
export function SyncStatusIndicator() {
  const { status, flushNow } = useOfflineSync();
  const { isOnline, isSyncing, pendingCount, conflictCount } = status;

  const state = !isOnline
    ? "offline"
    : conflictCount > 0
      ? "conflict"
      : isSyncing
        ? "syncing"
        : pendingCount > 0
          ? "pending"
          : "synced";

  const config = {
    offline: {
      icon: <CloudOff className="size-3.5" />,
      label: pendingCount > 0 ? `Offline · ${pendingCount}` : "Offline",
      tooltip:
        pendingCount > 0
          ? `Offline — ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you reconnect.`
          : "You're offline. Edits are saved locally and sync when you reconnect.",
      className: "text-amber-600 dark:text-amber-500",
    },
    conflict: {
      icon: <TriangleAlert className="size-3.5" />,
      label: `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`,
      tooltip: "A note changed on GitHub while you edited offline. Resolve to continue syncing.",
      className: "text-destructive",
    },
    syncing: {
      icon: <Loader2 className="size-3.5 animate-spin" />,
      label: "Syncing…",
      tooltip: "Syncing your changes to GitHub…",
      className: "text-muted-foreground",
    },
    pending: {
      icon: <RefreshCcw className="size-3.5" />,
      label: `${pendingCount} pending`,
      tooltip: `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync. Click to retry now.`,
      className: "text-muted-foreground",
    },
    synced: {
      icon: <Check className="size-3.5" />,
      label: "Synced",
      tooltip: "All changes are saved to GitHub.",
      className: "text-muted-foreground",
    },
  }[state];

  const interactive = state === "pending" || state === "offline";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => {
            if (interactive && isOnline) flushNow();
          }}
          aria-label={config.tooltip}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
            interactive && isOnline
              ? "hover:bg-muted"
              : "cursor-default",
            config.className,
          )}
        >
          {config.icon}
          <span className="hidden sm:inline">{config.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{config.tooltip}</TooltipContent>
    </Tooltip>
  );
}
