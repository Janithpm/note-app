import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export default async function OrganizationNewWorkspacePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const session = await requireWorkspaceSession();

  const { owner } = await params;

  return (
    <WorkspaceShell userId={session.user.id} routeOwner={owner}>
      <div className="flex h-full min-h-0 flex-col">
        <MarkdownEditor
          initialContent="# New Note\n\nStart typing here..."
          isNew
          routeOwner={owner}
        />
      </div>
    </WorkspaceShell>
  );
}
