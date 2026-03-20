import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  type WorkspacePersistenceMode,
  WORKSPACE_OWNER_COOKIE,
  decodeStoredWorkspaceOwner,
  serializeWorkspaceOwner,
} from "@/lib/workspace";

type WorkspacePreferences = {
  persistenceMode: WorkspacePersistenceMode;
  databaseLastActiveOwner: string | null;
};

export async function getWorkspacePreferences(
  userId: string
): Promise<WorkspacePreferences> {
  const [record] = await db
    .select({
      persistenceMode: user.workspacePersistenceMode,
      databaseLastActiveOwner: user.workspaceLastActiveOwner,
    })
    .from(user)
    .where(eq(user.id, userId));

  return {
    persistenceMode:
      record?.persistenceMode === "database" ? "database" : "cookie",
    databaseLastActiveOwner: record?.databaseLastActiveOwner ?? null,
  };
}

export async function resolveRememberedWorkspaceOwner(userId: string) {
  const preferences = await getWorkspacePreferences(userId);

  if (preferences.persistenceMode === "database") {
    const storedOwner = decodeStoredWorkspaceOwner(
      preferences.databaseLastActiveOwner
    );
    return {
      persistenceMode: preferences.persistenceMode,
      rememberedOwner: storedOwner.owner,
      hasRememberedOwner: storedOwner.hasValue,
    };
  }

  const cookieStore = await cookies();
  const storedOwner = decodeStoredWorkspaceOwner(
    cookieStore.get(WORKSPACE_OWNER_COOKIE)?.value
  );
  return {
    persistenceMode: preferences.persistenceMode,
    rememberedOwner: storedOwner.owner,
    hasRememberedOwner: storedOwner.hasValue,
  };
}

export async function persistWorkspaceVisit(
  userId: string,
  routeOwner: string | null
) {
  const preferences = await getWorkspacePreferences(userId);

  if (preferences.persistenceMode === "database") {
    await db
      .update(user)
      .set({
        workspaceLastActiveOwner: serializeWorkspaceOwner(routeOwner),
      })
      .where(eq(user.id, userId));
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_OWNER_COOKIE, serializeWorkspaceOwner(routeOwner), {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
}

export async function updateWorkspacePersistenceMode(
  userId: string,
  mode: WorkspacePersistenceMode,
  currentOwner: string | null
) {
  await db
    .update(user)
    .set({
      workspacePersistenceMode: mode,
      workspaceLastActiveOwner:
        mode === "database"
          ? currentOwner
            ? serializeWorkspaceOwner(currentOwner)
            : null
          : undefined,
    })
    .where(eq(user.id, userId));

  if (mode === "cookie" && currentOwner) {
    const cookieStore = await cookies();
    cookieStore.set(
      WORKSPACE_OWNER_COOKIE,
      serializeWorkspaceOwner(currentOwner),
      {
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      }
    );
  } else if (mode === "cookie") {
    const cookieStore = await cookies();
    cookieStore.delete(WORKSPACE_OWNER_COOKIE);
  }
}
