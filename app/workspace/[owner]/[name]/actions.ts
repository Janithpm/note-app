"use server";

import { fetchRepoContents as fetchWorkspaceRepoContents } from "@/app/workspace/actions";

export async function fetchRepoContents(owner: string, repo: string, path: string = "") {
  return fetchWorkspaceRepoContents(path);
}
