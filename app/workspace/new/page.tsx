import { MarkdownEditor } from "@/components/markdown-editor";

export default async function NewFilePage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MarkdownEditor
        initialContent="# New Note\n\nStart typing here..."
        isNew={true}
      />
    </div>
  );
}