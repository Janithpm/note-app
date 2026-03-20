import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceShellData } from "@/lib/workspace-data";
import { requireWorkspaceSession } from "@/lib/workspace-session";
import { getFileContent } from "@/lib/github";
import { WORKSPACE_REPO_NAME } from "@/lib/workspace";

export default async function OrganizationBlobPage({
  params,
}: {
  params: Promise<{ owner: string; path: string[] }>;
}) {
  const session = await requireWorkspaceSession();

  const { owner, path } = await params;
  const filePath = path.join("/");
  const { workspace } = await getWorkspaceShellData(session.user.id, owner);

  let fileData = null;
  try {
    if (workspace.activeOwner) {
      fileData = await getFileContent(
        session.user.id,
        workspace.activeOwner.login,
        WORKSPACE_REPO_NAME,
        filePath
      );
    }
  } catch {
    fileData = null;
  }

  return (
    <WorkspaceShell userId={session.user.id} routeOwner={owner}>
      {fileData ? (
        <div className="flex h-full min-h-0 flex-col">
          <MarkdownEditor
            initialContent={fileData.content}
            path={filePath}
            routeOwner={owner}
            sha={fileData.sha}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <h2 className="text-xl font-semibold text-destructive">
              Error loading file
            </h2>
            <p className="text-muted-foreground">
              The file might be too large, not a text file, or no longer exists.
            </p>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
