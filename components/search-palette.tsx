"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  FilePlus,
  FileText,
  FolderOpen,
  FolderPlus,
  Loader2,
  Moon,
  Settings,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { usePalette } from "@/components/palette-provider";
import { useWorkspaceDraft } from "@/components/workspace-draft-provider";
import { useWorkspaceTreeContext } from "@/components/workspace-tree-context";
import { useRecentNotes } from "@/lib/recent-notes";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  getBaseName,
  getParentPath,
  getWorkspaceFilesFromCache,
  getWorkspaceTreeItemsFromCache,
  useWorkspaceCodeSearchQuery,
  useWorkspaceTreeIndexQuery,
} from "@/lib/workspace-query";
import {
  indexEntriesToItems,
  mergeSearchableItems,
  rankItems,
  treeItemsToSearchable,
  type SearchableItem,
} from "@/lib/workspace-search";
import {
  mergeContentMatches,
  searchCachedContent,
  type ContentMatch,
} from "@/lib/workspace-content-search";
import { useContentPrefetch } from "@/lib/use-content-prefetch";
import { useOfflineSync } from "@/components/offline-sync-provider";
import { getWorkspaceSettingsPath } from "@/lib/workspace";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

/**
 * Renders a content-match snippet, bolding the matched term. Local matches carry
 * exact offsets (matchStart >= 0); remote matches show the raw fragment as-is.
 */
function renderSnippet(match: ContentMatch): React.ReactNode {
  if (match.matchStart < 0 || match.matchLength <= 0) {
    return match.snippet;
  }
  const before = match.snippet.slice(0, match.matchStart);
  const hit = match.snippet.slice(
    match.matchStart,
    match.matchStart + match.matchLength
  );
  const after = match.snippet.slice(match.matchStart + match.matchLength);
  return (
    <>
      {before}
      <mark className="bg-transparent font-semibold text-foreground">{hit}</mark>
      {after}
    </>
  );
}

export function SearchPalette({ routeOwner }: { routeOwner: string | null }) {
  const { isOpen, options, open, close } = usePalette();
  const { openNote, openDraft } = useWorkspaceDraft();
  const { expandReveal, openCreateFolderDialog } = useWorkspaceTreeContext();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const recents = useRecentNotes(routeOwner);
  const indexQuery = useWorkspaceTreeIndexQuery(routeOwner, { enabled: isOpen });

  const createTargetFolder = options.createTargetFolder ?? "";

  // Reset the input to the requested initial query whenever the palette opens.
  React.useEffect(() => {
    if (isOpen) {
      setQuery(options.initialQuery ?? "");
    }
  }, [isOpen, options.initialQuery]);

  const runAndClose = React.useCallback(
    (action: () => void) => {
      action();
      close();
    },
    [close]
  );

  const commands = React.useMemo<Command[]>(
    () => [
      {
        id: "create-note",
        label: createTargetFolder
          ? `Create note in ${createTargetFolder}`
          : "Create note",
        keywords: "create new note file add",
        icon: FilePlus,
        run: () => runAndClose(() => openDraft(createTargetFolder)),
      },
      {
        id: "create-folder",
        label: createTargetFolder
          ? `Create folder in ${createTargetFolder}`
          : "Create folder",
        keywords: "create new folder directory add",
        icon: FolderPlus,
        run: () => runAndClose(() => openCreateFolderDialog(createTargetFolder)),
      },
      {
        id: "settings",
        label: "Go to settings",
        keywords: "settings preferences profile",
        icon: Settings,
        run: () => runAndClose(() => router.push(getWorkspaceSettingsPath())),
      },
      {
        id: "toggle-theme",
        label: "Toggle theme",
        keywords: "theme dark light mode appearance",
        icon: Moon,
        run: () =>
          runAndClose(() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          ),
      },
    ],
    [
      createTargetFolder,
      openCreateFolderDialog,
      openDraft,
      resolvedTheme,
      router,
      runAndClose,
      setTheme,
    ]
  );

  // Local-first candidate set: live cache (instant) merged with the recursive
  // index (arrives when the fetch resolves). Recomputed when the cache/index or
  // the palette-open toggles.
  const mergedItems = React.useMemo<SearchableItem[]>(() => {
    if (!isOpen) {
      return [];
    }
    const cacheItems = treeItemsToSearchable(
      getWorkspaceTreeItemsFromCache(queryClient, routeOwner)
    );
    const indexItems = indexEntriesToItems(indexQuery.data?.entries ?? []);
    return mergeSearchableItems(cacheItems, indexItems);
  }, [isOpen, queryClient, routeOwner, indexQuery.data]);

  const recentPaths = React.useMemo(
    () => recents.map((entry) => entry.path),
    [recents]
  );

  const results = React.useMemo(
    () =>
      rankItems(mergedItems, debouncedQuery, {
        recentPaths,
        limit: 50,
      }),
    [mergedItems, debouncedQuery, recentPaths]
  );

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const filteredCommands = normalizedQuery
    ? commands.filter(
        (command) =>
          command.label.toLowerCase().includes(normalizedQuery) ||
          command.keywords.includes(normalizedQuery)
      )
    : commands;

  // Recents that still exist in the known set (drop entries for deleted notes).
  const knownPaths = React.useMemo(
    () => new Set(mergedItems.map((item) => item.path)),
    [mergedItems]
  );
  const visibleRecents = React.useMemo(
    () =>
      recents.filter(
        (entry) => knownPaths.size === 0 || knownPaths.has(entry.path)
      ),
    [recents, knownPaths]
  );

  const handleSelectItem = (item: SearchableItem) => {
    if (item.type === "file") {
      runAndClose(() => openNote(item.path));
      return;
    }
    // Folder: expand + reveal it in the tree, and re-scope the palette so the
    // next actions are "Create note/folder here".
    expandReveal(item.path);
    open({ createTargetFolder: item.path });
  };

  const isSearching = Boolean(normalizedQuery);

  // --- Content search (hybrid: local cache + GitHub code search) ---
  const { status } = useOfflineSync();

  // Background-fill the note-body cache so local content search grows toward
  // exhaustive (and works offline). Runs while the palette is open + online.
  useContentPrefetch(routeOwner, indexQuery.data?.entries, isOpen);

  // Local: search bodies already in the cache (instant, offline).
  const localContentMatches = React.useMemo<ContentMatch[]>(() => {
    if (!isOpen || !normalizedQuery) return [];
    const files = getWorkspaceFilesFromCache(queryClient, routeOwner);
    return searchCachedContent(files, debouncedQuery);
  }, [isOpen, normalizedQuery, debouncedQuery, queryClient, routeOwner]);

  // Remote: GitHub code search for notes not in the cache (online, 3+ chars).
  const codeSearchQuery = useWorkspaceCodeSearchQuery(routeOwner, debouncedQuery, {
    enabled: isOpen && status.isOnline,
  });

  const remoteContentMatches = React.useMemo<ContentMatch[]>(() => {
    const items = codeSearchQuery.data ?? [];
    return items.map((item) => ({
      path: item.path,
      name: item.name,
      snippet: item.fragment ?? "",
      matchStart: -1,
      matchLength: 0,
      score: 180, // just below local content hits (200+)
      source: "remote" as const,
    }));
  }, [codeSearchQuery.data]);

  // Merge + drop any content match whose path already appears as a name/path
  // result (avoid showing the same note twice).
  const nameResultPaths = React.useMemo(
    () => new Set(results.map((item) => item.path)),
    [results]
  );
  const contentResults = React.useMemo(() => {
    const merged = mergeContentMatches(localContentMatches, remoteContentMatches);
    return merged.filter((match) => !nameResultPaths.has(match.path));
  }, [localContentMatches, remoteContentMatches, nameResultPaths]);

  const showSearchingIndicator =
    isSearching && (indexQuery.isFetching || codeSearchQuery.isFetching);

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(next) => (next ? open() : close())}
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search notes or type a command…"
      />
      <CommandList>
        {!isSearching ? (
          <>
            <CommandGroup heading="Actions">
              {commands.map((command) => (
                <CommandItem
                  key={command.id}
                  value={command.id}
                  onSelect={command.run}
                >
                  <command.icon className="mr-2 h-4 w-4" />
                  <span>{command.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {visibleRecents.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recently Viewed">
                  {visibleRecents.map((entry) => (
                    <CommandItem
                      key={entry.path}
                      value={`recent:${entry.path}`}
                      onSelect={() => runAndClose(() => openNote(entry.path))}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span className="truncate">{getBaseName(entry.path)}</span>
                      <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                        {getParentPath(entry.path) || "root"}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </>
        ) : (
          <>
            {filteredCommands.length > 0 ? (
              <CommandGroup heading="Commands">
                {filteredCommands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={command.run}
                  >
                    <command.icon className="mr-2 h-4 w-4" />
                    <span>{command.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.length > 0 ? (
              <CommandGroup heading="Notes & Folders">
                {results.map((item) => (
                  <CommandItem
                    key={item.path}
                    value={item.path}
                    onSelect={() => handleSelectItem(item)}
                    className={cn(item.pending && "opacity-70")}
                  >
                    {item.type === "dir" ? (
                      <FolderOpen className="mr-2 h-4 w-4 text-primary/80" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4 text-primary/80" />
                    )}
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                      {getParentPath(item.path) || "root"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {contentResults.length > 0 ? (
              <>
                {results.length > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading="In notes">
                  {contentResults.map((match) => (
                    <CommandItem
                      key={`content:${match.path}`}
                      value={`content:${match.path}`}
                      onSelect={() => runAndClose(() => openNote(match.path))}
                      className="flex-col items-start gap-0.5"
                    >
                      <div className="flex w-full items-center">
                        <FileText className="mr-2 h-4 w-4 shrink-0 text-primary/80" />
                        <span className="truncate">{match.name}</span>
                        <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                          {getParentPath(match.path) || "root"}
                        </span>
                      </div>
                      {match.snippet ? (
                        <span className="ml-6 line-clamp-1 text-xs text-muted-foreground">
                          {renderSnippet(match)}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {results.length === 0 &&
            contentResults.length === 0 &&
            filteredCommands.length === 0 ? (
              <CommandEmpty>
                {showSearchingIndicator
                  ? "Searching workspace…"
                  : "No results found."}
              </CommandEmpty>
            ) : null}
          </>
        )}
      </CommandList>

      {showSearchingIndicator ? (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Searching workspace…</span>
        </div>
      ) : null}
    </CommandDialog>
  );
}
