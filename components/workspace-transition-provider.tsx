"use client";

import { createContext, useContext, useMemo } from "react";

type WorkspaceTransitionContextValue = {
  beginWorkspaceTransition: () => void;
};

const WorkspaceTransitionContext = createContext<
  WorkspaceTransitionContextValue | null
>(null);

export function WorkspaceTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useMemo<WorkspaceTransitionContextValue>(
    () => ({
      beginWorkspaceTransition: () => undefined,
    }),
    []
  );

  return (
    <WorkspaceTransitionContext.Provider value={value}>
      {children}
    </WorkspaceTransitionContext.Provider>
  );
}

export function useWorkspaceTransition() {
  const context = useContext(WorkspaceTransitionContext);

  if (!context) {
    throw new Error(
      "useWorkspaceTransition must be used within a WorkspaceTransitionProvider."
    );
  }

  return context;
}
