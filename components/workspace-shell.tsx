import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { notFound } from "next/navigation";

import { FileTree } from "@/components/file-tree";
import { PaletteProvider } from "@/components/palette-provider";
import { WorkspaceDraftProvider } from "@/components/workspace-draft-provider";
import { WorkspaceEditorHost } from "@/components/workspace-editor-host";
import { WorkspaceQueryHydration } from "@/components/workspace-query-hydration";
import { WorkspaceTreeContextProvider } from "@/components/workspace-tree-context";
import { RepositoryHeader } from "@/components/repository-header";
import { SearchPalette } from "@/components/search-palette";
import { WorkspaceToast } from "@/components/workspace-toast";
import { WorkspaceVisitTracker } from "@/components/workspace-visit-tracker";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getWorkspaceShellData } from "@/lib/workspace-data";

function WorkspaceErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-lg rounded-[30px] border border-border/70 bg-background/92 p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Link
          href="/workspace"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border/70 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back to workspace home
        </Link>
      </div>
    </div>
  );
}

export async function WorkspaceShell({
  userId,
  routeOwner,
  children,
}: {
  userId: string;
  routeOwner: string | null;
  children: React.ReactNode;
}) {
  const {
    workspace,
    initialData,
    warning,
    errorTitle,
    errorDescription,
  } = await getWorkspaceShellData(userId, routeOwner);

  if (!workspace.activeOwner) {
    if (workspace.warning) {
      return (
        <>
          <WorkspaceToast message={workspace.warning.message} />
          <WorkspaceErrorState
            title="Workspace unavailable"
            description={workspace.warning.message}
          />
        </>
      );
    }

    notFound();
  }

  return (
    <>
      {warning ? <WorkspaceToast message={warning.message} /> : null}
      <WorkspaceVisitTracker routeOwner={workspace.activeOwner.routeSegment} />
      <SidebarProvider defaultOpen>
        <WorkspaceQueryHydration
          routeOwner={workspace.activeOwner.routeSegment}
          treeData={initialData}
        >
          <PaletteProvider>
            <WorkspaceTreeContextProvider>
              <WorkspaceDraftProvider
                routeOwner={workspace.activeOwner.routeSegment}
              >
                <SearchPalette
                  routeOwner={workspace.activeOwner.routeSegment}
                />
                <FileTree
                  routeOwner={workspace.activeOwner.routeSegment}
                  activeOwner={workspace.activeOwner}
                  owners={workspace.owners}
                />
                <SidebarInset className="min-w-0">
                  <RepositoryHeader
                    activeOwner={workspace.activeOwner}
                    routeOwner={workspace.activeOwner.routeSegment}
                  />
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    {errorTitle && errorDescription ? (
                      <WorkspaceErrorState
                        title={errorTitle}
                        description={errorDescription}
                      />
                    ) : (
                      <WorkspaceEditorHost
                        routeOwner={workspace.activeOwner.routeSegment}
                      >
                        {children}
                      </WorkspaceEditorHost>
                    )}
                  </div>
                </SidebarInset>
              </WorkspaceDraftProvider>
            </WorkspaceTreeContextProvider>
          </PaletteProvider>
        </WorkspaceQueryHydration>
      </SidebarProvider>
    </>
  );
}
