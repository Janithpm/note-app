import { cache } from "react";
import { Octokit } from "@octokit/rest";
import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { account } from "./db/schema";
import {
  PERSONAL_WORKSPACE_SEGMENT,
  WORKSPACE_REPO_NAME,
  type WorkspaceOwnerOption,
  type WorkspaceWarning,
} from "./workspace";

type GitHubFileContent = {
  type: string;
  content?: string;
  sha: string;
};

type GitHubAccount = {
  accessToken: string;
  scope: string | null;
};

function getErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

function hasScope(scope: string | null | undefined, expectedScope: string) {
  return new Set(
    (scope ?? "")
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  ).has(expectedScope);
}

function getProfileOwner(login: string): WorkspaceOwnerOption {
  return {
    kind: "profile",
    label: "Personal",
    login,
    routeSegment: PERSONAL_WORKSPACE_SEGMENT,
    subtitle: "Profile workspace",
  };
}

function getOrganizationOwner(login: string): WorkspaceOwnerOption {
  return {
    kind: "organization",
    label: login,
    login,
    routeSegment: login,
    subtitle: "Organization workspace",
  };
}

const getGitHubAccount = cache(async (userId: string): Promise<GitHubAccount> => {
  const [userAccount] = await db
    .select({
      accessToken: account.accessToken,
      scope: account.scope,
    })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "github")
      )
    );

  if (!userAccount || !userAccount.accessToken) {
    throw new Error("GitHub account not linked or missing access token");
  }

  return {
    accessToken: userAccount.accessToken,
    scope: userAccount.scope ?? null,
  };
});

async function getOctokit(userId: string) {
  const userAccount = await getGitHubAccount(userId);
  return new Octokit({ auth: userAccount.accessToken });
}

export const getWorkspaceOwners = cache(async (userId: string) => {
  const octokit = await getOctokit(userId);
  const accountData = await getGitHubAccount(userId);
  const { data: authenticatedUser } = await octokit.rest.users.getAuthenticated();

  const profileOwner = getProfileOwner(authenticatedUser.login);
  const owners: WorkspaceOwnerOption[] = [profileOwner];
  let warning: WorkspaceWarning | null = null;

  if (!hasScope(accountData.scope, "read:org")) {
    return {
      profileOwner,
      owners,
      warning: {
        code: "missing-org-scope",
        message:
          "GitHub organization access is not available for this login. Reconnect GitHub to enable org workspaces.",
      } satisfies WorkspaceWarning,
    };
  }

  try {
    const { data: organizations } = await octokit.rest.orgs.listForAuthenticatedUser(
      {
        per_page: 100,
      }
    );

    owners.push(...organizations.map((organization) => getOrganizationOwner(organization.login)));
  } catch (error) {
    const status = getErrorStatus(error);
    if (status === 403) {
      warning = {
        code: "org-access-denied",
        message:
          "GitHub organization access is not available for this login. Reconnect GitHub to enable org workspaces.",
      };
    } else {
      throw error;
    }
  }

  return {
    profileOwner,
    owners,
    warning,
  };
});

export async function resolveWorkspaceOwner(
  userId: string,
  routeOwner?: string | null
) {
  const workspaceOwners = await getWorkspaceOwners(userId);
  const normalizedRouteOwner = routeOwner?.toLowerCase() ?? null;

  if (
    !normalizedRouteOwner ||
    normalizedRouteOwner === PERSONAL_WORKSPACE_SEGMENT
  ) {
    return {
      ...workspaceOwners,
      activeOwner: workspaceOwners.profileOwner,
    };
  }

  const activeOwner =
    workspaceOwners.owners.find(
      (owner) => owner.routeSegment?.toLowerCase() === normalizedRouteOwner
    ) ?? null;

  return {
    ...workspaceOwners,
    activeOwner,
  };
}

export async function getUserRepositories(userId: string) {
  const octokit = await getOctokit(userId);
  const response = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });
  return response.data;
}

export async function getRepositoryContents(
  userId: string, 
  owner: string, 
  repo: string, 
  path: string = ""
) {
  const octokit = await getOctokit(userId);
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });
  return response.data; // An array of files/folders if path is a directory
}

export async function getFileContent(
  userId: string, 
  owner: string, 
  repo: string, 
  path: string
) {
  const octokit = await getOctokit(userId);
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });
  
  const data = response.data as GitHubFileContent;
  if (data.type !== "file" || !data.content) {
    throw new Error("Not a valid file or missing content");
  }

  // Content is Base64 encoded
  const decodedContent = Buffer.from(data.content, "base64").toString("utf-8");
  return {
    content: decodedContent,
    sha: data.sha,
  };
}

export async function saveFileContent(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  const octokit = await getOctokit(userId);
  const response = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    sha, // Required if updating an existing file
  });
  return response.data;
}

export async function deleteFileContent(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  message: string,
  sha: string
) {
  const octokit = await getOctokit(userId);
  const response = await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path,
    message,
    sha,
  });
  return response.data;
}

export async function renameFileContent(
  userId: string,
  owner: string,
  repo: string,
  oldPath: string,
  newPath: string,
  message: string,
  sha: string
) {
  const fileData = await getFileContent(userId, owner, repo, oldPath);
  await saveFileContent(userId, owner, repo, newPath, fileData.content, message);
  return deleteFileContent(userId, owner, repo, oldPath, message, sha);
}

export async function renameDirectory(
  userId: string,
  owner: string,
  repo: string,
  oldPath: string,
  newPath: string,
  message: string
) {
  const octokit = await getOctokit(userId);
  
  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
  const branchName = repoInfo.default_branch;

  const { data: branch } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: branchName,
  });
  const latestCommitSha = branch.commit.sha;

  const { data: commit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = commit.tree.sha;

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: baseTreeSha,
    recursive: "true",
  });

  const newTree: any[] = [];
  const oldPrefix = oldPath + "/";
  for (const item of treeData.tree) {
    if (item.type === "blob") {
      if (item.path?.startsWith(oldPrefix) || item.path === oldPath) {
         const relativePath = item.path.substring(oldPath.length);
         newTree.push({
           path: newPath + relativePath,
           mode: item.mode,
           type: item.type,
           sha: item.sha,
         });
         
         newTree.push({
           path: item.path,
           mode: item.mode,
           type: item.type,
           sha: null,
         });
      }
    }
  }

  if (newTree.length === 0) {
    throw new Error("No files found to rename");
  }

  const { data: newTreeData } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: newTree,
  });

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTreeData.sha,
    parents: [latestCommitSha],
  });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
    sha: newCommit.sha,
  });
}

export async function deleteDirectory(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  message: string
) {
  const octokit = await getOctokit(userId);
  
  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
  const branchName = repoInfo.default_branch;

  const { data: branch } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: branchName,
  });
  const latestCommitSha = branch.commit.sha;

  const { data: commit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = commit.tree.sha;

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: baseTreeSha,
    recursive: "true",
  });

  const newTree: any[] = [];
  const oldPrefix = path + "/";
  for (const item of treeData.tree) {
    if (item.type === "blob") {
      if (item.path?.startsWith(oldPrefix) || item.path === path) {
         newTree.push({
           path: item.path,
           mode: item.mode,
           type: item.type,
           sha: null,
         });
      }
    }
  }

  if (newTree.length === 0) {
    return;
  }

  const { data: newTreeData } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: newTree,
  });

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTreeData.sha,
    parents: [latestCommitSha],
  });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
    sha: newCommit.sha,
  });
}


export async function getOrCreateWorkspaceRepo(
  userId: string,
  owner: WorkspaceOwnerOption
) {
  const octokit = await getOctokit(userId);

  try {
    const { data: repo } = await octokit.rest.repos.get({
      owner: owner.login,
      repo: WORKSPACE_REPO_NAME,
    });
    return repo;
  } catch (error: unknown) {
    if (getErrorStatus(error) === 404) {
      const request =
        owner.kind === "organization"
          ? octokit.rest.repos.createInOrg({
              org: owner.login,
              name: WORKSPACE_REPO_NAME,
              description: "Architecture workspace for note-app",
              private: true,
              auto_init: true,
            })
          : octokit.rest.repos.createForAuthenticatedUser({
              name: WORKSPACE_REPO_NAME,
              description: "Architecture workspace for note-app",
              private: true,
              auto_init: true,
            });

      const { data: repo } = await request;
      return repo;
    }
    throw error;
  }
}

export function getWorkspaceWarningFromRepoError(
  error: unknown,
  owner: WorkspaceOwnerOption
): WorkspaceWarning | null {
  if (owner.kind !== "organization") {
    return null;
  }

  const status = getErrorStatus(error);
  if (status === 403 || status === 404) {
    return {
      code: "org-repo-permission-denied",
      message:
        "GitHub organization access is available, but this app cannot create or use the workspace repo in that organization.",
    };
  }

  return null;
}
