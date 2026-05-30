"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createDirectory,
  deleteDirectory,
  deleteFileContent,
  getFileContent,
  getOwnerLogin,
  getRecursiveRepoTree,
  getRepositoryContents,
  renameDirectory,
  renameFileContent,
  saveFileContent,
} from "@/lib/github";
import {
  updateWorkspacePersistenceMode,
  persistWorkspaceVisit,
  getWorkspacePreferences,
  resolveRememberedWorkspaceOwner,
} from "@/lib/workspace-preferences";
import {
  type WorkspacePersistenceMode,
  WORKSPACE_REPO_NAME,
  getWorkspaceSettingsPath,
} from "@/lib/workspace";
import {
  type WorkspaceFileData,
  type WorkspacePreferencesData,
} from "@/lib/workspace-query";
import {
  filterVisibleWorkspaceTreeItems,
  isVisibleWorkspaceTreeItemName,
} from "@/lib/workspace-tree";

async function getSessionUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
}

export async function fetchRepoContents(
  routeOwner: string | null,
  path: string = ""
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const contents = await getRepositoryContents(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    path
  );

  return filterVisibleWorkspaceTreeItems(contents as Array<{ name: string }>);
}

export type WorkspaceTreeIndexEntry = {
  path: string;
  name: string;
  type: "dir" | "file";
};

/**
 * Returns the entire workspace file tree as a flat list, fetched in one recursive
 * GitHub call. Powers the command-palette search index — fetched once per palette
 * open and searched client-side, rather than listing each folder on demand.
 */
export async function fetchWorkspaceTreeIndexAction(
  routeOwner: string | null
): Promise<{ entries: WorkspaceTreeIndexEntry[]; truncated: boolean }> {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const { tree, truncated } = await getRecursiveRepoTree(
    userId,
    login,
    WORKSPACE_REPO_NAME
  );

  const entries: WorkspaceTreeIndexEntry[] = [];
  for (const entry of tree) {
    const name = entry.path.split("/").filter(Boolean).pop() ?? entry.path;
    if (!isVisibleWorkspaceTreeItemName(name)) {
      continue;
    }
    entries.push({
      path: entry.path,
      name,
      type: entry.type === "tree" ? "dir" : "file",
    });
  }

  return { entries, truncated };
}

export async function fetchWorkspaceFileAction(
  routeOwner: string | null,
  path: string
): Promise<WorkspaceFileData> {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const file = await getFileContent(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    path
  );

  return {
    path,
    content: file.content,
    sha: file.sha,
    pending: false,
    optimistic: false,
    syncError: null,
  };
}

export async function fetchWorkspacePreferencesAction(): Promise<WorkspacePreferencesData> {
  const userId = await getSessionUserId();
  const [preferences, rememberedWorkspace] = await Promise.all([
    getWorkspacePreferences(userId),
    resolveRememberedWorkspaceOwner(userId),
  ]);

  return {
    persistenceMode: preferences.persistenceMode,
    currentOwner: rememberedWorkspace.hasRememberedOwner
      ? rememberedWorkspace.rememberedOwner
      : null,
    pending: false,
    optimistic: false,
    syncError: null,
  };
}

export async function saveNoteAction(
  routeOwner: string | null,
  path: string,
  content: string,
  sha: string | undefined,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const result = await saveFileContent(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    path,
    content,
    message,
    sha
  );

  // No revalidatePath here: the client holds the authoritative optimistic state
  // and reconciles via the returned SHA. Revalidating would force a refetch from
  // GitHub's eventually-consistent content API and flicker the just-written item.
  return {
    path: result.content?.path ?? path,
    sha: result.content?.sha ?? sha ?? "",
  };
}

export async function deleteFileAction(
  routeOwner: string | null,
  path: string,
  sha: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  await deleteFileContent(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    path,
    message,
    sha
  );

  return {
    path,
  };
}

export async function renameFileAction(
  routeOwner: string | null,
  oldPath: string,
  newPath: string,
  sha: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  await renameFileContent(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    oldPath,
    newPath,
    message,
    sha
  );

  return {
    oldPath,
    newPath,
  };
}

export async function deleteDirectoryAction(
  routeOwner: string | null,
  path: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  await deleteDirectory(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    path,
    message
  );

  return {
    path,
  };
}

export async function createDirectoryAction(
  routeOwner: string | null,
  path: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const result = await createDirectory(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    path,
    message
  );

  return {
    path: result.path,
    gitkeepPath: result.gitkeepPath,
  };
}

export async function renameDirectoryAction(
  routeOwner: string | null,
  oldPath: string,
  newPath: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  await renameDirectory(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    oldPath,
    newPath,
    message
  );

  return {
    oldPath,
    newPath,
  };
}

export async function rememberWorkspaceVisitAction(routeOwner: string | null) {
  const userId = await getSessionUserId();
  await persistWorkspaceVisit(userId, routeOwner);
}

export async function updateWorkspacePersistenceModeAction(
  mode: WorkspacePersistenceMode,
  currentOwner: string | null
) {
  const userId = await getSessionUserId();
  await updateWorkspacePersistenceMode(userId, mode, currentOwner);
  revalidatePath("/workspace");
  revalidatePath(getWorkspaceSettingsPath());

  return {
    persistenceMode: mode,
    currentOwner,
  };
}
