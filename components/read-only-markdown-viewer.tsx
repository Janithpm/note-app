"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { NoteToc } from "@/components/note-toc";
import { extractTOC } from "@/lib/toc";

/**
 * Read-only Markdown renderer with a table-of-contents drawer. Shared by the
 * editor's read mode and the public share page so both render identically.
 */
export function ReadOnlyMarkdownViewer({
  content,
  title,
  path,
}: {
  content: string;
  title: string;
  path?: string;
}) {
  const toc = useMemo(() => extractTOC(content), [content]);

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8 md:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <div className="mb-8 border-b pb-4">
            <h1 className="truncate text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {path ? (
              <div className="mt-1 truncate text-sm tracking-wide text-muted-foreground">
                {path}
              </div>
            ) : null}
          </div>
          <div className="prose prose-sm max-w-none text-foreground prose-a:text-primary prose-headings:text-foreground md:prose-base dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <NoteToc headings={toc} />
    </div>
  );
}
