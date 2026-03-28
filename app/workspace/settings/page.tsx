import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, Settings2 } from "lucide-react";

import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { WorkspaceToast } from "@/components/workspace-toast";
import { WorkspaceQueryHydration } from "@/components/workspace-query-hydration";
import { auth } from "@/lib/auth";
import { getWorkspaceOwners } from "@/lib/github";
import {
  getWorkspacePreferences,
  resolveRememberedWorkspaceOwner,
} from "@/lib/workspace-preferences";

export const metadata = {
  title: "Workspace Settings",
  description: "Control how the workspace chooser remembers your active context.",
};

export default async function WorkspaceSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const [workspaceOwners, preferences, rememberedWorkspace] = await Promise.all([
    getWorkspaceOwners(session.user.id),
    getWorkspacePreferences(session.user.id),
    resolveRememberedWorkspaceOwner(session.user.id),
  ]);

  const currentOwner = rememberedWorkspace.hasRememberedOwner
    ? rememberedWorkspace.rememberedOwner
    : null;

  return (
    <div className="min-h-full bg-background px-6 py-10 mx-auto max-w-4xl">
      {workspaceOwners.warning ? (
        <WorkspaceToast message={workspaceOwners.warning.message} />
      ) : null}

      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
        <div className="w-full space-y-8 flex flex-col items-center justify-center gap-6">
  
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <div className="mx-auto space-y-6 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
                <Settings2 className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Workspace settings
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Tune how `/workspace` remembers your context.
              </h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                Personal profile and organization workspaces share the same
                internal repo strategy. These settings only control how the app
                restores your last active workspace.
              </p>
            </div>
          </div>

          <WorkspaceQueryHydration
            preferencesData={{
              persistenceMode: preferences.persistenceMode,
              currentOwner,
              pending: false,
              optimistic: false,
              syncError: null,
            }}
          >
            <WorkspaceSettingsForm
              currentOwner={currentOwner}
              mode={preferences.persistenceMode}
            />
          </WorkspaceQueryHydration>
           <Link
            href="/workspace"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
