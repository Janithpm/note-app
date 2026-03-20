import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceChooser } from "@/components/workspace-chooser";
import { WorkspaceToast } from "@/components/workspace-toast";
import { getWorkspaceOwners } from "@/lib/github";
import { resolveRememberedWorkspaceOwner } from "@/lib/workspace-preferences";
import { getWorkspaceBasePath } from "@/lib/workspace";

export const metadata = {
  title: "Workspace",
  description: "Choose or open your active note workspace.",
};

export default async function WorkspaceEntryPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const workspaceOwners = await getWorkspaceOwners(session.user.id);
  const rememberedWorkspace = await resolveRememberedWorkspaceOwner(
    session.user.id
  );

  if (workspaceOwners.owners.length === 1) {
    redirect(getWorkspaceBasePath(workspaceOwners.profileOwner.routeSegment));
  }

  if (rememberedWorkspace.hasRememberedOwner) {
    const rememberedOwner = workspaceOwners.owners.find(
      (owner) =>
        owner.routeSegment?.toLowerCase() ===
        rememberedWorkspace.rememberedOwner?.toLowerCase()
    );

    if (rememberedOwner?.routeSegment) {
      redirect(getWorkspaceBasePath(rememberedOwner.routeSegment));
    }
  }

  return (
    <>
      {workspaceOwners.warning ? (
        <WorkspaceToast message={workspaceOwners.warning.message} />
      ) : null}
      <WorkspaceChooser owners={workspaceOwners.owners} />
    </>
  );
}
