// Pure, dependency-free path helpers for the repo-relative paths that identify
// workspace files/folders. Kept free of React/query/server imports so they can be
// shared by client components, the query cache layer, and `server-only` modules
// (e.g. share-link path migration) alike.

export function getParentPath(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function getBaseName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function isPathOrDescendant(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function remapPathPrefix(path: string, oldPrefix: string, newPrefix: string) {
  if (!isPathOrDescendant(path, oldPrefix)) {
    return path;
  }

  if (path === oldPrefix) {
    return newPrefix;
  }

  return `${newPrefix}${path.slice(oldPrefix.length)}`;
}

/**
 * Splits a file basename into its stem and extension on the LAST dot, so
 * "notes.tar.md" -> { stem: "notes.tar", ext: ".md" }. A leading-dot name
 * ("\.gitkeep") or no dot yields an empty ext.
 */
function splitExtension(baseName: string): { stem: string; ext: string } {
  const dot = baseName.lastIndexOf(".");
  if (dot <= 0) {
    return { stem: baseName, ext: "" };
  }
  return { stem: baseName.slice(0, dot), ext: baseName.slice(dot) };
}

/**
 * Picks a non-colliding "duplicate" name for an item being copied into the same
 * folder: "note.md" -> "note (copy).md" -> "note (copy 2).md" …; folders/no-ext ->
 * "folder (copy)" -> "folder (copy 2)" …. `takenNames` are the existing sibling
 * names (matched case-insensitively).
 */
export function nextDuplicateName(
  baseName: string,
  takenNames: string[],
  isDir: boolean
): string {
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  const { stem, ext } = isDir
    ? { stem: baseName, ext: "" }
    : splitExtension(baseName);

  const build = (suffix: string) => `${stem}${suffix}${ext}`;

  let candidate = build(" (copy)");
  if (!taken.has(candidate.toLowerCase())) {
    return candidate;
  }

  for (let n = 2; ; n++) {
    candidate = build(` (copy ${n})`);
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}
