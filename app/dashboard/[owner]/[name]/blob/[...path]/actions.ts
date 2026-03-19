"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { saveFileContent } from "@/lib/github";
import { revalidatePath } from "next/cache";

export async function saveNoteAction(
  owner: string, 
  repo: string, 
  path: string, 
  content: string, 
  sha: string,
  message: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  
  await saveFileContent(session.user.id, owner, repo, path, content, message, sha);
  revalidatePath(`/dashboard/${owner}/${repo}/blob/${path}`);
  return true;
}
