import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getFileContent } from "@/lib/github";
import { MarkdownEditor } from "@/components/markdown-editor";

export default async function BlobPage({
  params
}: {
  params: Promise<{ owner: string; name: string; path: string[] }>
}) {
  const { owner, name, path } = await params;
  const filePath = path.join("/");
  
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  let fileData = null;
  try {
    fileData = await getFileContent(session.user.id, owner, name, filePath);
  } catch {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Error loading file</h2>
          <p className="text-muted-foreground">The file might be too large, not a text file, or no longer exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MarkdownEditor 
        initialContent={fileData.content} 
        sha={fileData.sha}
        owner={owner}
        repo={name}
        path={filePath}
      />
    </div>
  );
}
