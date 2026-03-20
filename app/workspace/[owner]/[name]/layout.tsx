import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getRepositoryContents } from "@/lib/github";
import { FileTree } from "@/components/file-tree";
import { RepositoryHeader } from "@/components/repository-header";
import { SearchPalette } from "@/components/search-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type RepoTreeItem = {
  name: string;
  path: string;
  sha: string;
  type: string;
};

export default async function RepositoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; name: string }>;
}) {
  const { owner, name } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  let initialData: RepoTreeItem[] = [];
  try {
    initialData = (await getRepositoryContents(
      session.user.id,
      owner,
      name,
      ""
    )) as RepoTreeItem[];
  } catch (e) {
    console.error(e);
  }

  return (
    <>
      <SearchPalette />
      <SidebarProvider defaultOpen>
        <FileTree owner={owner} repo={name} initialData={initialData} />
        <SidebarInset className="min-w-0">
          <RepositoryHeader owner={owner} repo={name} />
          <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
