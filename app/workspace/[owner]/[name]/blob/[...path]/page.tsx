import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getWorkspaceOwners } from "@/lib/github";
import { getWorkspaceBlobPath, WORKSPACE_REPO_NAME } from "@/lib/workspace";

export const metadata = {
  title: "Workspace File Redirect",
  description: "Redirects legacy workspace file URLs to the canonical route.",
};

export default async function LegacyBlobPage({
  params,
}: {
  params: Promise<{ owner: string; name: string; path: string[] }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const { owner, name, path } = await params;
  if (name !== WORKSPACE_REPO_NAME) {
    notFound();
  }

  const workspaceOwners = await getWorkspaceOwners(session.user.id);
  if (workspaceOwners.profileOwner.login.toLowerCase() === owner.toLowerCase()) {
    redirect(getWorkspaceBlobPath(null, path.join("/")));
  }

  const organization = workspaceOwners.owners.find(
    (workspaceOwner) =>
      workspaceOwner.routeSegment?.toLowerCase() === owner.toLowerCase()
  );

  if (!organization) {
    notFound();
  }

  redirect(getWorkspaceBlobPath(organization.routeSegment, path.join("/")));
}
