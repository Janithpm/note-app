"use client";

import { Download } from "lucide-react";

import { usePwa } from "@/components/pwa-provider";

/**
 * Header "Install" button. Renders only when the browser has offered an install
 * prompt (Chromium desktop/Android). Hidden once installed, and on browsers
 * without the prompt API (e.g. iOS Safari, which uses Share → Add to Home Screen).
 */
export function InstallButton() {
  const { canInstall, promptInstall } = usePwa();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      title="Install Note App"
      className="flex shrink-0 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Download className="size-3.5" />
      <span className="hidden sm:inline">Install</span>
    </button>
  );
}
