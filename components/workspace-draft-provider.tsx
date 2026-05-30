"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getWorkspaceBlobPath } from "@/lib/workspace";
import { recordRecentNote } from "@/lib/recent-notes";

type DraftState = {
  /** Parent folder the new note will be created in ("" = workspace root). */
  folder: string;
  /** Path the draft was saved as (set once it transitions to a real file). */
  savedPath: string | null;
};

type WorkspaceDraftContextValue = {
  draft: DraftState | null;
  openDraft: (folder?: string) => void;
  closeDraft: () => void;
  /** Mark the active draft as saved to `path` (keeps the editor mounted in place). */
  markDraftSaved: (path: string) => void;
  /**
   * The note currently shown in the editor pane, tracked client-side so clicking
   * a tree item swaps the pane instantly (no server navigation gating the view).
   * `null` means show the route's normal content (home/settings).
   */
  activeNotePath: string | null;
  /** Open a note in place: updates the pane immediately and syncs the URL. */
  openNote: (path: string) => void;
};

const WorkspaceDraftContext =
  React.createContext<WorkspaceDraftContextValue | null>(null);

function getBlobPathFromPathname(pathname: string): string | null {
  const markerIndex = pathname.indexOf("/blob/");
  if (markerIndex === -1) {
    return null;
  }
  const raw = pathname.slice(markerIndex + "/blob/".length);
  return raw ? decodeURIComponent(raw) : null;
}

/**
 * Holds client-side workspace navigation state so opening or creating a note
 * updates the editor pane *instantly*, without waiting on a server navigation /
 * workspace-shell refetch. The tree triggers `openNote`/`openDraft`; the editor
 * host renders from this state and shows the loading skeleton during the fetch.
 */
export function WorkspaceDraftProvider({
  routeOwner,
  children,
}: {
  routeOwner: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [draft, setDraft] = React.useState<DraftState | null>(null);
  // Seed from the URL so a hard load / refresh of a blob URL shows that note.
  const [activeNotePath, setActiveNotePath] = React.useState<string | null>(() =>
    getBlobPathFromPathname(pathname)
  );

  // Keep in sync when the route changes via Next navigation (deep link, redirect,
  // home/settings links). Tree clicks set state directly for instant feedback.
  React.useEffect(() => {
    setActiveNotePath(getBlobPathFromPathname(pathname));
  }, [pathname]);

  // Our note opens use history.pushState (no Next navigation), so the browser
  // back/forward buttons fire popstate without updating usePathname. Sync the
  // active note from the URL on popstate so back/forward work as expected.
  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPopState = () => {
      setActiveNotePath(getBlobPathFromPathname(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openNote = React.useCallback(
    (path: string) => {
      setDraft(null);
      setActiveNotePath(path);
      // Record in recents (single chokepoint: tree clicks, palette, deep links
      // all open notes via this callback). Not done in the popstate/pathname
      // sync effects, so back/forward doesn't double-count.
      recordRecentNote(routeOwner, path);
      // Update the URL without a Next navigation (no server round-trip), so the
      // pane swap is instant but the note stays deep-linkable / refreshable.
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", getWorkspaceBlobPath(routeOwner, path));
      }
    },
    [routeOwner]
  );

  const openDraft = React.useCallback((folder: string = "") => {
    setDraft({ folder, savedPath: null });
  }, []);

  const closeDraft = React.useCallback(() => {
    setDraft(null);
  }, []);

  const markDraftSaved = React.useCallback((path: string) => {
    setDraft((current) => (current ? { ...current, savedPath: path } : current));
  }, []);

  const value = React.useMemo(
    () => ({
      draft,
      openDraft,
      closeDraft,
      markDraftSaved,
      activeNotePath,
      openNote,
    }),
    [draft, openDraft, closeDraft, markDraftSaved, activeNotePath, openNote]
  );

  return (
    <WorkspaceDraftContext.Provider value={value}>
      {children}
    </WorkspaceDraftContext.Provider>
  );
}

export function useWorkspaceDraft() {
  const context = React.useContext(WorkspaceDraftContext);
  if (!context) {
    throw new Error(
      "useWorkspaceDraft must be used within a WorkspaceDraftProvider"
    );
  }
  return context;
}
