"use client";

import { useEffect, useRef } from "react";

import { rememberWorkspaceVisitAction } from "@/app/workspace/actions";

export function WorkspaceVisitTracker({
  routeOwner,
}: {
  routeOwner: string | null;
}) {
  const lastRemembered = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (lastRemembered.current === routeOwner) {
      return;
    }

    lastRemembered.current = routeOwner;
    void rememberWorkspaceVisitAction(routeOwner);
  }, [routeOwner]);

  return null;
}
