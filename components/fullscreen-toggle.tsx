"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "./ui/button";

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Toggle fullscreen on 'f' (only if not typing in an input/textarea)
      if (
        e.key.toLowerCase() === 'f' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !(e.ctrlKey || e.metaKey || e.altKey) // Don't trigger if modifiers are pressed
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleFullscreen]);

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleFullscreen} 
      title="Toggle Fullscreen (F or Esc to exit)"
      className="text-muted-foreground hover:text-foreground"
    >
      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </Button>
  );
}
