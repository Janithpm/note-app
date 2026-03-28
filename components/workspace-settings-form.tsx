"use client";

import type { ReactNode } from "react";
import { Database, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";

import { updateWorkspacePersistenceModeAction } from "@/app/workspace/actions";
import { Switch } from "@/components/ui/switch";
import { type WorkspacePersistenceMode } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import {
  useOptimisticMutation,
  useWorkspacePreferencesQuery,
  workspaceKeys,
} from "@/lib/workspace-query";

type SettingsCardProps = {
  mode: WorkspacePersistenceMode;
  currentOwner: string | null;
};

function PreferenceCard({
  active,
  icon,
  title,
  description,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 transition-colors",
        active ? "border-primary/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            active ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSettingsForm({
  mode,
  currentOwner,
}: SettingsCardProps) {
  const preferencesQuery = useWorkspacePreferencesQuery({
    initialData: {
      persistenceMode: mode,
      currentOwner,
      pending: false,
      optimistic: false,
      syncError: null,
    },
  });
  const preferences = preferencesQuery.data;
  const isDatabaseMode = preferences?.persistenceMode === "database";

  const savePreference = useOptimisticMutation<
    { persistenceMode: WorkspacePersistenceMode; currentOwner: string | null },
    { mode: WorkspacePersistenceMode },
    { previousMode: WorkspacePersistenceMode }
  >({
    mutationFn: async ({ mode: nextMode }) =>
      updateWorkspacePersistenceModeAction(nextMode, preferences?.currentOwner ?? null),
    getQueryKeys: () => [workspaceKeys.preferences()],
    applyOptimisticUpdate: (queryClient, variables) => {
      const previousMode = preferences?.persistenceMode ?? mode;
      queryClient.setQueryData(workspaceKeys.preferences(), {
        persistenceMode: variables.mode,
        currentOwner: preferences?.currentOwner ?? currentOwner,
        pending: true,
        optimistic: true,
        syncError: null,
      });

      return {
        previousMode,
      };
    },
    rollback: (queryClient, _variables, _error, state) => {
      queryClient.setQueryData(workspaceKeys.preferences(), {
        persistenceMode: state.context.previousMode,
        currentOwner: preferences?.currentOwner ?? currentOwner,
        pending: false,
        optimistic: false,
        syncError: "Could not update workspace memory preference.",
      });
      toast.error("Could not update the workspace memory preference.");
    },
    onSuccess: (queryClient, data) => {
      queryClient.setQueryData(workspaceKeys.preferences(), {
        persistenceMode: data.persistenceMode,
        currentOwner: data.currentOwner,
        pending: false,
        optimistic: false,
        syncError: null,
      });
      toast.success(
        data.persistenceMode === "database"
          ? "Workspace memory now follows your account across devices."
          : "Workspace memory is now stored only in this browser."
      );
    },
    invalidate: async (queryClient) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.preferences(),
        exact: true,
      });
    },
  });

  const handleModeChange = (checked: boolean) => {
    savePreference.mutate({
      mode: checked ? "database" : "cookie",
    });
  };

  const nextMode: WorkspacePersistenceMode = isDatabaseMode ? "database" : "cookie";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 text-left">
            <h2 className="text-xl font-semibold text-foreground">
              Remember last active workspace
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep `/workspace` pointing at the most relevant place for you
              without exposing the internal repo in the URL.
            </p>
            <p className="text-sm text-muted-foreground">
              Current mode:{" "}
              <span className="font-medium text-foreground">
                {nextMode === "database" ? "Database per user" : "Cookie only"}
              </span>
            </p>
            <p
              className={cn(
                "text-xs",
                preferences?.syncError ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {preferences?.pending
                ? "Saving preference…"
                : preferences?.syncError
                  ? preferences.syncError
                  : "Changes sync in the background without blocking the switch."}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <Switch
              checked={Boolean(isDatabaseMode)}
              onCheckedChange={handleModeChange}
              aria-label="Toggle database workspace memory"
            />
            <div className="text-sm">
              <p className="font-medium text-foreground">Use database memory</p>
              <p className="text-muted-foreground">Switch off for browser-only memory.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PreferenceCard
          active={!isDatabaseMode}
          icon={<HardDriveDownload className="size-5" />}
          title="Cookie only"
          description="Remembers your last active workspace only in this browser. Fast, simple, and the default behavior."
        />
        <PreferenceCard
          active={Boolean(isDatabaseMode)}
          icon={<Database className="size-5" />}
          title="Database per user"
          description="Stores your last active workspace with your account so `/workspace` follows you across browsers and devices."
        />
      </div>
    </div>
  );
}
