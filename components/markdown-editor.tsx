"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import GithubSlugger from "github-slugger";
import { Button } from "./ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { Save, Loader2, Edit3, X, List, Mic, MicOff } from "lucide-react";
import { saveNoteAction } from "@/app/dashboard/[owner]/[name]/blob/[...path]/actions";
import { useRouter } from "next/navigation";

function extractTOC(content: string) {
  const slugger = new GithubSlugger();
  const headings: { id: string; text: string; depth: number }[] = [];
  const lines = content.split('\n');
  
  const headingRegex = /^(#{1,3})\s+(.+)$/;
  let inCodeBlock = false;
  
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
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
    "comma": ",",
    "period": ".",
    "full stop": ".",
    "question mark": "?",
    "exclamation mark": "!"
  };

  let processed = text;
  for (const [command, replacement] of Object.entries(commands)) {
    const regex = new RegExp(`\\b${command}\\b`, 'gi');
    processed = processed.replace(regex, replacement);
  }

  // Cleanup unnecessary spaces around punctuation
  processed = processed.replace(/\s+([.,?!])/g, '$1');
  
  // Capitalize beginnings of sentences and after punctuation
  processed = processed.replace(/(^\s*|[.,?!]\n*\s*)([a-z])/g, (match, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });

  return processed;
}

export function MarkdownEditor({ initialContent, sha, owner, repo, path, isNew = false }: any) {
  const router = useRouter();
  const [mode, setMode] = useState<'read' | 'edit'>(isNew ? 'edit' : 'read');
  const [content, setContent] = useState(initialContent);
  const [filePath, setFilePath] = useState(path || "");
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const ignoreNextFinalRef = useRef(false);

  useEffect(() => {
    let recognition: any = null;
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Turn back on for real-time magic
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentFinal = '';
          let currentInterim = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              currentFinal += event.results[i][0].transcript + ' ';
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          
          const processedFinal = processDictation(currentFinal);
          const processedInterim = processDictation(currentInterim);
          
          if (processedFinal.trim()) {
            if (ignoreNextFinalRef.current) {
              ignoreNextFinalRef.current = false;
            } else {
              setContent((prev: string) => {
                const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
                return prev + (needsSpace ? ' ' : '') + processedFinal.trim();
              });
            }
          }
          
          setInterimTranscript(processedInterim);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          setInterimTranscript('');
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("Voice typing is not supported in this browser. Try Chrome or Edge!");
        return;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };
  
  const handleSave = () => {
    startTransition(async () => {
      try {
        if (isNew && !filePath.trim()) {
           alert("Please enter a file path, e.g., 'docs/architecture.md'");
           return;
        }
        await saveNoteAction(owner, repo, filePath, content, sha, isNew ? `Create ${filePath}` : `Update ${filePath}`);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        if (isNew) {
           router.push(`/dashboard/${owner}/${repo}/blob/${filePath}`);
        } else {
           setMode('read');
        }
      } catch (error) {
        console.error(error);
        alert("Failed to save. Make sure your GitHub token has repo access scopes.");
      }
    });
  };

  const hasUnsavedChanges = content !== initialContent;
  const toc = useMemo(() => extractTOC(content), [content]);

  // Combine content and interim for realtime display
  const needsSpace = content.length > 0 && !content.endsWith(' ') && !content.endsWith('\n');
  const displayValue = content + (interimTranscript ? (needsSpace ? ' ' : '') + interimTranscript : '');

  if (mode === 'read') {
    return (
      <div className="flex h-full w-full bg-background overflow-hidden relative">
        <div className="flex-1 overflow-y-auto px-8 py-10 flex justify-center">
          <div className="max-w-5xl w-full flex gap-12">
             <div className="flex-1 min-w-0 prose prose-sm md:prose-base dark:prose-invert prose-headings:text-foreground prose-a:text-primary">
               <div className="flex items-center justify-between mb-8 pb-4 border-b not-prose">
                 <div>
                   <h1 className="text-3xl font-bold tracking-tight text-foreground">{path.split('/').pop()}</h1>
                   <div className="text-sm text-muted-foreground mt-1 tracking-wide">{path}</div>
                 </div>
                 <Button onClick={() => setMode('edit')} variant="outline" size="sm" className="hidden sm:flex">
                   <Edit3 className="mr-2 h-4 w-4" /> Edit Note
                 </Button>
               </div>
               <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                 {content}
               </ReactMarkdown>
             </div>
             
             {/* TOC Sidebar */}
             <div className="hidden lg:block w-56 shrink-0 not-prose">
               <div className="sticky top-10 flex flex-col gap-4 border-l pl-4 border-border max-h-[80vh] overflow-y-auto scrollbar-none">
                 <h3 className="font-semibold text-xs flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                   <List className="h-3 w-3" /> On this page
                 </h3>
                 <ul className="flex flex-col gap-2.5 text-sm">
                   {toc.map((heading, i) => (
                     <li key={i} style={{ paddingLeft: `${(heading.depth - 1) * 0.75}rem` }}>
                       <a href={`#${heading.id}`} className="text-muted-foreground hover:text-foreground transition-colors line-clamp-2">
                         {heading.text}
                       </a>
                     </li>
                   ))}
                   {toc.length === 0 && (
                     <li className="text-muted-foreground/60 italic text-xs">No headings found.</li>
                   )}
                 </ul>
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/20">
        <div className="flex items-center gap-2 flex-1 mr-4 min-w-0">
          {!isNew && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setMode('read')} title="Close Editor">
              <X className="h-4 w-4" />
            </Button>
          )}
          {isNew ? (
            <input 
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="e.g. docs/architecture.md (must end in .md)"
              className="px-2 py-1 text-sm bg-background border rounded-md outline-none focus:border-primary w-full max-w-md font-mono"
            />
          ) : (
            <span className="text-sm font-medium text-muted-foreground truncate max-w-md">{path}</span>
          )}
          {hasUnsavedChanges && !isNew && <span className="w-2 h-2 shrink-0 rounded-full bg-primary animate-pulse" title="Unsaved changes"></span>}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={toggleListening}
            className={`transition-all ${isListening ? 'border-primary text-primary bg-primary/10' : ''}`}
            title={isListening ? "Stop voice typing" : "Start voice typing"}
          >
            {isListening ? (
              <><Mic className="h-4 w-4 mr-2 animate-pulse" /> Listening...</>
            ) : (
              <><Mic className="h-4 w-4 mr-2" /> Voice Type</>
            )}
          </Button>

          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={isPending || (!hasUnsavedChanges && !isNew)}
            variant={isSaved ? "secondary" : "default"}
            className="transition-all"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaved ? "Saved to GitHub!" : "Save"}
          </Button>
        </div>
      </div>

      <ResizablePanelGroup {...{ direction: "horizontal" }} className="flex-1 min-h-0 border-t">
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="h-full border-r focus-within:ring-1 focus-within:ring-primary/20 relative flex flex-col">
            <textarea
            value={displayValue}
            onChange={(e) => {
              if (interimTranscript) {
                // User interrupted dictation by typing manually
                ignoreNextFinalRef.current = true;
                if (recognitionRef.current) {
                  try { recognitionRef.current.stop(); } catch(e){}
                }
                setIsListening(false);
                setInterimTranscript('');
                setContent(e.target.value);
              } else {
                setContent(e.target.value);
              }
            }}
            className="w-full flex-1 p-6 resize-none outline-none font-mono text-sm bg-background/50 leading-relaxed"
            spellCheck={false}
            placeholder="Type your markdown here..."
          />
        </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="h-full overflow-y-auto p-8 bg-background prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary relative">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
              {displayValue}
            </ReactMarkdown>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
