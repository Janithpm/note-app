export const WORKSPACE_HIDDEN_FILE_NAMES = new Set([".gitkeep"]);

export function isVisibleWorkspaceTreeItemName(name: string) {
  return !WORKSPACE_HIDDEN_FILE_NAMES.has(name);
}

export function filterVisibleWorkspaceTreeItems<T extends { name: string }>(
  items: T[]
) {
  return items.filter((item) => isVisibleWorkspaceTreeItemName(item.name));
}
