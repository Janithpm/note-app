import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

function getNoteName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/**
 * Document-shaped loading placeholder shown while a note is being fetched. Labels
 * the note by name so the user knows exactly what is loading instead of staring
 * at a frozen pane. Reused by the editor and the route-level blob loading screen.
 */
export function NoteLoadingState({ path }: { path: string }) {
  const name = getNoteName(path);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 md:px-8 md:py-10">
        <div className="mb-8 flex items-center gap-2 border-b pb-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>
            Loading <span className="font-medium text-foreground">{name}</span>…
          </span>
        </div>

        <div className="space-y-6" aria-hidden>
          {/* Title */}
          <Skeleton className="h-8 w-2/5" />

          {/* Paragraph blocks */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>

          {/* Subheading */}
          <Skeleton className="h-6 w-1/3" />

          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-8/12" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-7/12" />
          </div>
        </div>
      </div>
    </div>
  );
}
