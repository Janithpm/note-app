import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { shareLink } from "@/lib/db/schema";
import {
  getFileContent,
  getOwnerLogin,
  getRepositoryContents,
} from "@/lib/github";
import { WORKSPACE_REPO_NAME } from "@/lib/workspace";
import { filterVisibleWorkspaceTreeItems } from "@/lib/workspace-tree";
import { type ShareExpiry, type ShareTargetType } from "@/lib/share-types";

export type { ShareExpiry, ShareTargetType };

export type ShareRecord = typeof shareLink.$inferSelect;

export type ShareListingItem = {
  name: string;
  /** Path relative to the share root (used to build the public URL subpath). */
  subpath: string;
  type: ShareTargetType;
};

export type ShareBreadcrumb = {
  label: string;
  /** Subpath relative to the share root ("" = root). */
  subpath: string;
};

/** Result of resolving a public share token + optional subpath. */
export type ShareView =
  | { kind: "not-found" }
  | {
      kind: "file";
      title: string;
      /** Repo-relative path, shown to the viewer. */
      path: string;
      content: string;
    }
  | {
      kind: "dir";
      /** Folder name shown as the listing heading. */
      title: string;
      items: ShareListingItem[];
      breadcrumbs: ShareBreadcrumb[];
    };

const TOKEN_BYTES = 24;

function generateToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function expiryToDate(expiry: ShareExpiry, now: Date): Date | null {
  if (expiry === "never") return null;
  const days = expiry === "7d" ? 7 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Octokit surfaces HTTP status on the thrown error; 404 = file/dir gone. */
function isNotFoundError(error: unknown): boolean {
  return (error as { status?: number })?.status === 404;
}

/**
 * Looks up the active (not revoked, not expired) share for a target. `routeOwner`
 * is nullable, so it's matched with IS NOT DISTINCT FROM.
 */
export async function findActiveShareForTarget(
  ownerUserId: string,
  routeOwner: string | null,
  targetPath: string,
  targetType: ShareTargetType,
): Promise<ShareRecord | null> {
  const rows = await db
    .select()
    .from(shareLink)
    .where(
      and(
        eq(shareLink.ownerUserId, ownerUserId),
        sql`${shareLink.routeOwner} is not distinct from ${routeOwner}`,
        eq(shareLink.targetPath, targetPath),
        eq(shareLink.targetType, targetType),
        isNull(shareLink.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  // Treat an expired-but-not-revoked row as inactive.
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

/**
 * Idempotently creates (or returns the existing) active share for a target.
 * Retries token generation on the rare unique collision.
 */
export async function createShare(
  ownerUserId: string,
  routeOwner: string | null,
  targetPath: string,
  targetType: ShareTargetType,
  expiry: ShareExpiry,
): Promise<ShareRecord> {
  const existing = await findActiveShareForTarget(
    ownerUserId,
    routeOwner,
    targetPath,
    targetType,
  );
  if (existing) return existing;

  const now = new Date();
  const expiresAt = expiryToDate(expiry, now);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db
        .insert(shareLink)
        .values({
          id: randomUUID(),
          token: generateToken(),
          ownerUserId,
          routeOwner,
          targetPath,
          targetType,
          createdAt: now,
          expiresAt,
          revokedAt: null,
        })
        .returning();
      return row;
    } catch (error) {
      // A concurrent create may have won the partial-unique-index race, or a
      // token collided. Re-fetch the active row; otherwise retry.
      const active = await findActiveShareForTarget(
        ownerUserId,
        routeOwner,
        targetPath,
        targetType,
      );
      if (active) return active;
      if (attempt === 2) throw error;
    }
  }

  // Unreachable, but satisfies the type checker.
  throw new Error("Failed to create share link");
}

/** Revokes a share by token, but only if it belongs to `ownerUserId`. */
export async function revokeShare(
  ownerUserId: string,
  token: string,
): Promise<boolean> {
  const result = await db
    .update(shareLink)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(shareLink.token, token),
        eq(shareLink.ownerUserId, ownerUserId),
        isNull(shareLink.revokedAt),
      ),
    )
    .returning({ id: shareLink.id });
  return result.length > 0;
}

async function findShareByToken(token: string): Promise<ShareRecord | null> {
  const rows = await db
    .select()
    .from(shareLink)
    .where(eq(shareLink.token, token))
    .limit(1);
  return rows[0] ?? null;
}

function getBaseName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/**
 * Normalizes a viewer-supplied subpath and asserts it stays within the shared
 * folder. Returns the repo-relative requested path, or null if the subpath is
 * unsafe (traversal, absolute, escapes the target).
 */
function resolveContainedPath(
  targetPath: string,
  subpathSegments: string[],
): string | null {
  for (const segment of subpathSegments) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\\") ||
      segment.includes("/")
    ) {
      return null;
    }
  }

  const sub = subpathSegments.join("/");
  const requested = sub
    ? targetPath
      ? `${targetPath}/${sub}`
      : sub
    : targetPath;

  // Defense in depth: reject any residual traversal and assert containment.
  if (requested.split("/").some((part) => part === "..")) return null;
  const contained =
    targetPath === "" ||
    requested === targetPath ||
    requested.startsWith(`${targetPath}/`);
  if (!contained) return null;

  return requested;
}

function buildBreadcrumbs(
  targetPath: string,
  subpathSegments: string[],
): ShareBreadcrumb[] {
  const rootLabel = targetPath ? getBaseName(targetPath) : "Shared folder";
  const crumbs: ShareBreadcrumb[] = [{ label: rootLabel, subpath: "" }];
  let acc = "";
  for (const segment of subpathSegments) {
    acc = acc ? `${acc}/${segment}` : segment;
    crumbs.push({ label: segment, subpath: acc });
  }
  return crumbs;
}

/**
 * Resolves a public share token + optional subpath into renderable content.
 * Fetches live from GitHub using the OWNER's token, server-side only. Every
 * failure mode (missing/revoked/expired/deleted/owner-token-gone/traversal)
 * collapses to a generic `not-found` so links don't leak information.
 */
export async function loadShare(
  token: string,
  subpathSegments: string[] = [],
): Promise<ShareView> {
  const row = await findShareByToken(token);
  if (!row) return { kind: "not-found" };
  if (row.revokedAt) return { kind: "not-found" };
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return { kind: "not-found" };
  }

  const targetType = row.targetType as ShareTargetType;

  // A file share never accepts a subpath.
  if (targetType === "file" && subpathSegments.length > 0) {
    return { kind: "not-found" };
  }

  let login: string;
  try {
    login = await getOwnerLogin(row.ownerUserId, row.routeOwner);
  } catch {
    return { kind: "not-found" };
  }

  const requestedPath = resolveContainedPath(row.targetPath, subpathSegments);
  if (requestedPath === null) return { kind: "not-found" };

  try {
    if (targetType === "file") {
      const file = await getFileContent(
        row.ownerUserId,
        login,
        WORKSPACE_REPO_NAME,
        requestedPath,
      );
      return {
        kind: "file",
        title: getBaseName(requestedPath),
        path: requestedPath,
        content: file.content,
      };
    }

    // Directory share (possibly browsing into a subpath). We don't know whether
    // the requested path is a file or dir up front, so inspect the response.
    const data = await getRepositoryContents(
      row.ownerUserId,
      login,
      WORKSPACE_REPO_NAME,
      requestedPath,
    );

    if (Array.isArray(data)) {
      const items: ShareListingItem[] = filterVisibleWorkspaceTreeItems(
        data.filter(
          (entry): entry is typeof entry & { name: string } =>
            typeof entry?.name === "string",
        ),
      )
        .filter((entry) => entry.type === "file" || entry.type === "dir")
        .map((entry): ShareListingItem => {
          // The viewer navigates by subpath relative to the share root, so strip
          // the targetPath prefix from the item's repo path.
          const prefix = row.targetPath ? `${row.targetPath}/` : "";
          const subpath = entry.path.startsWith(prefix)
            ? entry.path.slice(prefix.length)
            : entry.path;
          return {
            name: entry.name,
            subpath,
            type: entry.type === "dir" ? "dir" : "file",
          };
        })
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return {
        kind: "dir",
        title: getBaseName(requestedPath) || "Shared folder",
        items,
        breadcrumbs: buildBreadcrumbs(row.targetPath, subpathSegments),
      };
    }

    // A file inside the shared folder.
    const fileData = data as { type?: string };
    if (fileData.type === "file") {
      const file = await getFileContent(
        row.ownerUserId,
        login,
        WORKSPACE_REPO_NAME,
        requestedPath,
      );
      return {
        kind: "file",
        title: getBaseName(requestedPath),
        path: requestedPath,
        content: file.content,
      };
    }

    return { kind: "not-found" };
  } catch (error) {
    if (isNotFoundError(error)) return { kind: "not-found" };
    // Owner revoked the OAuth grant (getGitHubAccount throws) or any other
    // failure: stay generic rather than leaking details.
    return { kind: "not-found" };
  }
}
