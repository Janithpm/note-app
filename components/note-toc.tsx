"use client";

import * as React from "react";
import { List, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type TocHeading = {
  id: string;
  text: string;
  depth: number;
};

/**
 * On-this-page table of contents as a slide-in right drawer. Off-screen by
 * default with a slim edge tab; clicking the tab slides the panel in. Keeps the
 * reading surface clean and undistracting while the TOC stays one click away.
 */
export function NoteToc({ headings }: { headings: TocHeading[] }) {
  const [open, setOpen] = React.useState(false);

  if (headings.length === 0) {
    return null;
  }

  return (
    <>
      {/* Edge tab — only when closed, vertically centered on the right border. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="On this page"
          className="absolute top-1/2 right-0 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-l-md border border-r-0 border-border/60 bg-background/90 py-3 pr-1.5 pl-2 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
        >
          <List className="size-4" />
          <span
            className="text-[10px] font-medium uppercase tracking-[0.15em]"
            style={{ writingMode: "vertical-rl" }}
          >
            On this page
          </span>
        </button>
      ) : null}

      {/* Click-away backdrop. */}
      {open ? (
        <div
          className="absolute inset-0 z-20"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Sliding panel. */}
      <aside
        className={cn(
          "absolute inset-y-0 right-0 z-30 flex w-72 flex-col border-l border-border/70 bg-background/95 shadow-xl backdrop-blur transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <List className="size-4" />
            <span>On this page</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {headings.map((heading) => (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              style={{ paddingLeft: `${(heading.depth - 1) * 0.75 + 0.5}rem` }}
            >
              <span className="line-clamp-2">{heading.text}</span>
            </a>
          ))}
        </nav>
      </aside>
    </>
  );
}
