"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePalette } from "@/components/palette-provider";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { InstallButton } from "@/components/install-button";
import {
  getWorkspaceBasePath,
  type WorkspaceOwnerOption,
} from "@/lib/workspace";

function getBreadcrumbData(
  pathname: string,
  activeOwner: WorkspaceOwnerOption,
  routeOwner: string | null
) {
  const segments = pathname.split("/").filter(Boolean);
  const route = segments.slice(routeOwner ? 2 : 1);
  const workspaceHref = getWorkspaceBasePath(routeOwner);

  if (route.length === 0) {
    return {
      workspaceHref,
      contextLabel: activeOwner.kind === "organization" ? activeOwner.label : null,
      pageLabel: "Overview",
    };
  }

  if (route[0] === "settings") {
    return {
      workspaceHref,
      contextLabel: activeOwner.kind === "organization" ? activeOwner.label : null,
      pageLabel: "Settings",
    };
  }

  if (route[0] === "new") {
    return {
      workspaceHref,
      contextLabel: activeOwner.kind === "organization" ? activeOwner.label : null,
      pageLabel: "New note",
    };
  }

  if (route[0] === "blob") {
    const pathSegments = route.slice(1).map(decodeURIComponent);
    const pageLabel = pathSegments[pathSegments.length - 1] ?? "Workspace";
    const contextLabel =
      pathSegments.length > 1
        ? pathSegments.slice(0, -1).join(" / ")
        : activeOwner.kind === "organization"
          ? activeOwner.label
          : "Workspace";

    return {
      workspaceHref,
      contextLabel,
      pageLabel,
    };
  }

  return {
    workspaceHref,
    contextLabel: activeOwner.kind === "organization" ? activeOwner.label : null,
    pageLabel: route.map(decodeURIComponent).join(" / "),
  };
}

export function RepositoryHeader({
  activeOwner,
  routeOwner,
}: {
  activeOwner: WorkspaceOwnerOption;
  routeOwner: string | null;
}) {
  const pathname = usePathname();
  const palette = usePalette();
  const { workspaceHref, contextLabel, pageLabel } = getBreadcrumbData(
    pathname,
    activeOwner,
    routeOwner
  );

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80">
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink asChild>
              <Link href={workspaceHref}>Workspace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          {contextLabel ? (
            <>
              <BreadcrumbItem className="hidden lg:block">
                <BreadcrumbPage className="max-w-[22rem] truncate">
                  {contextLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden lg:block" />
            </>
          ) : null}
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[16rem] truncate">
              {pageLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SyncStatusIndicator />
        <InstallButton />
      </div>

      <button
        type="button"
        onClick={() => palette.open()}
        title="Search workspace"
        className="flex shrink-0 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded bg-background/80 px-1 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
