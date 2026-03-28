import { MarkdownEditor } from "@/components/markdown-editor";
import { WorkspaceQueryHydration } from "@/components/workspace-query-hydration";
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
        <WorkspaceQueryHydration
          routeOwner={owner}
          fileData={{
            path: filePath,
            content: fileData.content,
            sha: fileData.sha,
            pending: false,
            optimistic: false,
            syncError: null,
          }}
        >
          <div className="flex h-full min-h-0 flex-col">
            <MarkdownEditor path={filePath} routeOwner={owner} />
          </div>
        </WorkspaceQueryHydration>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <MarkdownEditor path={filePath} routeOwner={owner} />
        </div>
      )}
    </WorkspaceShell>
  );
}
