import { auth } from "@/lib/auth";
import { FileTree } from "@/components/file-tree";
import { RepositoryHeader } from "@/components/repository-header";
import { SearchPalette } from "@/components/search-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getRepositoryContents, getWorkspaceRepoRef } from "@/lib/github";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type RepoTreeItem = {
  name: string;
  path: string;
  sha: string;
  type: string;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  let repoName = "Workspace";
  let initialData: RepoTreeItem[] = [];

  try {
    const { owner, repo } = await getWorkspaceRepoRef(session.user.id);
    repoName = repo;
    initialData = (await getRepositoryContents(
      session.user.id,
      owner,
      repo,
      ""
    )) as RepoTreeItem[];
  } catch (error) {
    console.error(error);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <SearchPalette />
      <SidebarProvider defaultOpen>
        <FileTree repoName={repoName} initialData={initialData} />
        <SidebarInset className="min-w-0">
          <RepositoryHeader repo={repoName} />
          <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
