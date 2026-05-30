"use client";

import * as React from "react";

export type PaletteOpenOptions = {
  /** Pre-seed the input. */
  initialQuery?: string;
  /** Folder that "Create note/folder" commands should target. */
  createTargetFolder?: string;
};

type PaletteContextValue = {
  isOpen: boolean;
  options: PaletteOpenOptions;
  open: (options?: PaletteOpenOptions) => void;
  close: () => void;
};

const PaletteContext = React.createContext<PaletteContextValue | null>(null);

/**
 * Owns command-palette open/close state and the global ⌘/Ctrl+K shortcut. Lets
 * any consumer open the palette with options (e.g. pre-scoped to a folder),
 * replacing the previous fragile synthetic-keydown dispatch.
 */
export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [options, setOptions] = React.useState<PaletteOpenOptions>({});

  const open = React.useCallback((nextOptions?: PaletteOpenOptions) => {
    setOptions(nextOptions ?? {});
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((current) => !current);
        setOptions({});
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = React.useMemo(
    () => ({ isOpen, options, open, close }),
    [isOpen, options, open, close]
  );

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

export function usePalette() {
  const context = React.useContext(PaletteContext);
  if (!context) {
    throw new Error("usePalette must be used within a PaletteProvider");
  }
  return context;
}
