"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  deleteDirectory,
  deleteFileContent,
  getRepositoryContents,
  renameDirectory,
  renameFileContent,
  resolveWorkspaceOwner,
  saveFileContent,
} from "@/lib/github";
import {
  updateWorkspacePersistenceMode,
  persistWorkspaceVisit,
} from "@/lib/workspace-preferences";
import {
  type WorkspacePersistenceMode,
  WORKSPACE_REPO_NAME,
  getWorkspaceBasePath,
  getWorkspaceBlobPath,
  getWorkspaceSettingsPath,
} from "@/lib/workspace";

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

  return getRepositoryContents(
    userId,
    workspace.activeOwner.login,
    WORKSPACE_REPO_NAME,
    path
  );
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

  await saveFileContent(
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

  return true;
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

  return true;
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

  return true;
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

  return true;
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

  return true;
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
}
