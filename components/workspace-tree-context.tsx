"use client";

import * as React from "react";

type RevealTarget = {
  /** Folder path to expand and scroll into view. */
  path: string;
  /** Bumped each request so repeat reveals of the same path still trigger. */
  nonce: number;
};

type WorkspaceTreeContextValue = {
  /** The folder the tree should expand + reveal (null when none pending). */
  revealTarget: RevealTarget | null;
  /** Request the tree to expand and reveal a folder path. */
  expandReveal: (path: string) => void;
  /** Open the "create folder" dialog targeting `parentPath` ("" = root). */
  openCreateFolderDialog: (parentPath: string) => void;
  /** Registered by the file tree so external callers can drive its dialog. */
  registerCreateFolderHandler: (
    handler: ((parentPath: string) => void) | null
  ) => void;
};

const WorkspaceTreeContext =
  React.createContext<WorkspaceTreeContextValue | null>(null);

/**
 * Cross-component control surface for the sidebar file tree: lets the command
 * palette expand/reveal a folder and open the tree's existing folder-creation
 * dialog (whose optimistic mutation + validation stay inside the tree).
 */
export function WorkspaceTreeContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [revealTarget, setRevealTarget] = React.useState<RevealTarget | null>(
    null
  );
  const createFolderHandlerRef = React.useRef<
    ((parentPath: string) => void) | null
  >(null);
  const nonceRef = React.useRef(0);

  const expandReveal = React.useCallback((path: string) => {
    nonceRef.current += 1;
    setRevealTarget({ path, nonce: nonceRef.current });
  }, []);

  const openCreateFolderDialog = React.useCallback((parentPath: string) => {
    createFolderHandlerRef.current?.(parentPath);
  }, []);

  const registerCreateFolderHandler = React.useCallback(
    (handler: ((parentPath: string) => void) | null) => {
      createFolderHandlerRef.current = handler;
    },
    []
  );

  const value = React.useMemo(
    () => ({
      revealTarget,
      expandReveal,
      openCreateFolderDialog,
      registerCreateFolderHandler,
    }),
    [revealTarget, expandReveal, openCreateFolderDialog, registerCreateFolderHandler]
  );

  return (
    <WorkspaceTreeContext.Provider value={value}>
      {children}
    </WorkspaceTreeContext.Provider>
  );
}

export function useWorkspaceTreeContext() {
  const context = React.useContext(WorkspaceTreeContext);
  if (!context) {
    throw new Error(
      "useWorkspaceTreeContext must be used within a WorkspaceTreeContextProvider"
    );
  }
  return context;
}
