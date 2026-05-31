"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  Edit3,
  Loader2,
  Mic,
  RefreshCcw,
  Save,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import GithubSlugger from "github-slugger";
import { toast } from "sonner";

import { saveNoteAction } from "@/app/workspace/actions";
import { useQueryClient } from "@tanstack/react-query";
import { queueSaveOffline, isNetworkError } from "@/lib/offline-sync";
import { useOfflineSync } from "@/components/offline-sync-provider";
import { useWorkspaceDraft } from "@/components/workspace-draft-provider";
import { Button } from "@/components/ui/button";
import { NoteLoadingState } from "@/components/note-loading-state";
import { NoteToc } from "@/components/note-toc";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  getBaseName,
  getParentPath,
  restoreSnapshots,
  setWorkspaceFileState,
  type WorkspaceFileData,
  upsertWorkspaceTreeItem,
  useOptimisticMutation,
  useWorkspaceFileQuery,
  workspaceKeys,
} from "@/lib/workspace-query";
import { getWorkspaceBlobPath, getWorkspaceNewPath } from "@/lib/workspace";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const AUTOSAVE_DELAY_MS = 1500;

type TocHeading = {
  id: string;
  text: string;
  depth: number;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type MarkdownEditorProps = {
  routeOwner: string | null;
  path?: string;
  initialPath?: string;
  isNew?: boolean;
  /**
   * When true, a saved draft stays in this editor (no navigation) and continues
   * as a normal file editor for the saved path. Used by the inline draft host.
   */
  inline?: boolean;
  /** Called once an inline draft has been saved (after it transitions in place). */
  onCreated?: (path: string) => void;
  /** Called when the user cancels/closes an in-place draft. */
  onCancel?: () => void;
};

type SaveMutationVariables = {
  path: string;
  content: string;
  sha?: string;
  isNew: boolean;
  /** True for autosaves — suppresses the success toast to avoid spam. */
  auto?: boolean;
};

const NEW_NOTE_TEMPLATE = "# New Note\n\nStart typing here...";

function extractTOC(content: string) {
  const slugger = new GithubSlugger();
  const headings: TocHeading[] = [];
  const lines = content.split("\n");

  const headingRegex = /^(#{1,3})\s+(.+)$/;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(headingRegex);
    if (match) {
      const depth = match[1].length;
      const text = match[2];
      const id = slugger.slug(text);
      headings.push({ id, text, depth });
    }
  }
  return headings;
}

function processDictation(text: string) {
  const commands: Record<string, string> = {
    "new line": "\n",
    "next line": "\n",
    "new paragraph": "\n\n",
    "next paragraph": "\n\n",
    comma: ",",
    period: ".",
    "full stop": ".",
    "question mark": "?",
    "exclamation mark": "!",
  };

  let processed = text;
  for (const [command, replacement] of Object.entries(commands)) {
    const regex = new RegExp(`\\b${command}\\b`, "gi");
    processed = processed.replace(regex, replacement);
  }

  processed = processed.replace(/\s+([.,?!])/g, "$1");
  processed = processed.replace(
    /(^\s*|[.,?!]\n*\s*)([a-z])/g,
    (match, prefix, letter) => prefix + letter.toUpperCase()
  );

  return processed;
}

function EditorSyncStatus({
  fileData,
  isSaving,
  onRetry,
}: {
  fileData?: WorkspaceFileData;
  isSaving: boolean;
  onRetry: () => void;
}) {
  if (isSaving || fileData?.pending) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span>Saving…</span>
      </div>
    );
  }

  if (fileData?.syncError) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <CircleAlert className="size-3.5" />
        <span>{fileData.syncError}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-destructive hover:text-destructive"
          onClick={onRetry}
        >
          <RefreshCcw className="mr-1 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground">
      Changes save to GitHub in the background.
    </div>
  );
}

export function MarkdownEditor({
  routeOwner,
  path = "",
  initialPath = "",
  isNew = false,
  inline = false,
  onCreated,
  onCancel,
}: MarkdownEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { reportConflict, hasPendingConflict, notifyQueueChanged } =
    useOfflineSync();
  const { openNote } = useWorkspaceDraft();
  // After an inline draft is saved we keep editing it *in place* (no navigation)
  // by remembering its real path here and treating the editor as a normal file
  // editor for that path from then on.
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const isNewDraft = isNew && savedPath === null;
  const effectivePath = savedPath ?? path;

  const [mode, setMode] = useState<"read" | "edit">(isNew ? "edit" : "read");
  const [draftContent, setDraftContent] = useState<string | null>(
    isNew ? NEW_NOTE_TEMPLATE : null
  );
  const [draftPath, setDraftPath] = useState(initialPath);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const ignoreNextFinalRef = useRef(false);
  const fileContentRef = useRef("");
  // Content of the most recent (auto or manual) save attempt, so autosave never
  // re-fires for content that's already been sent.
  const lastSavedContentRef = useRef<string | null>(null);

  const fileQuery = useWorkspaceFileQuery(routeOwner, effectivePath, {
    enabled: !isNewDraft && Boolean(effectivePath),
  });
  const fileData = isNewDraft ? undefined : fileQuery.data;
  const filePath = isNewDraft ? draftPath : effectivePath;
  const content = isNewDraft
    ? draftContent ?? NEW_NOTE_TEMPLATE
    : draftContent ?? fileData?.content ?? "";

  useEffect(() => {
    fileContentRef.current = fileData?.content ?? "";
  }, [fileData?.content]);

  const saveMutation = useOptimisticMutation<
    { path: string; sha: string; queued?: boolean },
    SaveMutationVariables,
    { previousLocation: string | null; parentPath: string; isNew: boolean }
  >({
    mutationFn: async ({ path: nextPath, content: nextContent, sha, isNew: creating }) => {
      const queuedResult = { path: nextPath, sha: sha ?? "", queued: true as const };
      const pendingEntry = {
        routeOwner,
        path: nextPath,
        content: nextContent,
        sha,
        isNew: creating,
        queuedAt: Date.now(),
      };
      const queue = async () => {
        await queueSaveOffline(queryClient, pendingEntry);
        notifyQueueChanged();
      };

      // Offline: don't even attempt the network. Queue and resolve as pending so
      // the optimistic cache stays in place and the editor keeps working.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queue();
        return queuedResult;
      }

      let result;
      try {
        result = await saveNoteAction(
          routeOwner,
          nextPath,
          nextContent,
          sha,
          creating ? `Create ${nextPath}` : `Update ${nextPath}`
        );
      } catch (error) {
        // Connection dropped mid-request: queue and let the sync provider retry.
        if (isNetworkError(error)) {
          await queue();
          return queuedResult;
        }
        throw error;
      }

      if (result.ok) {
        return { path: result.path, sha: result.sha };
      }

      if (result.reason === "conflict") {
        // Queue the edit and hand the conflict to the app-level resolver UI.
        await queue();
        reportConflict({
          entry: pendingEntry,
          remoteSha: result.remoteSha,
          remoteContent: result.remoteContent,
        });
        return queuedResult;
      }

      throw new Error(result.message);
    },
    getQueryKeys: (_queryClient, variables) => [
      workspaceKeys.file(routeOwner, variables.path),
      workspaceKeys.tree(routeOwner, getParentPath(variables.path)),
    ],
    applyOptimisticUpdate: (queryClient, variables) => {
      const parentPath = getParentPath(variables.path);
      const optimisticFile: WorkspaceFileData = {
        path: variables.path,
        content: variables.content,
        sha: variables.sha,
        pending: true,
        optimistic: true,
        syncError: null,
      };

      setWorkspaceFileState(queryClient, routeOwner, variables.path, optimisticFile);

      upsertWorkspaceTreeItem(queryClient, routeOwner, {
        name: getBaseName(variables.path),
        path: variables.path,
        sha: variables.sha ?? `optimistic:${variables.path}`,
        type: "file",
        pending: true,
        optimistic: true,
        syncError: null,
      });

      let previousLocation: string | null = null;
      if (variables.isNew) {
        previousLocation = `${getWorkspaceNewPath(routeOwner)}${
          parentPath ? `?folder=${encodeURIComponent(parentPath)}` : ""
        }`;

        if (inline) {
          // Stay in place: transition this editor into editing the saved file
          // (its content is already in the optimistic cache). No navigation, so
          // the user keeps writing without any page flash.
          setSavedPath(variables.path);
          setDraftContent(null);
          setMode("edit");
          // Reflect the saved note in the URL without a Next navigation (which
          // would remount and discard the editor). Keeps refresh/deep-link working.
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              getWorkspaceBlobPath(routeOwner, variables.path)
            );
          }
          onCreated?.(variables.path);
        } else {
          // Non-inline create (the standalone /new page): transition into the
          // note in place via client-side routing instead of a full server
          // navigation. openNote swaps the editor-host pane and pushes the URL.
          openNote(variables.path);
        }
      }

      return {
        previousLocation,
        parentPath,
        isNew: variables.isNew,
      };
    },
    rollback: (queryClient, variables, _error, state) => {
      if (state.context.isNew) {
        restoreSnapshots(queryClient, state.snapshots);
        if (state.context.previousLocation) {
          router.push(state.context.previousLocation);
        }
        toast.error("Could not create the note.");
        return;
      }

      const previousFile = state.snapshots.find(
        (snapshot) =>
          JSON.stringify(snapshot.queryKey) ===
          JSON.stringify(workspaceKeys.file(routeOwner, variables.path))
      )?.data as WorkspaceFileData | undefined;

      setWorkspaceFileState(queryClient, routeOwner, variables.path, {
        path: variables.path,
        content: variables.content,
        sha: previousFile?.sha ?? variables.sha,
        pending: false,
        optimistic: false,
        syncError: "Sync failed. Your draft is still here.",
      });

      upsertWorkspaceTreeItem(queryClient, routeOwner, {
        name: getBaseName(variables.path),
        path: variables.path,
        sha: previousFile?.sha ?? variables.sha ?? "",
        type: "file",
        pending: false,
        optimistic: false,
        syncError: "Save failed",
      });

      toast.error("Failed to sync changes. Retry when you’re ready.");
    },
    onSuccess: (queryClient, data, variables) => {
      // Queued (offline / conflict) saves stay pending — the optimistic state is
      // already in the cache and the sync provider will reconcile them later.
      if (data.queued) {
        if (!variables.auto) {
          toast.info(
            navigator.onLine
              ? "Save queued — will sync shortly."
              : "Saved offline. Will sync when you reconnect."
          );
        }
        return;
      }

      setWorkspaceFileState(queryClient, routeOwner, data.path, {
        path: data.path,
        content: variables.content,
        sha: data.sha,
        pending: false,
        optimistic: false,
        syncError: null,
      });

      upsertWorkspaceTreeItem(queryClient, routeOwner, {
        name: getBaseName(data.path),
        path: data.path,
        sha: data.sha,
        type: "file",
        pending: false,
        optimistic: false,
        syncError: null,
      });

      if (variables.isNew) {
        toast.success("New note created. Sync complete.");
        // New file: mark the search index stale so it appears in unexpanded-folder
        // search on next palette open (live cache already has it immediately).
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.treeIndex(routeOwner),
        });
      } else if (!variables.auto) {
        toast.success("Changes synced to GitHub.");
      }
    },
    // No tree/file invalidate: the optimistic cache + the real SHA patched in
    // onSuccess are authoritative. Refetching would hit GitHub's eventually-
    // consistent content API and flicker the just-saved note.
  });

  useEffect(() => {
    let recognition: SpeechRecognitionLike | null = null;
    if (typeof window !== "undefined") {
      const speechRecognitionWindow = window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const SpeechRecognition =
        speechRecognitionWindow.SpeechRecognition ||
        speechRecognitionWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let currentFinal = "";
          let currentInterim = "";

          for (let index = event.resultIndex; index < event.results.length; ++index) {
            if (event.results[index].isFinal) {
              currentFinal += event.results[index][0].transcript + " ";
            } else {
              currentInterim += event.results[index][0].transcript;
            }
          }

          const processedFinal = processDictation(currentFinal);
          const processedInterim = processDictation(currentInterim);

          if (processedFinal.trim()) {
            if (ignoreNextFinalRef.current) {
              ignoreNextFinalRef.current = false;
            } else {
              setDraftContent((previous) => {
                const base = previous ?? fileContentRef.current;
                const needsSpace =
                  base.length > 0 &&
                  !base.endsWith(" ") &&
                  !base.endsWith("\n");
                return base + (needsSpace ? " " : "") + processedFinal.trim();
              });
            }
          }

          setInterimTranscript(processedInterim);
        };

        recognition.onerror = () => {
          setIsListening(false);
          setInterimTranscript("");
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript("");
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    if (!recognitionRef.current) {
      alert("Voice typing is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = () => {
    const nextPath = filePath.trim();

    if (!nextPath) {
      toast.error("Please enter a file path, for example `docs/architecture.md`.");
      return;
    }

    if (saveMutation.isPending) {
      return;
    }

    lastSavedContentRef.current = content;
    saveMutation.mutate({
      path: nextPath,
      content,
      sha: fileData?.sha,
      isNew: isNewDraft,
    });
  };

  // Autosave: persist edits to existing files after a short pause in typing.
  // New unsaved drafts are excluded — they need a deliberate first save (path +
  // intent). Once an inline draft is saved it becomes a normal file editor
  // (savedPath set, isNewDraft false), so autosave takes over from then on.
  const debouncedContent = useDebouncedValue(content, AUTOSAVE_DELAY_MS);
  useEffect(() => {
    if (isNewDraft) return;
    if (mode !== "edit") return;
    if (draftContent === null) return; // nothing edited yet
    if (saveMutation.isPending) return;
    // Pause while a conflict for this file awaits the user's decision — retrying
    // with the same stale sha would just 409 again.
    if (hasPendingConflict(routeOwner, effectivePath)) return;
    // Skip if unchanged vs. what's on the server or vs. our last save attempt.
    if (debouncedContent === (fileData?.content ?? "")) return;
    if (debouncedContent === lastSavedContentRef.current) return;

    lastSavedContentRef.current = debouncedContent;
    saveMutation.mutate({
      path: effectivePath,
      content: debouncedContent,
      sha: fileData?.sha,
      isNew: false,
      auto: true,
    });
    // saveMutation is stable from useMutation; intentionally omitted to avoid
    // re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedContent,
    isNewDraft,
    mode,
    draftContent,
    fileData?.content,
    fileData?.sha,
    effectivePath,
    routeOwner,
    hasPendingConflict,
  ]);

  const currentServerContent = fileData?.content ?? "";
  const hasUnsavedChanges = isNewDraft
    ? Boolean(filePath.trim()) || content !== NEW_NOTE_TEMPLATE
    : draftContent !== null && content !== currentServerContent;
  const toc = useMemo(() => extractTOC(content), [content]);
  const needsSpace =
    content.length > 0 && !content.endsWith(" ") && !content.endsWith("\n");
  const displayValue =
    content + (interimTranscript ? (needsSpace ? " " : "") + interimTranscript : "");

  if (!isNewDraft && fileQuery.isPending && !fileData) {
    return <NoteLoadingState path={filePath} />;
  }

  if (!isNewDraft && fileQuery.isError && !fileData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-destructive">
            Error loading file
          </h2>
          <p className="text-muted-foreground">
            The file might be too large, not a text file, or no longer exists.
          </p>
          <Button variant="outline" onClick={() => fileQuery.refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "read") {
    return (
      <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8 md:py-10">
          <div className="mx-auto flex w-full max-w-5xl flex-col">
            <div className="mb-8 flex items-center justify-between gap-4 border-b pb-4">
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-bold tracking-tight text-foreground">
                  {getBaseName(filePath)}
                </h1>
                <div className="mt-1 truncate text-sm tracking-wide text-muted-foreground">
                  {filePath}
                </div>
                <div className="mt-2">
                  <EditorSyncStatus
                    fileData={fileData}
                    isSaving={saveMutation.isPending}
                    onRetry={handleSave}
                  />
                </div>
              </div>
              <Button
                onClick={() => setMode("edit")}
                variant="outline"
                size="sm"
                className="hidden sm:flex"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Note
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-foreground prose-a:text-primary prose-headings:text-foreground md:prose-base dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        <NoteToc headings={toc} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-2">
          {!isNewDraft ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setMode("read")}
              title="Close Editor"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : onCancel ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={onCancel}
              title="Discard draft"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}

          {isNewDraft ? (
            <input
              value={filePath}
              onChange={(event) => setDraftPath(event.target.value)}
              placeholder="e.g. docs/architecture.md"
              className="w-full max-w-md rounded-md border bg-background px-2 py-1 font-mono text-sm outline-none focus:border-primary"
            />
          ) : (
            <span className="max-w-md truncate text-sm font-medium text-muted-foreground">
              {filePath}
            </span>
          )}

          {hasUnsavedChanges ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse"
              title="Unsaved changes"
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <EditorSyncStatus
            fileData={fileData}
            isSaving={saveMutation.isPending}
            onRetry={handleSave}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={toggleListening}
            className={isListening ? "border-primary bg-primary/10 text-primary" : ""}
            title={isListening ? "Stop voice typing" : "Start voice typing"}
          >
            {isListening ? (
              <>
                <Mic className="mr-2 h-4 w-4 animate-pulse" />
                Listening…
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Voice Type
              </>
            )}
          </Button>
          {!isNewDraft && (
            <span className="mr-1 text-xs text-muted-foreground" aria-live="polite">
              {saveMutation.isPending
                ? "Saving…"
                : hasUnsavedChanges
                  ? "Unsaved changes"
                  : "Saved"}
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isNewDraft && !hasUnsavedChanges}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <ResizablePanelGroup
        {...{ direction: "horizontal" }}
        className="min-h-0 flex-1 border-t"
      >
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="relative flex h-full flex-col border-r focus-within:ring-1 focus-within:ring-primary/20">
            <textarea
              value={displayValue}
              onChange={(event) => {
                if (interimTranscript) {
                  ignoreNextFinalRef.current = true;
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.stop();
                    } catch {}
                  }
                  setIsListening(false);
                  setInterimTranscript("");
                }
                setDraftContent(event.target.value);
              }}
              className="w-full flex-1 resize-none bg-background/50 p-6 font-mono text-sm leading-relaxed outline-none"
              spellCheck={false}
              placeholder="Type your markdown here..."
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="prose prose-sm relative h-full max-w-none overflow-y-auto bg-background p-8 text-foreground prose-a:text-primary prose-headings:text-foreground md:prose-base dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
              {displayValue}
            </ReactMarkdown>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
