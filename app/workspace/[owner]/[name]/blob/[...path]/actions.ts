"use server";

import { saveNoteAction as saveWorkspaceNoteAction } from "@/app/workspace/actions";

export async function saveNoteAction(
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string | undefined,
  message: string
) {
  return saveWorkspaceNoteAction(path, content, sha, message);
}
