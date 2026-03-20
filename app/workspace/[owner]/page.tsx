import { WorkspaceHome } from "@/components/workspace-home";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceShellData } from "@/lib/workspace-data";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export default async function OrganizationWorkspacePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const session = await requireWorkspaceSession();

  const { owner } = await params;
  const { workspace } = await getWorkspaceShellData(session.user.id, owner);

  return (
    <WorkspaceShell userId={session.user.id} routeOwner={owner}>
      <WorkspaceHome ownerLabel={`${workspace.activeOwner?.label ?? owner} workspace`} />
    </WorkspaceShell>
  );
}
