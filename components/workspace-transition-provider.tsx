"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import { WorkspaceLoadingScreen } from "@/components/workspace-loading-screen";

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
  const pathname = usePathname();
  const [transitionStartPath, setTransitionStartPath] = useState<string | null>(
    null
  );
  const isSwitchingWorkspace = transitionStartPath === pathname;

  const value = useMemo<WorkspaceTransitionContextValue>(
    () => ({
      beginWorkspaceTransition: () => setTransitionStartPath(pathname),
    }),
    [pathname]
  );

  return (
    <WorkspaceTransitionContext.Provider value={value}>
      {children}
      {isSwitchingWorkspace ? (
        <div className="fixed inset-0 z-[120]">
          <WorkspaceLoadingScreen />
        </div>
      ) : null}
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
