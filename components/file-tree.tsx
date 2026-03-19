"use client";

import { useState, useCallback } from "react";
import { Folder, File, ChevronRight, ChevronDown, FileText, Plus, Search } from "lucide-react";
import Link from "next/link";
import { fetchRepoContents } from "@/app/dashboard/[owner]/[name]/actions";
import { AuthButton } from "@/components/auth-button";
import { FullscreenToggle } from "@/components/fullscreen-toggle";

export function FileNode({ owner, repo, item, currentPath }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isFolder = item.type === "dir";

  const handleToggle = async () => {
    if (!isFolder) return;
    if (!isOpen && children.length === 0) {
      setLoading(true);
      try {
        const data = await fetchRepoContents(owner, repo, item.path);
        setChildren(data as any[]);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    setIsOpen(!isOpen);
  };

  if (!isFolder) {
    const isMarkdown = item.name.endsWith(".md") || item.name.endsWith(".mdx");
    return (
      <Link 
        href={`/dashboard/${owner}/${repo}/blob/${item.path}`}
        className={`flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted/80 rounded-md cursor-pointer transition-colors ${currentPath === item.path ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}
      >
        {isMarkdown ? <FileText className="h-4 w-4 text-primary/70" /> : <File className="h-4 w-4" />}
        <span className="truncate">{item.name}</span>
      </Link>
    );
  }

  return (
    <div>
      <div 
        onClick={handleToggle}
        className="flex items-center gap-1.5 py-1.5 px-2 text-sm hover:bg-muted/80 rounded-md cursor-pointer text-foreground/90 font-medium transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Folder className="h-4 w-4 text-primary/80 fill-primary/20" />
        <span className="truncate">{item.name}</span>
      </div>
      {isOpen && (
        <div className="pl-4 ml-[9px] border-l border-border/40 mt-1 flex flex-col gap-0.5">
          {loading ? (
            <div className="py-1 px-2 text-xs text-muted-foreground">Loading...</div>
          ) : (
            children.map((child: any) => (
              <FileNode 
                key={child.sha} 
                owner={owner} 
                repo={repo} 
                item={child} 
                currentPath={currentPath}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({ owner, repo, initialData, currentPath }: any) {
  return (
    <div className="flex flex-col border-r bg-muted/10 w-64 md:w-72 h-full hidden md:flex shrink-0">
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b">
          <span className="font-semibold text-sm truncate uppercase tracking-wider text-muted-foreground mr-2">
            {owner}/{repo}
          </span>
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="p-1.5 hover:bg-muted-foreground/20 rounded-md text-foreground transition-colors"
              title="Search Workspace (⌘K)"
            >
              <Search className="h-4 w-4" />
            </button>
            <Link 
              href={`/dashboard/${owner}/${repo}/new`} 
              className="p-1.5 hover:bg-muted-foreground/20 rounded-md text-foreground transition-colors"
              title="New Note"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          {initialData.sort((a: any, b: any) => {
            // Sort folders first
            if (a.type === "dir" && b.type !== "dir") return -1;
            if (a.type !== "dir" && b.type === "dir") return 1;
            return a.name.localeCompare(b.name);
          }).map((item: any) => (
            <FileNode 
              key={item.sha} 
              owner={owner} 
              repo={repo} 
              item={item} 
              currentPath={currentPath}
            />
          ))}
        </div>
      </div>
      
      {/* Sidebar Footer */}
      <div className="p-3 border-t bg-muted/5 flex items-center gap-1.5">
        <FullscreenToggle />
        <div className="w-[1px] h-4 bg-border/40 mx-1 shrink-0"></div>
        <div className="flex-1 min-w-0 pr-1">
          <AuthButton />
        </div>
      </div>
    </div>
  );
}
