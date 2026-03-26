"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Edit2
} from "lucide-react";

import {
  fetchRepoContents,
  deleteFileAction,
  renameFileAction,
  deleteDirectoryAction,
  renameDirectoryAction,
} from "@/app/workspace/actions";
import { AuthButton } from "@/components/auth-button";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  getWorkspaceBlobPath,
  getWorkspaceNewPath,
  type WorkspaceOwnerOption,
} from "@/lib/workspace";
import { toast } from "sonner";

type RepoItem = {
  name: string;
  path: string;
  sha: string;
  type: "dir" | "file" | string;
};

type FileTreeActionProps = {
  onRename: (item: RepoItem) => void;
  onDelete: (item: RepoItem) => void;
  onCreateInFolder?: (item: RepoItem) => void;
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
  onRename,
  onDelete,
}: {
  routeOwner: string | null;
  item: RepoItem;
  isActive: boolean;
  nested?: boolean;
} & FileTreeActionProps) {
  const isMarkdown = item.name.endsWith(".md") || item.name.endsWith(".mdx");
  const href = getWorkspaceBlobPath(routeOwner, item.path);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "F2") {
      e.preventDefault();
      onRename(item);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete(item);
    }
  };

  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover>
          <MoreHorizontal />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem onClick={() => onRename(item)}>
          <Edit2 className="mr-2 h-4 w-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (nested) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive} onKeyDown={handleKeyDown}>
          <Link href={href}>
            {isMarkdown ? (
              <FileText className="text-primary/80" />
            ) : (
              <File className="text-muted-foreground" />
            )}
            <span>{item.name}</span>
          </Link>
        </SidebarMenuSubButton>
        {actions}
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.path} onKeyDown={handleKeyDown}>
        <Link href={href}>
          {isMarkdown ? (
            <FileText className="text-primary/80" />
          ) : (
            <File className="text-muted-foreground" />
          )}
          <span>{item.name}</span>
        </Link>
      </SidebarMenuButton>
      {actions}
    </SidebarMenuItem>
  );
}

function FolderNode({
  routeOwner,
  item,
  currentPath,
  nested = false,
  onRename,
  onDelete,
  onCreateInFolder,
}: {
  routeOwner: string | null;
  item: RepoItem;
  currentPath: string;
  nested?: boolean;
} & FileTreeActionProps) {
  const shouldBeOpen =
    currentPath === item.path || currentPath.startsWith(`${item.path}/`);

  const [isOpen, setIsOpen] = React.useState(shouldBeOpen);
  const { data: children = [], isLoading: loading } = useQuery({
    queryKey: ['repoContents', routeOwner, item.path],
    queryFn: async () => {
      const data = await fetchRepoContents(routeOwner, item.path);
      return sortRepoItems(data as RepoItem[]);
    },
    enabled: isOpen,
    staleTime: 60 * 1000,
  });

  React.useEffect(() => {
    if (shouldBeOpen) {
      setIsOpen(true);
    }
  }, [shouldBeOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "F2") {
      e.preventDefault();
      onRename(item);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete(item);
    }
  };

  const actions = (
    <>
      <SidebarMenuAction showOnHover className="right-8" onClick={() => onCreateInFolder?.(item)}>
        <Plus />
        <span className="sr-only">New Note</span>
      </SidebarMenuAction>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={() => onRename(item)}>
            <Edit2 className="mr-2 h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  if (nested) {
    return (
      <SidebarMenuSubItem>
        <Collapsible
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
          }}
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton isActive={shouldBeOpen} onKeyDown={handleKeyDown}>
              <ChevronRight
                className={`transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
              <Folder className="text-primary/80" />
              <span>{item.name}</span>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          {actions}
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
                    onRename={onRename}
                    onDelete={onDelete}
                    onCreateInFolder={onCreateInFolder}
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
        }}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={shouldBeOpen} tooltip={item.path} onKeyDown={handleKeyDown}>
            <ChevronRight
              className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
            <Folder className="text-primary/80" />
            <span>{item.name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {actions}
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
                  onRename={onRename}
                  onDelete={onDelete}
                  onCreateInFolder={onCreateInFolder}
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
  onRename,
  onDelete,
  onCreateInFolder,
}: {
  routeOwner: string | null;
  item: RepoItem;
  currentPath: string;
  nested?: boolean;
} & FileTreeActionProps) {
  if (item.type === "dir") {
    return (
      <FolderNode
        routeOwner={routeOwner}
        item={item}
        currentPath={currentPath}
        nested={nested}
        onRename={onRename}
        onDelete={onDelete}
        onCreateInFolder={onCreateInFolder}
      />
    );
  }

  return (
    <FileLink
      routeOwner={routeOwner}
      item={item}
      isActive={currentPath === item.path}
      nested={nested}
      onRename={onRename}
      onDelete={onDelete}
    />
  );
}

export function FileTree({
  initialData,
  routeOwner,
  activeOwner,
  owners,
}: {
  initialData: RepoItem[];
  routeOwner: string | null;
  activeOwner: WorkspaceOwnerOption;
  owners: WorkspaceOwnerOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = getCurrentBlobPath(pathname);
  const queryClient = useQueryClient();

  const [itemToRename, setItemToRename] = React.useState<RepoItem | null>(null);
  const [newName, setNewName] = React.useState("");
  const [itemToDelete, setItemToDelete] = React.useState<RepoItem | null>(null);

  const handleRename = (item: RepoItem) => {
    setItemToRename(item);
    setNewName(item.name);
  };

  const { data: items } = useQuery({
    queryKey: ['repoContents', routeOwner, ""],
    queryFn: async () => {
      const data = await fetchRepoContents(routeOwner, "");
      return sortRepoItems(data as RepoItem[]);
    },
    initialData: React.useMemo(() => sortRepoItems(initialData), [initialData]),
    staleTime: 60 * 1000,
  });

  const { mutate: renameItem, isPending: isRenaming } = useMutation({
    mutationFn: async ({ item, newName }: { item: RepoItem; newName: string }) => {
      const pathParts = item.path.split("/");
      pathParts.pop(); // Remove old name
      pathParts.push(newName); // Add new name
      const newPath = pathParts.join("/");

      if (item.type === "dir") {
        await renameDirectoryAction(routeOwner, item.path, newPath, "Rename directory");
      } else {
        await renameFileAction(routeOwner, item.path, newPath, item.sha, "Rename file");
      }
      return { item, newName, newPath };
    },
    onMutate: async ({ item, newName }) => {
      const pathParts = item.path.split("/");
      pathParts.pop();
      const parentPath = pathParts.join("/");

      await queryClient.cancelQueries({ queryKey: ['repoContents', routeOwner, parentPath] });
      const previousItems = queryClient.getQueryData(['repoContents', routeOwner, parentPath]);

      queryClient.setQueryData(['repoContents', routeOwner, parentPath], (old: RepoItem[] | undefined) => {
        if (!old) return old;
        return old.map(i => i.path === item.path ? { ...i, name: newName, path: `${parentPath ? parentPath + '/' : ''}${newName}` } : i);
      });

      setItemToRename(null); // Close dialog instantly
      return { previousItems, parentPath };
    },
    onError: (err, variables, context) => {
      toast.error("Failed to rename");
      if (context?.previousItems) {
        queryClient.setQueryData(['repoContents', routeOwner, context.parentPath], context.previousItems);
      }
    },
    onSuccess: (data) => {
      if (data.item.type === "dir") {
        toast.success("Folder renamed successfully");
      } else {
        const newBlobPath = getWorkspaceBlobPath(routeOwner, data.newPath);
        router.push(newBlobPath);
        toast.success("File renamed successfully");
      }
    },
    onSettled: (data, error, variables, context) => {
      if (context?.parentPath !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['repoContents', routeOwner, context.parentPath] });
      }
    }
  });

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: async (item: RepoItem) => {
      if (item.type === "dir") {
        await deleteDirectoryAction(routeOwner, item.path, "Delete directory");
      } else {
        await deleteFileAction(routeOwner, item.path, item.sha, "Delete file");
      }
      return item;
    },
    onMutate: async (item) => {
      const pathParts = item.path.split("/");
      pathParts.pop();
      const parentPath = pathParts.join("/");

      await queryClient.cancelQueries({ queryKey: ['repoContents', routeOwner, parentPath] });
      const previousItems = queryClient.getQueryData(['repoContents', routeOwner, parentPath]);

      queryClient.setQueryData(['repoContents', routeOwner, parentPath], (old: RepoItem[] | undefined) => {
        if (!old) return old;
        return old.filter(i => i.path !== item.path);
      });

      setItemToDelete(null); // Close dialog instantly
      return { previousItems, parentPath };
    },
    onError: (err, variables, context) => {
      toast.error("Failed to delete");
      if (context?.previousItems) {
        queryClient.setQueryData(['repoContents', routeOwner, context.parentPath], context.previousItems);
      }
    },
    onSuccess: (item) => {
      if (item.type === "dir") {
        toast.success("Folder deleted successfully");
      } else {
        router.push(`/workspace/${routeOwner || "general"}`);
        toast.success("File deleted successfully");
      }
    },
    onSettled: (data, error, variables, context) => {
      if (context?.parentPath !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['repoContents', routeOwner, context.parentPath] });
      }
    }
  });

  const handleRenameSubmit = () => {
    if (!itemToRename || !newName || newName === itemToRename.name) {
      setItemToRename(null);
      return;
    }
    renameItem({ item: itemToRename, newName });
  };

  const handleDeleteSubmit = () => {
    if (!itemToDelete) return;
    deleteItem(itemToDelete);
  };

  const handleCreateInFolder = (item: RepoItem) => {
    const basePath = getWorkspaceNewPath(routeOwner);
    router.push(`${basePath}?folder=${encodeURIComponent(item.path)}`);
  };

  return (
    <>
      <Sidebar className="border-r border-sidebar-border/70">
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
                    onRename={handleRename}
                    onDelete={setItemToDelete}
                    onCreateInFolder={handleCreateInFolder}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="p-3">
          <div className="space-y-2">
            <WorkspaceSwitcher activeOwner={activeOwner} owners={owners} />

            <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent/30 p-2">
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
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Dialog for Rename */}
      <Dialog open={!!itemToRename} onOpenChange={(open) => !open && setItemToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {itemToRename?.type === "dir" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>
              Enter a new name for this {itemToRename?.type === "dir" ? "folder" : "file"}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleRenameSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemToRename(null)} disabled={isRenaming}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={isRenaming || !newName || newName === itemToRename?.name}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Delete Confirmation */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {itemToDelete?.type === "dir" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{itemToDelete?.name}</strong>?
              {itemToDelete?.type === "dir" && " This will remove all files and folders inside it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubmit} disabled={isDeleting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
