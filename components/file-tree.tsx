"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  Plus,
  Search,
} from "lucide-react";

import { fetchRepoContents } from "@/app/workspace/actions";
import { AuthButton } from "@/components/auth-button";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  getWorkspaceBlobPath,
  getWorkspaceNewPath,
} from "@/lib/workspace";

type RepoItem = {
  name: string;
  path: string;
  sha: string;
  type: "dir" | "file" | string;
};

function getRepoItemKey(item: RepoItem) {
  return `${item.type}:${item.path || item.sha}`;
}

function sortRepoItems(items: RepoItem[]) {
  return [...items].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
}

function getCurrentBlobPath(pathname: string) {
  const [, blobPath = ""] = pathname.split("/blob/");
  return decodeURIComponent(blobPath);
}

function openSearchPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
    })
  );
}

function FileLink({
  routeOwner,
  item,
  isActive,
  nested = false,
}: {
  routeOwner: string | null;
  item: RepoItem;
  isActive: boolean;
  nested?: boolean;
}) {
  const isMarkdown = item.name.endsWith(".md") || item.name.endsWith(".mdx");
  const href = getWorkspaceBlobPath(routeOwner, item.path);

  if (nested) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <Link href={href}>
            {isMarkdown ? (
              <FileText className="text-primary/80" />
            ) : (
              <File className="text-muted-foreground" />
            )}
            <span>{item.name}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.path}>
        <Link href={href}>
          {isMarkdown ? (
            <FileText className="text-primary/80" />
          ) : (
            <File className="text-muted-foreground" />
          )}
          <span>{item.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function FolderNode({
  routeOwner,
  item,
  currentPath,
  nested = false,
}: {
  routeOwner: string | null;
  item: RepoItem;
  currentPath: string;
  nested?: boolean;
}) {
  const shouldBeOpen =
    currentPath === item.path || currentPath.startsWith(`${item.path}/`);

  const [isOpen, setIsOpen] = React.useState(shouldBeOpen);
  const [children, setChildren] = React.useState<RepoItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadChildren = React.useCallback(async () => {
    if (loading || children.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const data = await fetchRepoContents(routeOwner, item.path);
      setChildren(sortRepoItems(data as RepoItem[]));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [children.length, item.path, loading, routeOwner]);

  React.useEffect(() => {
    if (shouldBeOpen) {
      setIsOpen(true);
      void loadChildren();
    }
  }, [loadChildren, shouldBeOpen]);

  if (nested) {
    return (
      <SidebarMenuSubItem>
        <Collapsible
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (open) {
              void loadChildren();
            }
          }}
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton isActive={shouldBeOpen}>
              <ChevronRight
                className={`transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
              <Folder className="text-primary/80" />
              <span>{item.name}</span>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {loading ? (
                <SidebarMenuSubItem>
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    Loading...
                  </div>
                </SidebarMenuSubItem>
              ) : (
                children.map((child) => (
                  <FileNode
                    key={getRepoItemKey(child)}
                    routeOwner={routeOwner}
                    item={child}
                    currentPath={currentPath}
                    nested
                  />
                ))
              )}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open) {
            void loadChildren();
          }
        }}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={shouldBeOpen} tooltip={item.path}>
            <ChevronRight
              className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
            <Folder className="text-primary/80" />
            <span>{item.name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {loading ? (
              <SidebarMenuSubItem>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Loading...
                </div>
              </SidebarMenuSubItem>
            ) : (
              children.map((child) => (
                <FileNode
                  key={getRepoItemKey(child)}
                  routeOwner={routeOwner}
                  item={child}
                  currentPath={currentPath}
                  nested
                />
              ))
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function FileNode({
  routeOwner,
  item,
  currentPath,
  nested = false,
}: {
  routeOwner: string | null;
  item: RepoItem;
  currentPath: string;
  nested?: boolean;
}) {
  if (item.type === "dir") {
    return (
      <FolderNode
        routeOwner={routeOwner}
        item={item}
        currentPath={currentPath}
        nested={nested}
      />
    );
  }

  return (
    <FileLink
      routeOwner={routeOwner}
      item={item}
      isActive={currentPath === item.path}
      nested={nested}
    />
  );
}

export function FileTree({
  initialData,
  routeOwner,
}: {
  initialData: RepoItem[];
  routeOwner: string | null;
}) {
  const pathname = usePathname();
  const currentPath = getCurrentBlobPath(pathname);
  const items = React.useMemo(() => sortRepoItems(initialData), [initialData]);

  return (
    <Sidebar
      className="border-r border-sidebar-border/70"
    >
      <SidebarHeader className="gap-3 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openSearchPalette}>
              <Search />
              <span>Search workspace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.endsWith("/new")}>
              <Link href={getWorkspaceNewPath(routeOwner)}>
                <Plus />
                <span>New note</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup className="pt-2">
          <SidebarGroupLabel>Workspace Tree</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <FileNode
                  key={getRepoItemKey(item)}
                  routeOwner={routeOwner}
                  item={item}
                  currentPath={currentPath}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/30 p-2">
          <FullscreenToggle />
          <div className="h-5 w-px shrink-0 bg-sidebar-border/70" />
          <div className="min-w-0 flex-1">
            <AuthButton />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={openSearchPalette}
        >
          <Search />
          <span>Press cmd/ctrl + K to search</span>
        </Button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
