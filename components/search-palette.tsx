"use client"

import * as React from "react"
import {
  Settings,
  User,
  FileText,
  FolderOpen
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

export function SearchPalette() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Allow overriding default keybind
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Recently Viewed">
            <CommandItem>
              <FileText className="mr-2 h-4 w-4" />
              <span>architecture.md</span>
            </CommandItem>
            <CommandItem>
              <FileText className="mr-2 h-4 w-4" />
              <span>api-endpoints.md</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Files">
            <CommandItem>
              <FileText className="mr-2 h-4 w-4" />
              <span>README.md</span>
            </CommandItem>
            <CommandItem>
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>docs</span>
            </CommandItem>
            <CommandItem>
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>diagrams</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
