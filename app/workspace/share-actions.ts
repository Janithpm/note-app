"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createShare,
  findActiveShareForTarget,
  revokeShare,
} from "@/lib/share";
import { type ShareExpiry, type ShareTargetType } from "@/lib/share-types";

async function getSessionUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
}

export type ShareLinkInfo = {
  token: string;
  targetType: ShareTargetType;
  expiresAt: string | null;
};

function toInfo(row: {
  token: string;
  targetType: string;
  expiresAt: Date | null;
}): ShareLinkInfo {
  return {
    token: row.token,
    targetType: row.targetType as ShareTargetType,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

/**
 * Idempotently creates (or returns the existing active) read-only share link
 * for a note or folder owned by the current user.
 */
export async function createShareLinkAction(
  routeOwner: string | null,
  path: string,
  type: ShareTargetType,
  expiry: ShareExpiry,
): Promise<ShareLinkInfo> {
  const userId = await getSessionUserId();
  const trimmed = path.trim();
  if (!trimmed && type === "file") {
    throw new Error("A note path is required.");
  }

  const row = await createShare(userId, routeOwner, trimmed, type, expiry);
  return toInfo(row);
}

/** Returns the current active share link for a target, or null if none. */
export async function getShareLinkForTargetAction(
  routeOwner: string | null,
  path: string,
  type: ShareTargetType,
): Promise<ShareLinkInfo | null> {
  const userId = await getSessionUserId();
  const row = await findActiveShareForTarget(
    userId,
    routeOwner,
    path.trim(),
    type,
  );
  return row ? toInfo(row) : null;
}

/** Revokes a share link the current user owns. */
export async function revokeShareLinkAction(token: string): Promise<boolean> {
  const userId = await getSessionUserId();
  return revokeShare(userId, token);
}
