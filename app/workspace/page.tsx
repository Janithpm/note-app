import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrCreateWorkspaceRepo } from "@/lib/github";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  let repoUrl = "";
  try {
    const repo = await getOrCreateWorkspaceRepo(session.user.id);
    repoUrl = `/workspace/${repo.owner.login}/${repo.name}`;
  } catch (error) {
    console.error(error);
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Error Initializing Workspace</h2>
          <p className="text-muted-foreground">Make sure you&apos;ve granted GitHub repository permissions and that the token is valid.</p>
        </div>
      </div>
    );
  }

  // Next.js redirect MUST be outside try-catch to work correctly
  redirect(repoUrl);
}
