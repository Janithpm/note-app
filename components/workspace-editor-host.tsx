"use client";

import { MarkdownEditor } from "@/components/markdown-editor";
import { useWorkspaceDraft } from "@/components/workspace-draft-provider";

/**
 * Renders the workspace editor pane from client-side navigation state so opening
 * a note or starting a draft updates the pane *instantly* — no server navigation
 * gating the view, and the loading skeleton shows during the fetch. Falls back to
 * the route's server content (home/settings) when no note/draft is active.
 */
export function WorkspaceEditorHost({
  routeOwner,
  children,
}: {
  routeOwner: string | null;
  children: React.ReactNode;
}) {
  const { draft, closeDraft, markDraftSaved, activeNotePath } =
    useWorkspaceDraft();

  if (draft) {
    const initialPath = draft.folder ? `${draft.folder}/` : "";

    return (
      <div className="flex h-full min-h-0 flex-col">
        <MarkdownEditor
          isNew
          inline
          routeOwner={routeOwner}
          initialPath={initialPath}
          onCreated={markDraftSaved}
          onCancel={closeDraft}
        />
      </div>
    );
  }

  // Client-side editor routing: render the active note from client state, which
  // the tree sets the instant a row is clicked (before any server navigation).
  // The pane swaps immediately and shows the named loading skeleton during the
  // fetch, instead of leaving the previous note frozen while the server resolves.
  if (activeNotePath) {
    return (
      <div key={activeNotePath} className="flex h-full min-h-0 flex-col">
        <MarkdownEditor path={activeNotePath} routeOwner={routeOwner} />
      </div>
    );
  }

  return <>{children}</>;
}
