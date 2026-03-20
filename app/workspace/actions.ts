"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
    getRepositoryContents,
    getWorkspaceRepoRef,
    saveFileContent,
} from "@/lib/github";

async function getAuthorizedWorkspaceRepo() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const repoRef = await getWorkspaceRepoRef(session.user.id);

    return {
        userId: session.user.id,
        ...repoRef,
    };
}

export async function fetchRepoContents(path: string = "") {
    const { userId, owner, repo } = await getAuthorizedWorkspaceRepo();
    return getRepositoryContents(userId, owner, repo, path);
}

export async function saveNoteAction(
    path: string,
    content: string,
    sha: string | undefined,
    message: string
) {
    const { userId, owner, repo } = await getAuthorizedWorkspaceRepo();

    await saveFileContent(userId, owner, repo, path, content, message, sha);
    revalidatePath(`/workspace/blob/${path}`);
    revalidatePath("/workspace");

    return true;
}