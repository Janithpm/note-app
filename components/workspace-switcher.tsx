"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { rememberWorkspaceVisitAction } from "@/app/workspace/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspaceTransition } from "@/components/workspace-transition-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getWorkspaceBasePath,
  getWorkspaceOwnerHref,
  PERSONAL_WORKSPACE_SEGMENT,
  type WorkspaceOwnerOption,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

function WorkspaceOptionRow({
  owner,
  active,
  pending,
  onSelect,
}: {
  owner: WorkspaceOwnerOption;
  active: boolean;
  pending: boolean;
  onSelect: (owner: WorkspaceOwnerOption) => void;
}) {
  const Icon = owner.kind === "organization" ? Building2 : UserRound;

  return (
    <button
      type="button"
      onClick={() => onSelect(owner)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{owner.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {owner.kind === "organization" ? "Organization" : "Personal"}
        </p>
      </div>

      <div className="flex size-4 shrink-0 items-center justify-center">
        {pending && !active ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : active ? (
          <Check className="size-4 text-foreground" />
        ) : null}
      </div>
    </button>
  );
}

function WorkspaceOptionList({
  owners,
  activeOwner,
  pendingOwnerSegment,
  onSelect,
}: {
  owners: WorkspaceOwnerOption[];
  activeOwner: WorkspaceOwnerOption;
  pendingOwnerSegment: string | null;
  onSelect: (owner: WorkspaceOwnerOption) => void;
}) {
  return (
    <div className="space-y-1 p-1.5">
      {owners.map((owner) => (
        <WorkspaceOptionRow
          key={owner.routeSegment ?? "__personal__"}
          owner={owner}
          active={owner.routeSegment === activeOwner.routeSegment}
          pending={pendingOwnerSegment === owner.routeSegment}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function WorkspaceSwitcher({
  owners,
  activeOwner,
}: {
  owners: WorkspaceOwnerOption[];
  activeOwner: WorkspaceOwnerOption;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { beginWorkspaceTransition } = useWorkspaceTransition();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingOwnerSegment, setPendingOwnerSegment] = useState<string | null>(
    null
  );

  if (owners.length < 2) {
    return null;
  }

  const handleSelect = (owner: WorkspaceOwnerOption) => {
    if (owner.routeSegment === activeOwner.routeSegment) {
      setOpen(false);
      return;
    }

    setPendingOwnerSegment(owner.routeSegment);

    startTransition(async () => {
      beginWorkspaceTransition();
      setOpen(false);

      if (owner.routeSegment === PERSONAL_WORKSPACE_SEGMENT) {
        router.push(getWorkspaceBasePath(PERSONAL_WORKSPACE_SEGMENT));
      } else {
        router.push(getWorkspaceOwnerHref(owner));
      }

      try {
        await rememberWorkspaceVisitAction(owner.routeSegment);
      } catch (error) {
        console.error(error);
        toast.error("Could not remember the selected workspace.");
      } finally {
        setPendingOwnerSegment(null);
      }
    });
  };

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      className="h-9 w-full justify-between rounded-xl px-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/60 text-sidebar-foreground">
          {activeOwner.kind === "organization" ? (
            <Building2 className="size-3.5" />
          ) : (
            <UserRound className="size-3.5" />
          )}
        </div>

        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {activeOwner.label}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/65">
            {activeOwner.kind === "organization" ? "Organization" : "Personal"}
          </p>
        </div>
      </div>

      <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/60" />
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {trigger}
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-3xl border-x-0 border-b-0 px-0 pb-5 pt-0"
          showCloseButton={false}
        >
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle>Switch workspace</SheetTitle>
            <SheetDescription>Choose a profile or organization.</SheetDescription>
          </SheetHeader>
          <WorkspaceOptionList
            owners={owners}
            activeOwner={activeOwner}
            pendingOwnerSegment={isPending ? pendingOwnerSegment : null}
            onSelect={handleSelect}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-72 rounded-2xl border-border/80 bg-background p-0 shadow-md backdrop-blur-none"
      >
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Switch workspace
          </p>
        </div>
        <WorkspaceOptionList
          owners={owners}
          activeOwner={activeOwner}
          pendingOwnerSegment={isPending ? pendingOwnerSegment : null}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
