import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export default async function OrganizationNewWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireWorkspaceSession();

  const { owner } = await params;
  const resolvedSearchParams = await searchParams;
  const folder = resolvedSearchParams.folder as string | undefined;
  
  const initialPath = folder ? `${folder}/` : "";

  return (
    <WorkspaceShell userId={session.user.id} routeOwner={owner}>
      <div className="flex h-full min-h-0 flex-col">
        <MarkdownEditor
          initialContent="# New Note\n\nStart typing here..."
          isNew
          routeOwner={owner}
          path={initialPath}
        />
      </div>
    </WorkspaceShell>
  );
}
