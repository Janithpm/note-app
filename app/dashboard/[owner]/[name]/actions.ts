"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getRepositoryContents } from "@/lib/github";

export async function fetchRepoContents(owner: string, repo: string, path: string = "") {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  return getRepositoryContents(session.user.id, owner, repo, path);
}
