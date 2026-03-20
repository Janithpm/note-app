import { MarkdownEditor } from "@/components/markdown-editor";

export default async function NewFilePage({
  params
}: {
  params: Promise<{ owner: string; name: string }>
}) {
  const { owner, name } = await params;
  
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MarkdownEditor 
        initialContent="# New Note\n\nStart typing here..." 
        owner={owner}
        repo={name}
        isNew={true}
      />
    </div>
  );
}
