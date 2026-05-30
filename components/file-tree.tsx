"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleAlert,
  Edit2,
  File,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  createDirectoryAction,
  deleteDirectoryAction,
  deleteFileAction,
  fetchWorkspaceFileAction,
  renameDirectoryAction,
  renameFileAction,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useWorkspaceDraft } from "@/components/workspace-draft-provider";
import { useWorkspaceTreeContext } from "@/components/workspace-tree-context";
import { cn } from "@/lib/utils";
import {
  getWorkspaceBasePath,
  getWorkspaceBlobPath,
  getWorkspaceSettingsPath,
  type WorkspaceOwnerOption,
} from "@/lib/workspace";
import {
  getParentPath,
  getWorkspaceItemKey,
  getWorkspaceQueryKeysForPath,
  isPathOrDescendant,
  markWorkspaceTreeItemState,
  moveWorkspaceFileCache,
  remapPathPrefix,
  remapWorkspaceDescendantCaches,
  removeWorkspaceDescendantCaches,
  removeWorkspaceTreeItem,
  restoreSnapshots,
  setWorkspaceFileState,
  type WorkspaceFileData,
  type WorkspaceTreeItem,
  upsertWorkspaceTreeItem,
  useOptimisticMutation,
  useWorkspaceTreeQuery,
  workspaceKeys,
} from "@/lib/workspace-query";
import { toast } from "sonner";

type FileTreeActionProps = {
  onRename: (item: WorkspaceTreeItem) => void;
  onDelete: (item: WorkspaceTreeItem) => void;
  onCreateInFolder?: (item: WorkspaceTreeItem) => void;
  onCreateFolderInFolder?: (item: WorkspaceTreeItem) => void;
};

type RenameMutationVariables = {
  item: WorkspaceTreeItem;
  newName: string;
};

type DeleteMutationVariables = {
  item: WorkspaceTreeItem;
};

type CreateFolderMutationVariables = {
  parentPath: string;
  folderName: string;
};

const TREE_INDENT_STEP_PX = 18;

function getTreeRowStyle(depth: number): React.CSSProperties {
  return {
    paddingLeft: `${10 + depth * TREE_INDENT_STEP_PX}px`,
  };
}

function getCurrentBlobPath(pathname: string) {
  const [, blobPath = ""] = pathname.split("/blob/");
  return decodeURIComponent(blobPath);
}

function ItemSyncIndicator({
  item,
}: {
  item: WorkspaceTreeItem;
}) {
  if (item.syncError) {
    return (
      <span title={item.syncError}>
        <CircleAlert className="size-3.5 text-destructive" />
      </span>
    );
  }

  if (item.pending) {
    return null;
  }

  return null;
}

function ItemActions({
  item,
  onRename,
  onDelete,
  onCreateInFolder,
  onCreateFolderInFolder,
}: {
  item: WorkspaceTreeItem;
  onRename: (item: WorkspaceTreeItem) => void;
  onDelete: (item: WorkspaceTreeItem) => void;
  onCreateInFolder?: (item: WorkspaceTreeItem) => void;
  onCreateFolderInFolder?: (item: WorkspaceTreeItem) => void;
}) {
  const isDir = item.type === "dir";

  return (
    <>
      {item.syncError ? (
        <SidebarMenuAction className="pointer-events-none right-8 opacity-100">
          <ItemSyncIndicator item={item} />
        </SidebarMenuAction>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            // Keep the trigger visible when there's a sync error so the user can
            // still retry/delete a failed item; otherwise reveal on hover only.
            showOnHover={!item.syncError}
            className={item.syncError ? "right-2" : undefined}
          >
            <MoreHorizontal />
            <span className="sr-only">Actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-44">
          {isDir ? (
            <>
              <DropdownMenuItem onClick={() => onCreateInFolder?.(item)}>
                <FilePlus className="mr-2 h-4 w-4" />
                New note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateFolderInFolder?.(item)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={() => onRename(item)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(item)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

const FileLink = React.memo(function FileLink({
  routeOwner,
  item,
  isActive,
  depth = 0,
  onRename,
  onDelete,
}: {
  routeOwner: string | null;
  item: WorkspaceTreeItem;
  isActive: boolean;
  depth?: number;
} & FileTreeActionProps) {
  const isMarkdown = item.name.endsWith(".md") || item.name.endsWith(".mdx");
  const href = getWorkspaceBlobPath(routeOwner, item.path);
  const queryClient = useQueryClient();
  const { openNote } = useWorkspaceDraft();

  // Warm the file content into the cache on hover/focus so clicking the row opens
  // the note instantly instead of waiting on a GitHub round-trip. Skipped for
  // optimistic/pending rows (no real content to fetch yet).
  const prefetchFile = React.useCallback(() => {
    if (item.pending || item.optimistic) {
      return;
    }

    void queryClient.prefetchQuery({
      queryKey: workspaceKeys.file(routeOwner, item.path),
      queryFn: () => fetchWorkspaceFileAction(routeOwner, item.path),
    });
  }, [queryClient, routeOwner, item.path, item.pending, item.optimistic]);

  const handleClick = (event: React.MouseEvent) => {
    // Let the browser handle modified clicks (new tab/window) and non-left clicks.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    // Open the note via client-side state: the pane swaps instantly and shows the
    // loading skeleton during the fetch, instead of a blocking server navigation.
    event.preventDefault();
    openNote(item.path);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "F2") {
      event.preventDefault();
      onRename(item);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete(item);
    }
  };

  const sharedClassName = cn(item.pending && "opacity-80");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.path}
        onKeyDown={handleKeyDown}
        className={cn(sharedClassName, "pr-8")}
        style={getTreeRowStyle(depth)}
      >
        <Link
          href={href}
          onClick={handleClick}
          onMouseEnter={prefetchFile}
          onFocus={prefetchFile}
        >
          {isMarkdown ? (
            <FileText className="text-primary/80" />
          ) : (
            <File className="text-muted-foreground" />
          )}
          <span>{item.name}</span>
        </Link>
      </SidebarMenuButton>
      <ItemActions item={item} onRename={onRename} onDelete={onDelete} />
    </SidebarMenuItem>
  );
});

const FolderNode = React.memo(function FolderNode({
  routeOwner,
  item,
  currentPath,
  depth = 0,
  onRename,
  onDelete,
  onCreateInFolder,
  onCreateFolderInFolder,
}: {
  routeOwner: string | null;
  item: WorkspaceTreeItem;
  currentPath: string;
  depth?: number;
} & FileTreeActionProps) {
  const { revealTarget } = useWorkspaceTreeContext();
  const isRevealAncestor =
    revealTarget != null &&
    (revealTarget.path === item.path ||
      revealTarget.path.startsWith(`${item.path}/`));
  const shouldBeOpen =
    currentPath === item.path ||
    currentPath.startsWith(`${item.path}/`) ||
    isRevealAncestor;

  const [isOpen, setIsOpen] = React.useState(shouldBeOpen);
  const rowRef = React.useRef<HTMLLIElement | null>(null);
  const childrenQuery = useWorkspaceTreeQuery(routeOwner, item.path, {
    enabled: isOpen,
  });
  const children = childrenQuery.data ?? [];
  const showInitialPlaceholder = !childrenQuery.data && childrenQuery.isPending;

  React.useEffect(() => {
    if (shouldBeOpen) {
      setIsOpen(true);
    }
  }, [shouldBeOpen]);

  // When this exact folder is the reveal target, scroll it into view. Keyed on
  // the reveal nonce so repeated reveals of the same folder re-trigger.
  React.useEffect(() => {
    if (revealTarget?.path === item.path) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [revealTarget?.path, revealTarget?.nonce, item.path]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "F2") {
      event.preventDefault();
      onRename(item);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete(item);
    }
  };

  const trigger = (
    <SidebarMenuButton
      isActive={shouldBeOpen}
      tooltip={item.path}
      onKeyDown={handleKeyDown}
      className={cn(item.pending && "opacity-80", "pr-8")}
      style={getTreeRowStyle(depth)}
    >
      <ChevronRight
        className={cn("transition-transform", isOpen && "rotate-90")}
      />
      <Folder className="text-primary/80" />
      <span>{item.name}</span>
    </SidebarMenuButton>
  );

  const content = (
    <SidebarMenu className="mt-1 gap-1">
      {showInitialPlaceholder ? (
        <SidebarMenuItem>
          <div
            className="px-2 py-1 text-xs text-muted-foreground"
            style={getTreeRowStyle(depth + 1)}
          >
            Loading folder…
          </div>
        </SidebarMenuItem>
      ) : (
        children.map((child) => (
          <FileNode
            key={getWorkspaceItemKey(child)}
            routeOwner={routeOwner}
            item={child}
            currentPath={currentPath}
            depth={depth + 1}
            onRename={onRename}
            onDelete={onDelete}
            onCreateInFolder={onCreateInFolder}
            onCreateFolderInFolder={onCreateFolderInFolder}
          />
        ))
      )}
    </SidebarMenu>
  );

  return (
    <SidebarMenuItem ref={rowRef}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
        <ItemActions
          item={item}
          onRename={onRename}
          onDelete={onDelete}
          onCreateInFolder={onCreateInFolder}
          onCreateFolderInFolder={onCreateFolderInFolder}
        />
        <CollapsibleContent>{content}</CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
});

const FileNode = React.memo(function FileNode({
  routeOwner,
  item,
  currentPath,
  depth = 0,
  onRename,
  onDelete,
  onCreateInFolder,
  onCreateFolderInFolder,
}: {
  routeOwner: string | null;
  item: WorkspaceTreeItem;
  currentPath: string;
  depth?: number;
} & FileTreeActionProps) {
  if (item.type === "dir") {
    return (
      <FolderNode
        routeOwner={routeOwner}
        item={item}
        currentPath={currentPath}
        depth={depth}
        onRename={onRename}
        onDelete={onDelete}
        onCreateInFolder={onCreateInFolder}
        onCreateFolderInFolder={onCreateFolderInFolder}
      />
    );
  }

  return (
    <FileLink
      routeOwner={routeOwner}
      item={item}
      isActive={currentPath === item.path}
      depth={depth}
      onRename={onRename}
      onDelete={onDelete}
      onCreateFolderInFolder={onCreateFolderInFolder}
    />
  );
});

export function FileTree({
  routeOwner,
  activeOwner,
  owners,
}: {
  routeOwner: string | null;
  activeOwner: WorkspaceOwnerOption;
  owners: WorkspaceOwnerOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openDraft, activeNotePath } = useWorkspaceDraft();
  const { registerCreateFolderHandler } = useWorkspaceTreeContext();
  // Active-row highlight follows client-side note state (which updates instantly
  // on click), falling back to the URL for the initial/deep-link case.
  const currentPath = activeNotePath ?? getCurrentBlobPath(pathname);
  const rootQuery = useWorkspaceTreeQuery(routeOwner, "");
  const items = rootQuery.data ?? [];

  const [itemToRename, setItemToRename] = React.useState<WorkspaceTreeItem | null>(null);
  const [newName, setNewName] = React.useState("");
  const [itemToDelete, setItemToDelete] = React.useState<WorkspaceTreeItem | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [folderParentPath, setFolderParentPath] = React.useState<string | null>(null);
  const [folderName, setFolderName] = React.useState("");

  const renameMutation = useOptimisticMutation<
    { oldPath: string; newPath: string },
    RenameMutationVariables,
    { previousLocation: string | null; newPath: string; parentPath: string }
  >({
    mutationFn: async ({ item, newName: nextName }) => {
      const parentPath = getParentPath(item.path);
      const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;

      if (item.type === "dir") {
        return renameDirectoryAction(
          routeOwner,
          item.path,
          nextPath,
          "Rename directory"
        );
      }

      return renameFileAction(
        routeOwner,
        item.path,
        nextPath,
        item.sha,
        "Rename file"
      );
    },
    getQueryKeys: (queryClient, { item, newName: nextName }) => {
      const parentPath = getParentPath(item.path);
      const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;

      return [
        workspaceKeys.tree(routeOwner, parentPath),
        ...(item.type === "dir"
          ? getWorkspaceQueryKeysForPath(queryClient, routeOwner, item.path)
          : [workspaceKeys.file(routeOwner, item.path)]),
        workspaceKeys.file(routeOwner, nextPath),
      ];
    },
    applyOptimisticUpdate: (queryClient, { item, newName: nextName }) => {
      const parentPath = getParentPath(item.path);
      const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;

      const nextItem: WorkspaceTreeItem = {
        ...item,
        name: nextName,
        path: nextPath,
        pending: true,
        optimistic: true,
        syncError: null,
      };

      setItemToRename(null);

      removeWorkspaceTreeItem(queryClient, routeOwner, item.path);
      upsertWorkspaceTreeItem(queryClient, routeOwner, nextItem);

      if (item.type === "dir") {
        remapWorkspaceDescendantCaches(queryClient, routeOwner, item.path, nextPath);
      } else {
        moveWorkspaceFileCache(queryClient, routeOwner, item.path, nextPath);
        const fileData = queryClient.getQueryData<WorkspaceFileData>(
          workspaceKeys.file(routeOwner, nextPath)
        );
        if (fileData) {
          setWorkspaceFileState(queryClient, routeOwner, nextPath, {
            ...fileData,
            path: nextPath,
            pending: true,
            optimistic: true,
            syncError: null,
          });
        }
      }

      let previousLocation: string | null = null;

      if (isPathOrDescendant(currentPath, item.path)) {
        previousLocation = pathname;
        const nextCurrentPath =
          item.type === "dir"
            ? remapPathPrefix(currentPath, item.path, nextPath)
            : nextPath;
        router.push(getWorkspaceBlobPath(routeOwner, nextCurrentPath));
      }

      toast.success(`Renamed to ${nextName}`);

      return {
        previousLocation,
        newPath: nextPath,
        parentPath,
      };
    },
    rollback: (queryClient, variables, error, state) => {
      restoreSnapshots(queryClient, state.snapshots);
      if (state.context.previousLocation) {
        router.push(state.context.previousLocation);
      }
      toast.error(error.message || "Failed to rename item.");
      markWorkspaceTreeItemState(queryClient, routeOwner, variables.item.path, {
        pending: false,
        optimistic: false,
        syncError: "Rename failed",
      });
    },
    onSuccess: (queryClient, data) => {
      markWorkspaceTreeItemState(queryClient, routeOwner, data.newPath, {
        pending: false,
        optimistic: false,
        syncError: null,
      });
      const fileData = queryClient.getQueryData<WorkspaceFileData>(
        workspaceKeys.file(routeOwner, data.newPath)
      );
      if (fileData) {
        setWorkspaceFileState(queryClient, routeOwner, data.newPath, {
          ...fileData,
          pending: false,
          optimistic: false,
          syncError: null,
        });
      }
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.treeIndex(routeOwner),
      });
    },
    // No tree/file invalidate: the optimistic tree + caches are authoritative and
    // the real state is patched in onSuccess. Refetching would hit GitHub's
    // eventually-consistent API and flicker the renamed item.
  });

  const deleteMutation = useOptimisticMutation<
    { path: string },
    DeleteMutationVariables,
    { previousLocation: string | null; parentPath: string }
  >({
    mutationFn: async ({ item }) => {
      if (item.type === "dir") {
        return deleteDirectoryAction(routeOwner, item.path, "Delete directory");
      }

      return deleteFileAction(routeOwner, item.path, item.sha, "Delete file");
    },
    getQueryKeys: (queryClient, { item }) => [
      workspaceKeys.tree(routeOwner, getParentPath(item.path)),
      ...(item.type === "dir"
        ? getWorkspaceQueryKeysForPath(queryClient, routeOwner, item.path)
        : [workspaceKeys.file(routeOwner, item.path)]),
    ],
    applyOptimisticUpdate: (queryClient, { item }) => {
      const parentPath = getParentPath(item.path);
      setItemToDelete(null);

      removeWorkspaceTreeItem(queryClient, routeOwner, item.path);
      if (item.type === "dir") {
        removeWorkspaceDescendantCaches(queryClient, routeOwner, item.path);
      } else {
        queryClient.removeQueries({
          queryKey: workspaceKeys.file(routeOwner, item.path),
          exact: true,
        });
      }

      let previousLocation: string | null = null;
      if (isPathOrDescendant(currentPath, item.path)) {
        previousLocation = pathname;
        router.push(getWorkspaceBasePath(routeOwner));
      }

      toast.success(`Deleted ${item.name}`);

      return {
        previousLocation,
        parentPath,
      };
    },
    rollback: (queryClient, variables, error, state) => {
      restoreSnapshots(queryClient, state.snapshots);
      if (state.context.previousLocation) {
        router.push(state.context.previousLocation);
      }
      toast.error(error.message || "Failed to delete item.");
      markWorkspaceTreeItemState(queryClient, routeOwner, variables.item.path, {
        pending: false,
        optimistic: false,
        syncError: "Delete failed",
      });
    },
    onSuccess: (queryClient) => {
      // Removal is already reflected optimistically in the live cache; just mark
      // the search index stale so deleted items drop from unexpanded-folder search.
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.treeIndex(routeOwner),
      });
    },
  });

  const createFolderMutation = useOptimisticMutation<
    { path: string; gitkeepPath: string },
    CreateFolderMutationVariables,
    { parentPath: string; newPath: string }
  >({
    mutationFn: async ({ parentPath, folderName: nextFolderName }) => {
      const newPath = parentPath
        ? `${parentPath}/${nextFolderName}`
        : nextFolderName;

      return createDirectoryAction(
        routeOwner,
        newPath,
        `Create directory ${newPath}`
      );
    },
    getQueryKeys: (_queryClient, { parentPath, folderName: nextFolderName }) => {
      const newPath = parentPath
        ? `${parentPath}/${nextFolderName}`
        : nextFolderName;

      return [
        workspaceKeys.tree(routeOwner, parentPath),
        workspaceKeys.tree(routeOwner, newPath),
      ];
    },
    applyOptimisticUpdate: (queryClient, { parentPath, folderName: nextFolderName }) => {
      const newPath = parentPath
        ? `${parentPath}/${nextFolderName}`
        : nextFolderName;

      setFolderDialogOpen(false);
      setFolderParentPath(null);
      setFolderName("");

      upsertWorkspaceTreeItem(queryClient, routeOwner, {
        name: nextFolderName,
        path: newPath,
        sha: `optimistic:${newPath}`,
        type: "dir",
        pending: true,
        optimistic: true,
        syncError: null,
      });
      queryClient.setQueryData(workspaceKeys.tree(routeOwner, newPath), []);

      toast.success(`Folder “${nextFolderName}” created`);

      return {
        parentPath,
        newPath,
      };
    },
    rollback: (queryClient, _variables, error, state) => {
      restoreSnapshots(queryClient, state.snapshots);
      toast.error(error.message || "Failed to create folder.");
    },
    onSuccess: (queryClient, data) => {
      // Clear the "syncing" marker once GitHub confirms; no toast/invalidate here
      // so the user-perceived result stays the instant optimistic one.
      markWorkspaceTreeItemState(queryClient, routeOwner, data.path, {
        pending: false,
        optimistic: false,
        syncError: null,
      });
      // Mark the search index stale so it reflects the new folder on next open.
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.treeIndex(routeOwner),
      });
    },
  });

  const handleRename = React.useCallback((item: WorkspaceTreeItem) => {
    setItemToRename(item);
    setNewName(item.name);
  }, []);

  const handleRenameSubmit = () => {
    if (!itemToRename || !newName || newName === itemToRename.name) {
      setItemToRename(null);
      return;
    }

    renameMutation.mutate({
      item: itemToRename,
      newName,
    });
  };

  const handleDeleteSubmit = () => {
    if (!itemToDelete) {
      return;
    }

    deleteMutation.mutate({ item: itemToDelete });
  };

  const handleCreateInFolder = React.useCallback(
    (item: WorkspaceTreeItem) => {
      openDraft(item.path);
    },
    [openDraft]
  );

  const openCreateFolderDialog = React.useCallback((parentPath: string) => {
    setFolderDialogOpen(true);
    setFolderParentPath(parentPath);
    setFolderName("");
  }, []);

  // Expose the folder-creation dialog so the command palette can trigger it
  // without duplicating the optimistic mutation/validation that lives here.
  React.useEffect(() => {
    registerCreateFolderHandler(openCreateFolderDialog);
    return () => registerCreateFolderHandler(null);
  }, [registerCreateFolderHandler, openCreateFolderDialog]);

  const handleCreateFolderInFolder = React.useCallback(
    (item: WorkspaceTreeItem) => {
      openCreateFolderDialog(item.path);
    },
    [openCreateFolderDialog]
  );

  const handleCreateFolderSubmit = () => {
    const trimmedName = folderName.trim();

    if (!trimmedName) {
      toast.error("Please enter a folder name.");
      return;
    }

    if (trimmedName.includes("/") || trimmedName.includes("\\")) {
      toast.error("Folder names cannot include path separators.");
      return;
    }

    const existingItems =
      queryClient.getQueryData<WorkspaceTreeItem[]>(
        workspaceKeys.tree(routeOwner, folderParentPath ?? "")
      ) ?? [];

    if (
      existingItems.some(
        (item) =>
          item.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      toast.error("A file or folder with that name already exists here.");
      return;
    }

    createFolderMutation.mutate({
      parentPath: folderParentPath ?? "",
      folderName: trimmedName,
    });
  };

  const showRootPlaceholder = !rootQuery.data && rootQuery.isPending;

  return (
    <>
      <Sidebar className="border-r border-sidebar-border/70">
        <SidebarContent className="pt-2">
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel>Workspace Tree</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {showRootPlaceholder ? (
                  <SidebarMenuItem>
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Loading workspace…
                    </div>
                  </SidebarMenuItem>
                ) : (
                  items.map((item) => (
                    <FileNode
                      key={getWorkspaceItemKey(item)}
                      routeOwner={routeOwner}
                      item={item}
                      currentPath={currentPath}
                      onRename={handleRename}
                      onDelete={setItemToDelete}
                      onCreateInFolder={handleCreateInFolder}
                      onCreateFolderInFolder={handleCreateFolderInFolder}
                    />
                  ))
                )}
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
              <div className="h-5 w-px shrink-0 bg-sidebar-border/70" />
              <Button
                asChild
                variant="ghost"
                size="icon"
                title="Workspace settings"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Link href={getWorkspaceSettingsPath()}>
                  <Settings2 className="h-4 w-4" />
                  <span className="sr-only">Workspace settings</span>
                </Link>
              </Button>
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <Dialog open={Boolean(itemToRename)} onOpenChange={(open) => !open && setItemToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {itemToRename?.type === "dir" ? "folder" : "file"}</DialogTitle>
            <DialogDescription>
              The tree updates immediately and syncs in the background.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Enter a new name"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleRenameSubmit();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemToRename(null)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {itemToDelete?.type === "dir" ? "folder" : "file"}?</DialogTitle>
            <DialogDescription>
              The item disappears immediately and the delete syncs in the background.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubmit}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={folderDialogOpen}
        onOpenChange={(open) => {
          setFolderDialogOpen(open);
          if (!open) {
            setFolderParentPath(null);
            setFolderName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>
              The folder appears immediately and syncs to GitHub in the background.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {folderParentPath ? (
              <p className="text-xs text-muted-foreground">
                Parent: <span className="font-mono">{folderParentPath}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Parent: workspace root</p>
            )}
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Enter a folder name"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCreateFolderSubmit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFolderDialogOpen(false);
                setFolderParentPath(null);
                setFolderName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolderSubmit}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
