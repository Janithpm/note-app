import { cache } from "react";

import {
  getOrCreateWorkspaceRepo,
  getRepositoryContents,
  getWorkspaceWarningFromRepoError,
  resolveWorkspaceOwner,
} from "@/lib/github";
import { type WorkspaceWarning, WORKSPACE_REPO_NAME } from "@/lib/workspace";

type RepoTreeItem = {
  name: string;
  path: string;
  sha: string;
  type: string;
};

export const getWorkspaceShellData = cache(
  async (userId: string, routeOwner: string | null) => {
    const workspace = await resolveWorkspaceOwner(userId, routeOwner);
    let initialData: RepoTreeItem[] = [];
    let errorTitle: string | null = null;
    let errorDescription: string | null = null;
    let warning: WorkspaceWarning | null = workspace.warning;

    if (!workspace.activeOwner) {
      return {
        workspace,
        initialData,
        warning,
        errorTitle,
        errorDescription,
      };
    }

    try {
      await getOrCreateWorkspaceRepo(userId, workspace.activeOwner);
      initialData = (await getRepositoryContents(
        userId,
        workspace.activeOwner.login,
        WORKSPACE_REPO_NAME,
        ""
      )) as RepoTreeItem[];
    } catch (error) {
      console.error(error);
      warning ??= getWorkspaceWarningFromRepoError(error, workspace.activeOwner);
      errorTitle =
        workspace.activeOwner.kind === "organization"
          ? "Unable to open this organization workspace"
          : "Unable to initialize your workspace";
      errorDescription =
        warning?.message ??
        "The workspace repo could not be loaded right now. Please try again in a moment.";
    }

    return {
      workspace,
      initialData,
      warning,
      errorTitle,
      errorDescription,
    };
  }
);

export function preloadWorkspaceShellData(
  userId: string,
  routeOwner: string | null
) {
  void getWorkspaceShellData(userId, routeOwner);
}
