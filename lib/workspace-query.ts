import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  fetchRepoContents,
  fetchWorkspaceFileAction,
  fetchWorkspacePreferencesAction,
} from "@/app/workspace/actions";
import {
  PERSONAL_WORKSPACE_SEGMENT,
  type WorkspaceOwnerOption,
  type WorkspacePersistenceMode,
} from "@/lib/workspace";
import { filterVisibleWorkspaceTreeItems } from "@/lib/workspace-tree";

export type WorkspaceSyncMetadata = {
  pending?: boolean;
  syncError?: string | null;
  optimistic?: boolean;
};

export type WorkspaceTreeItem = WorkspaceSyncMetadata & {
  name: string;
  path: string;
  sha: string;
  type: "dir" | "file" | string;
};

export type WorkspaceFileData = WorkspaceSyncMetadata & {
  path: string;
  content: string;
  sha?: string;
};

export type WorkspacePreferencesData = WorkspaceSyncMetadata & {
  persistenceMode: WorkspacePersistenceMode;
  currentOwner: string | null;
};

type WorkspaceQueryOptions = {
  enabled?: boolean;
  initialData?: WorkspaceTreeItem[] | WorkspaceFileData | WorkspacePreferencesData;
};

type SnapshotEntry = {
  queryKey: QueryKey;
  data: unknown;
};

type OptimisticMutationState<TContext> = {
  snapshots: SnapshotEntry[];
  context: TContext;
};

type OptimisticMutationOptions<TData, TVariables, TContext> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  getQueryKeys: (
    queryClient: QueryClient,
    variables: TVariables
  ) => QueryKey[];
  applyOptimisticUpdate: (
    queryClient: QueryClient,
    variables: TVariables
  ) => TContext | Promise<TContext>;
  rollback?: (
    queryClient: QueryClient,
    variables: TVariables,
    error: Error,
    state: OptimisticMutationState<TContext>
  ) => void;
  invalidate?: (
    queryClient: QueryClient,
    variables: TVariables,
    data: TData | undefined,
    error: Error | null,
    state: OptimisticMutationState<TContext>
  ) => Promise<void> | void;
  onSuccess?: (
    queryClient: QueryClient,
    data: TData,
    variables: TVariables,
    state: OptimisticMutationState<TContext>
  ) => Promise<void> | void;
};

function normalizePath(path: string | null | undefined) {
  return path ?? "";
}

export function normalizeRouteOwner(routeOwner: string | null | undefined) {
  return routeOwner ?? PERSONAL_WORKSPACE_SEGMENT;
}

export const workspaceKeys = {
  owner(routeOwner: string | null | undefined) {
    return ["workspace", normalizeRouteOwner(routeOwner)] as const;
  },
  tree(routeOwner: string | null | undefined, path = "") {
    return [...workspaceKeys.owner(routeOwner), "tree", normalizePath(path)] as const;
  },
  file(routeOwner: string | null | undefined, path: string) {
    return [...workspaceKeys.owner(routeOwner), "file", normalizePath(path)] as const;
  },
  preferences() {
    return ["workspace", "preferences"] as const;
  },
};

export function getWorkspaceItemKey(item: WorkspaceTreeItem) {
  return `${item.type}:${item.path || item.sha}`;
}

export function sortWorkspaceTreeItems(items: WorkspaceTreeItem[]) {
  return [...items].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
}

export function getParentPath(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function getBaseName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function isPathOrDescendant(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function remapPathPrefix(path: string, oldPrefix: string, newPrefix: string) {
  if (!isPathOrDescendant(path, oldPrefix)) {
    return path;
  }

  if (path === oldPrefix) {
    return newPrefix;
  }

  return `${newPrefix}${path.slice(oldPrefix.length)}`;
}

function remapTreeItemPath(
  item: WorkspaceTreeItem,
  oldPrefix: string,
  newPrefix: string
) {
  const nextPath = remapPathPrefix(item.path, oldPrefix, newPrefix);

  if (nextPath === item.path) {
    return item;
  }

  return {
    ...item,
    path: nextPath,
    name: getBaseName(nextPath),
  };
}

function uniqueKeys(queryKeys: QueryKey[]) {
  const seen = new Set<string>();
  return queryKeys.filter((queryKey) => {
    const serialized = JSON.stringify(queryKey);
    if (seen.has(serialized)) {
      return false;
    }
    seen.add(serialized);
    return true;
  });
}

function createSnapshots(queryClient: QueryClient, queryKeys: QueryKey[]) {
  return uniqueKeys(queryKeys).map((queryKey) => ({
    queryKey,
    data: queryClient.getQueryData(queryKey),
  }));
}

export function restoreSnapshots(
  queryClient: QueryClient,
  snapshots: SnapshotEntry[]
) {
  for (const snapshot of snapshots) {
    if (typeof snapshot.data === "undefined") {
      queryClient.removeQueries({ queryKey: snapshot.queryKey, exact: true });
      continue;
    }

    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  }
}

function matchesWorkspaceQueryPrefix(queryKey: QueryKey, prefix: readonly unknown[]) {
  return prefix.every((part, index) => queryKey[index] === part);
}

function getWorkspaceCacheEntries(
  queryClient: QueryClient,
  routeOwner: string | null | undefined
) {
  const prefix = workspaceKeys.owner(routeOwner);
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: prefix })
    .map((query) => ({
      queryKey: query.queryKey,
      data: query.state.data,
    }))
    .filter((entry) => matchesWorkspaceQueryPrefix(entry.queryKey, prefix));
}

export function getWorkspaceQueryKeysForPath(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  path: string
) {
  return getWorkspaceCacheEntries(queryClient, routeOwner)
    .filter((entry) => {
      const kind = entry.queryKey[2];
      const entryPath = typeof entry.queryKey[3] === "string" ? entry.queryKey[3] : "";
      return (
        (kind === "tree" || kind === "file") &&
        isPathOrDescendant(entryPath, path)
      );
    })
    .map((entry) => entry.queryKey);
}

export function useWorkspaceTreeQuery(
  routeOwner: string | null,
  path: string,
  options?: Omit<WorkspaceQueryOptions, "initialData"> & {
    initialData?: WorkspaceTreeItem[];
  }
) {
  return useQuery({
    queryKey: workspaceKeys.tree(routeOwner, path),
    queryFn: async () => {
      const data = await fetchRepoContents(routeOwner, path);
      return sortWorkspaceTreeItems(
        filterVisibleWorkspaceTreeItems(data as WorkspaceTreeItem[])
      );
    },
    enabled: options?.enabled,
    initialData: options?.initialData,
  });
}

export function useWorkspaceFileQuery(
  routeOwner: string | null,
  path: string,
  options?: Omit<WorkspaceQueryOptions, "initialData"> & {
    initialData?: WorkspaceFileData;
  }
) {
  return useQuery({
    queryKey: workspaceKeys.file(routeOwner, path),
    queryFn: async () => fetchWorkspaceFileAction(routeOwner, path),
    enabled: (options?.enabled ?? true) && Boolean(path),
    initialData: options?.initialData,
  });
}

export function useWorkspacePreferencesQuery(
  options?: Omit<WorkspaceQueryOptions, "initialData"> & {
    initialData?: WorkspacePreferencesData;
  }
) {
  return useQuery({
    queryKey: workspaceKeys.preferences(),
    queryFn: fetchWorkspacePreferencesAction,
    enabled: options?.enabled,
    initialData: options?.initialData,
  });
}

export function useOptimisticMutation<TData, TVariables, TContext>(
  options: OptimisticMutationOptions<TData, TVariables, TContext>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, OptimisticMutationState<TContext>>({
    mutationFn: options.mutationFn,
    onMutate: async (variables) => {
      const queryKeys = uniqueKeys(options.getQueryKeys(queryClient, variables));

      await Promise.all(
        queryKeys.map((queryKey) =>
          queryClient.cancelQueries({ queryKey, exact: true })
        )
      );

      const snapshots = createSnapshots(queryClient, queryKeys);
      const context = await options.applyOptimisticUpdate(queryClient, variables);

      return {
        snapshots,
        context,
      };
    },
    onError: (error, variables, state) => {
      if (!state) {
        return;
      }

      if (options.rollback) {
        options.rollback(queryClient, variables, error, state);
        return;
      }

      restoreSnapshots(queryClient, state.snapshots);
    },
    onSuccess: async (data, variables, state) => {
      if (!state || !options.onSuccess) {
        return;
      }

      await options.onSuccess(queryClient, data, variables, state);
    },
    onSettled: async (data, error, variables, state) => {
      if (!state || !options.invalidate) {
        return;
      }

      await options.invalidate(queryClient, variables, data, error, state);
    },
  });
}

export function updateWorkspaceTreeListing(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  parentPath: string,
  updater: (items: WorkspaceTreeItem[]) => WorkspaceTreeItem[]
) {
  const queryKey = workspaceKeys.tree(routeOwner, parentPath);
  const existing = queryClient.getQueryData<WorkspaceTreeItem[]>(queryKey);

  if (!existing) {
    return;
  }

  queryClient.setQueryData(queryKey, sortWorkspaceTreeItems(updater(existing)));
}

export function upsertWorkspaceTreeItem(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  item: WorkspaceTreeItem
) {
  const parentPath = getParentPath(item.path);
  const queryKey = workspaceKeys.tree(routeOwner, parentPath);
  const existing = queryClient.getQueryData<WorkspaceTreeItem[]>(queryKey);

  if (!existing) {
    return;
  }

  const nextItems = existing.some((entry) => entry.path === item.path)
    ? existing.map((entry) => (entry.path === item.path ? item : entry))
    : [...existing, item];

  queryClient.setQueryData(queryKey, sortWorkspaceTreeItems(nextItems));
}

export function removeWorkspaceTreeItem(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  path: string
) {
  const parentPath = getParentPath(path);
  updateWorkspaceTreeListing(queryClient, routeOwner, parentPath, (items) =>
    items.filter((item) => item.path !== path)
  );
}

export function moveWorkspaceFileCache(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  oldPath: string,
  newPath: string
) {
  const oldKey = workspaceKeys.file(routeOwner, oldPath);
  const nextKey = workspaceKeys.file(routeOwner, newPath);
  const previous = queryClient.getQueryData<WorkspaceFileData>(oldKey);

  if (!previous) {
    return;
  }

  queryClient.setQueryData(nextKey, {
    ...previous,
    path: newPath,
  });
  queryClient.removeQueries({ queryKey: oldKey, exact: true });
}

export function remapWorkspaceDescendantCaches(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  oldPath: string,
  newPath: string
) {
  const entries = getWorkspaceCacheEntries(queryClient, routeOwner);

  for (const entry of entries) {
    const kind = entry.queryKey[2];
    const entryPath = typeof entry.queryKey[3] === "string" ? entry.queryKey[3] : null;

    if (!entryPath || !isPathOrDescendant(entryPath, oldPath)) {
      continue;
    }

    const nextPath = remapPathPrefix(entryPath, oldPath, newPath);
    const nextKey =
      kind === "tree"
        ? workspaceKeys.tree(routeOwner, nextPath)
        : workspaceKeys.file(routeOwner, nextPath);

    const nextData =
      kind === "tree"
        ? sortWorkspaceTreeItems(
            ((entry.data as WorkspaceTreeItem[] | undefined) ?? []).map((item) =>
              remapTreeItemPath(item, oldPath, newPath)
            )
          )
        : entry.data
          ? {
              ...(entry.data as WorkspaceFileData),
              path: nextPath,
            }
          : entry.data;

    queryClient.setQueryData(nextKey, nextData);
    queryClient.removeQueries({ queryKey: entry.queryKey, exact: true });
  }
}

export function removeWorkspaceDescendantCaches(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  path: string
) {
  const entries = getWorkspaceCacheEntries(queryClient, routeOwner);

  for (const entry of entries) {
    const kind = entry.queryKey[2];
    const entryPath = typeof entry.queryKey[3] === "string" ? entry.queryKey[3] : null;

    if ((kind === "tree" || kind === "file") && entryPath && isPathOrDescendant(entryPath, path)) {
      queryClient.removeQueries({ queryKey: entry.queryKey, exact: true });
    }
  }
}

export function markWorkspaceTreeItemState(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  path: string,
  metadata: WorkspaceSyncMetadata
) {
  const parentPath = getParentPath(path);

  updateWorkspaceTreeListing(queryClient, routeOwner, parentPath, (items) =>
    items.map((item) => (item.path === path ? { ...item, ...metadata } : item))
  );
}

export function setWorkspaceFileState(
  queryClient: QueryClient,
  routeOwner: string | null | undefined,
  path: string,
  data: WorkspaceFileData
) {
  queryClient.setQueryData(workspaceKeys.file(routeOwner, path), data);
}

export function getRouteOwnerLabel(
  owners: WorkspaceOwnerOption[],
  routeOwner: string | null
) {
  return (
    owners.find((owner) => owner.routeSegment === normalizeRouteOwner(routeOwner)) ??
    owners[0]
  );
}
