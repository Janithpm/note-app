export function WorkspaceHome({ ownerLabel }: { ownerLabel: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
          Workspace ready
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {ownerLabel}
        </h2>
        <p className="text-muted-foreground">
          Select a markdown file from the sidebar or create a new note to keep your architecture docs moving.
        </p>
      </div>
    </div>
  );
}
