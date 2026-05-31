import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
        <WifiOff className="size-5" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hasn&apos;t been cached yet. Notes you&apos;ve already opened
          remain available, and any edits you make will sync once you&apos;re back
          online.
        </p>
      </div>
    </div>
  );
}
