import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getWorkspaceOwners } from "@/lib/github";
import { getWorkspaceBasePath, WORKSPACE_REPO_NAME } from "@/lib/workspace";

export const metadata = {
  title: "Workspace Redirect",
  description: "Redirects legacy workspace URLs to the canonical owner route.",
};

export default async function LegacyRepositoryHomePage({
  params,
}: {
  params: Promise<{ owner: string; name: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const { owner, name } = await params;
  if (name !== WORKSPACE_REPO_NAME) {
    notFound();
  }

  const workspaceOwners = await getWorkspaceOwners(session.user.id);
  if (workspaceOwners.profileOwner.login.toLowerCase() === owner.toLowerCase()) {
    redirect("/workspace");
  }

  const organization = workspaceOwners.owners.find(
    (workspaceOwner) =>
      workspaceOwner.routeSegment?.toLowerCase() === owner.toLowerCase()
  );

  if (!organization?.routeSegment) {
    notFound();
  }

  redirect(getWorkspaceBasePath(organization.routeSegment));
}
