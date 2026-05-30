import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { makeQueryClient } from "@/lib/query-client";
import {
  sortWorkspaceTreeItems,
  type WorkspaceFileData,
  type WorkspacePreferencesData,
  type WorkspaceTreeItem,
  workspaceKeys,
} from "@/lib/workspace-query";
import { filterVisibleWorkspaceTreeItems } from "@/lib/workspace-tree";

type WorkspaceQueryHydrationProps = {
  routeOwner?: string | null;
  treePath?: string;
  treeData?: WorkspaceTreeItem[];
  fileData?: WorkspaceFileData;
  preferencesData?: WorkspacePreferencesData;
  children: React.ReactNode;
};

/**
 * Seeds server-fetched workspace data into a dehydrated state and merges it into
 * the shared QueryProvider client via HydrationBoundary, so the tree/file the
 * server already fetched renders instantly without a client-side refetch.
 */
export function WorkspaceQueryHydration({
  routeOwner = null,
  treePath = "",
  treeData,
  fileData,
  preferencesData,
  children,
}: WorkspaceQueryHydrationProps) {
  const queryClient = makeQueryClient();

  if (treeData) {
    queryClient.setQueryData(
      workspaceKeys.tree(routeOwner, treePath),
      sortWorkspaceTreeItems(filterVisibleWorkspaceTreeItems(treeData))
    );
  }

  if (fileData) {
    queryClient.setQueryData(
      workspaceKeys.file(routeOwner, fileData.path),
      fileData
    );
  }

  if (preferencesData) {
    queryClient.setQueryData(workspaceKeys.preferences(), preferencesData);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
