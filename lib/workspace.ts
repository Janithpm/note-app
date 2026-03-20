export const WORKSPACE_REPO_NAME = "note-app-workspace";
export const WORKSPACE_OWNER_COOKIE = "note_workspace_owner";
export const PERSONAL_WORKSPACE_COOKIE_VALUE = "__personal__";
export const PERSONAL_WORKSPACE_SEGMENT = "general";

export const RESERVED_WORKSPACE_SEGMENTS = ["blob", "new", "settings"] as const;

export type WorkspacePersistenceMode = "cookie" | "database";
export type WorkspaceOwnerKind = "profile" | "organization";
export type WorkspaceWarningCode =
  | "missing-org-scope"
  | "org-access-denied"
  | "org-repo-permission-denied";

export type WorkspaceOwnerOption = {
  kind: WorkspaceOwnerKind;
  label: string;
  login: string;
  routeSegment: string | null;
  subtitle: string;
};

export type WorkspaceWarning = {
  code: WorkspaceWarningCode;
  message: string;
};

function encodePathSegments(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getWorkspaceBasePath(routeOwner?: string | null) {
  const ownerSegment = routeOwner ?? PERSONAL_WORKSPACE_SEGMENT;
  return `/workspace/${encodeURIComponent(ownerSegment)}`;
}

export function getWorkspaceNewPath(routeOwner?: string | null) {
  return `${getWorkspaceBasePath(routeOwner)}/new`;
}

export function getWorkspaceBlobPath(
  routeOwner: string | null | undefined,
  path: string
) {
  return `${getWorkspaceBasePath(routeOwner)}/blob/${encodePathSegments(path)}`;
}

export function getWorkspaceSettingsPath() {
  return "/workspace/settings";
}

export function getWorkspaceOwnerHref(
  owner: Pick<WorkspaceOwnerOption, "routeSegment">
) {
  return getWorkspaceBasePath(owner.routeSegment);
}

export function isReservedWorkspaceSegment(segment: string) {
  return RESERVED_WORKSPACE_SEGMENTS.includes(
    segment as (typeof RESERVED_WORKSPACE_SEGMENTS)[number]
  );
}

export function serializeWorkspaceOwner(routeOwner?: string | null) {
  return routeOwner ?? PERSONAL_WORKSPACE_SEGMENT;
}

export function parseWorkspaceOwner(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  if (
    value === PERSONAL_WORKSPACE_COOKIE_VALUE ||
    value === PERSONAL_WORKSPACE_SEGMENT
  ) {
    return PERSONAL_WORKSPACE_SEGMENT;
  }

  return value;
}

export function decodeStoredWorkspaceOwner(
  value: string | null | undefined
): {
  hasValue: boolean;
  owner: string | null;
} {
  if (value == null || value === "") {
    return {
      hasValue: false,
      owner: null,
    };
  }

  return {
    hasValue: true,
    owner: parseWorkspaceOwner(value),
  };
}
