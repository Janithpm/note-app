import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Folder } from "lucide-react";

import { loadShare } from "@/lib/share";
import { ReadOnlyMarkdownViewer } from "@/components/read-only-markdown-viewer";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string; subpath?: string[] }>;
}) {
  const { token, subpath } = await params;
  const view = await loadShare(token, subpath ?? []);

  if (view.kind === "not-found") {
    notFound();
  }

  if (view.kind === "file") {
    return (
      <ReadOnlyMarkdownViewer
        content={view.content}
        title={view.title}
        path={view.path}
      />
    );
  }

  // Directory listing.
  const buildHref = (sub: string) =>
    sub ? `/share/${token}/${sub}` : `/share/${token}`;

  return (
    <div className="h-full overflow-y-auto px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {view.breadcrumbs.map((crumb, index) => {
            const isLast = index === view.breadcrumbs.length - 1;
            return (
              <span key={crumb.subpath} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3.5" /> : null}
                {isLast ? (
                  <span className="font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={buildHref(crumb.subpath)}
                    className="hover:text-foreground hover:underline"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>

        <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground">
          {view.title}
        </h1>

        {view.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">This folder is empty.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {view.items.map((item) => {
              return (
                <li key={item.subpath}>
                  <Link
                    href={`/share/${token}/${item.subpath}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    {item.type === "dir" ? (
                      <Folder className="size-4 shrink-0 text-primary/80" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-primary/80" />
                    )}
                    <span className="truncate text-foreground">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
