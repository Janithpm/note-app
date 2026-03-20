import { Loader2 } from "lucide-react";

export function WorkspaceLoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Switching workspace
          </p>
          <p className="text-sm text-muted-foreground">
            Loading the selected GitHub context and workspace files.
          </p>
        </div>
      </div>
    </div>
  );
}
