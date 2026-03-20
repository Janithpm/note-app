import { db } from "./db";
import { account } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { Octokit } from "@octokit/rest";

type GitHubFileContent = {
  type: string;
  content?: string;
  sha: string;
};

/**
 * Helper to fetch the authenticated Octokit instance for a user
 */
async function getOctokit(userId: string) {
  const [userAccount] = await db
    .select()
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

  return new Octokit({ auth: userAccount.accessToken });
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

export async function getOrCreateWorkspaceRepo(userId: string) {
  const octokit = await getOctokit(userId);
  const { data: user } = await octokit.rest.users.getAuthenticated();
  const owner = user.login;
  const repoName = "note-app-workspace";
  
  try {
    const { data: repo } = await octokit.rest.repos.get({
      owner,
      repo: repoName,
    });
    return repo;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404
    ) {
      // Create a private repo with an initial commit to avoid empty repo errors
      const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description: "Architecture workspace for note-app",
        private: true,
        auto_init: true, 
      });
      return repo;
    }
    throw error;
  }
}
