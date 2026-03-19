import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getRepositoryContents } from "@/lib/github";
import { FileTree } from "@/components/file-tree";

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

  let initialData: any[] = [];
  try {
    initialData = (await getRepositoryContents(session.user.id, owner, name, "")) as any[];
  } catch (e) {
    console.error(e);
  }

  return (
    <>
      <FileTree owner={owner} repo={name} initialData={initialData} />
      <div className="flex-1 overflow-y-auto min-w-0 h-full relative">
        {children}
      </div>
    </>
  );
}
