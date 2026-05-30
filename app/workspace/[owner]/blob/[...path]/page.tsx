import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export default async function OrganizationBlobPage({
  params,
}: {
  params: Promise<{ owner: string; path: string[] }>;
}) {
  const session = await requireWorkspaceSession();

  const { owner, path } = await params;
  const filePath = path.join("/");

  // We intentionally do NOT fetch the file content server-side here. Blocking the
  // navigation on a GitHub round-trip is what made opening a note freeze the pane.
  // The editor reads from the persistent client cache first (instant on a hit) and
  // shows a named document skeleton while a genuine cache miss loads.
  return (
    <WorkspaceShell userId={session.user.id} routeOwner={owner}>
      <div className="flex h-full min-h-0 flex-col">
        <MarkdownEditor path={filePath} routeOwner={owner} />
      </div>
    </WorkspaceShell>
  );
}
