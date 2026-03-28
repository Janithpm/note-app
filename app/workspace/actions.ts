"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createDirectory,
  deleteDirectory,
  deleteFileContent,
  getFileContent,
  getRepositoryContents,
  renameDirectory,
  renameFileContent,
  resolveWorkspaceOwner,
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
  getWorkspaceBasePath,
  getWorkspaceBlobPath,
  getWorkspaceSettingsPath,
} from "@/lib/workspace";
import {
  type WorkspaceFileData,
  type WorkspacePreferencesData,
} from "@/lib/workspace-query";
import { filterVisibleWorkspaceTreeItems } from "@/lib/workspace-tree";

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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  const contents = await getRepositoryContents(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    path
  );

  return filterVisibleWorkspaceTreeItems(contents as Array<{ name: string }>);
}

export async function fetchWorkspaceFileAction(
  routeOwner: string | null,
  path: string
): Promise<WorkspaceFileData> {
  const userId = await getSessionUserId();
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  const file = await getFileContent(
    userId,
    workspace.activeOwner.login,
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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  const result = await saveFileContent(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    path,
    content,
    message,
    sha
  );

  revalidatePath(getWorkspaceBlobPath(routeOwner, path));
  revalidatePath(getWorkspaceBasePath(routeOwner));
  revalidatePath("/workspace");

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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  await deleteFileContent(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    path,
    message,
    sha
  );

  revalidatePath(getWorkspaceBasePath(routeOwner));
  revalidatePath("/workspace");

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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  await renameFileContent(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    oldPath,
    newPath,
    message,
    sha
  );

  revalidatePath(getWorkspaceBlobPath(routeOwner, newPath));
  revalidatePath(getWorkspaceBasePath(routeOwner));
  revalidatePath("/workspace");

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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  await deleteDirectory(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    path,
    message
  );

  revalidatePath(getWorkspaceBasePath(routeOwner));
  revalidatePath("/workspace");

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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  const result = await createDirectory(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    path,
    message
  );

  revalidatePath(getWorkspaceBasePath(routeOwner));
  revalidatePath("/workspace");

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
  const workspace = await resolveWorkspaceOwner(userId, routeOwner);

  if (!workspace.activeOwner) {
    throw new Error("Workspace not available");
  }

  await renameDirectory(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    oldPath,
    newPath,
    message
  );

  revalidatePath(getWorkspaceBasePath(routeOwner));
  revalidatePath("/workspace");

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
