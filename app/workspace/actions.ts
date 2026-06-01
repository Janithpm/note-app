"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  copyDirectory,
  copyFileContent,
  createDirectory,
  deleteDirectory,
  deleteFileContent,
  getFileContent,
  getOwnerLogin,
  getRecursiveRepoTree,
  getRepositoryContents,
  searchRepoCode,
  renameDirectory,
  renameFileContent,
  saveFileContent,
} from "@/lib/github";
import { getBaseName, getParentPath, isPathOrDescendant } from "@/lib/path-utils";
import { migrateSharePathsForMove } from "@/lib/share";
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

export type WorkspaceCodeSearchResult = {
  path: string;
  name: string;
  /** Text-match fragment from GitHub, or null when none was provided. */
  fragment: string | null;
};

/**
 * Server-side content search over the workspace repo's Markdown files via
 * GitHub's code-search index. Powers the "remote" half of hybrid content search
 * — coverage for notes not in the local cache. Returns [] on error/rate-limit.
 */
export async function searchWorkspaceCodeAction(
  routeOwner: string | null,
  query: string
): Promise<WorkspaceCodeSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const matches = await searchRepoCode(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    trimmed
  );

  return matches.map((match) => ({
    path: match.path,
    name: match.path.split("/").filter(Boolean).pop() ?? match.path,
    fragment: match.fragment,
  }));
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

export type SaveNoteResult =
  | { ok: true; path: string; sha: string }
  | { ok: false; reason: "conflict"; remoteSha?: string; remoteContent?: string }
  | { ok: false; reason: "error"; message: string };

export async function saveNoteAction(
  routeOwner: string | null,
  path: string,
  content: string,
  sha: string | undefined,
  message: string
): Promise<SaveNoteResult> {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  try {
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
      ok: true,
      path: result.content?.path ?? path,
      sha: result.content?.sha ?? sha ?? "",
    };
  } catch (error) {
    // GitHub returns 409 when the base SHA no longer matches HEAD — i.e. the
    // file changed on the remote since this edit's base. Surface the remote
    // version so the client can offer keep-mine / keep-remote.
    const status = (error as { status?: number })?.status;
    if (status === 409 || status === 422) {
      try {
        const remote = await getFileContent(
          userId,
          login,
          WORKSPACE_REPO_NAME,
          path
        );
        return {
          ok: false,
          reason: "conflict",
          remoteSha: remote.sha,
          remoteContent: remote.content,
        };
      } catch {
        return { ok: false, reason: "conflict" };
      }
    }

    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Save failed",
    };
  }
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

/**
 * Validates a move/copy request and returns the computed destination path.
 * `destParentPath` is the folder being dropped onto ("" = workspace root). The
 * destination path is derived server-side from the source basename rather than
 * trusting a client-sent value.
 */
function resolveMoveOrCopyDest(
  sourcePath: string,
  destParentPath: string,
  isDir: boolean
): string {
  const baseName = getBaseName(sourcePath);
  const destPath = destParentPath ? `${destParentPath}/${baseName}` : baseName;

  if (getParentPath(sourcePath) === destParentPath) {
    throw new Error("Item is already here.");
  }

  if (
    isDir &&
    (destParentPath === sourcePath || isPathOrDescendant(destParentPath, sourcePath))
  ) {
    throw new Error("Cannot move a folder into itself.");
  }

  return destPath;
}

/**
 * Validates a copy/duplicate request against an explicit destination path. Unlike
 * a move, a duplicate intentionally lands in the same parent (different basename),
 * so there is no no-op guard — only the self/descendant guard for directories.
 */
function resolveCopyDest(sourcePath: string, destPath: string, isDir: boolean) {
  if (
    isDir &&
    (destPath === sourcePath || isPathOrDescendant(destPath, sourcePath))
  ) {
    throw new Error("Cannot copy a folder into itself.");
  }
}

/**
 * Rejects the operation when an item with the same name already exists in the
 * destination folder. Defense in depth on top of the client's cache check — closes
 * the race where the local tree is stale. A 404 means the parent is new/empty.
 */
async function assertNoCollision(
  userId: string,
  login: string,
  destParentPath: string,
  baseName: string
) {
  try {
    const contents = await getRepositoryContents(
      userId,
      login,
      WORKSPACE_REPO_NAME,
      destParentPath
    );
    if (
      Array.isArray(contents) &&
      contents.some((entry) => (entry as { name?: string }).name === baseName)
    ) {
      throw new Error("An item with that name already exists here.");
    }
  } catch (error) {
    if ((error as { status?: number })?.status === 404) {
      return;
    }
    throw error;
  }
}

export async function moveFileAction(
  routeOwner: string | null,
  sourcePath: string,
  destParentPath: string,
  sha: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const destPath = resolveMoveOrCopyDest(sourcePath, destParentPath, false);
  await assertNoCollision(userId, login, destParentPath, getBaseName(sourcePath));

  await renameFileContent(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    sourcePath,
    destPath,
    message,
    sha
  );
  await migrateSharePathsForMove(userId, routeOwner, sourcePath, destPath, "file");

  return { oldPath: sourcePath, newPath: destPath };
}

export async function moveDirectoryAction(
  routeOwner: string | null,
  sourcePath: string,
  destParentPath: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  const destPath = resolveMoveOrCopyDest(sourcePath, destParentPath, true);
  await assertNoCollision(userId, login, destParentPath, getBaseName(sourcePath));

  await renameDirectory(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    sourcePath,
    destPath,
    message
  );
  await migrateSharePathsForMove(userId, routeOwner, sourcePath, destPath, "dir");

  return { oldPath: sourcePath, newPath: destPath };
}

export async function copyFileAction(
  routeOwner: string | null,
  sourcePath: string,
  destPath: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  resolveCopyDest(sourcePath, destPath, false);
  await assertNoCollision(
    userId,
    login,
    getParentPath(destPath),
    getBaseName(destPath)
  );

  const result = await copyFileContent(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    sourcePath,
    destPath,
    message
  );

  // No share migration: the copy is private.
  return { sourcePath, newPath: destPath, sha: result.sha };
}

export async function copyDirectoryAction(
  routeOwner: string | null,
  sourcePath: string,
  destPath: string,
  message: string
) {
  const userId = await getSessionUserId();
  const login = await getOwnerLogin(userId, routeOwner);

  resolveCopyDest(sourcePath, destPath, true);
  await assertNoCollision(
    userId,
    login,
    getParentPath(destPath),
    getBaseName(destPath)
  );

  await copyDirectory(
    userId,
    login,
    WORKSPACE_REPO_NAME,
    sourcePath,
    destPath,
    message
  );

  // No share migration: the copy is private.
  return { sourcePath, newPath: destPath };
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
