"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { rememberWorkspaceVisitAction } from "@/app/workspace/actions";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceTransition } from "@/components/workspace-transition-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getWorkspaceOwnerHref,
  getWorkspaceBasePath,
  getWorkspaceSettingsPath,
  PERSONAL_WORKSPACE_SEGMENT,
  type WorkspaceOwnerOption,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

function WorkspaceOwnerCard({
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
      disabled={pending}
      className={cn(
        "group block w-full rounded-3xl border p-4 text-left transition-all disabled:pointer-events-none disabled:opacity-70",
        active
          ? "border-primary/30 bg-primary/8 shadow-lg shadow-primary/10"
          : "border-border/70 bg-background/80 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-muted/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            owner.kind === "organization"
              ? "bg-linear-to-br from-cyan-500/15 via-sky-500/10 to-transparent text-cyan-600"
              : "bg-linear-to-br from-amber-500/15 via-orange-500/10 to-transparent text-amber-600"
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {owner.label}
            </p>
            {pending && !active ? (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            ) : null}
            {active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <CheckCircle2 className="size-3" />
                Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{owner.subtitle}</p>
          <p className="mt-3 text-xs font-medium text-foreground/70">
            Open workspace
          </p>
        </div>
      </div>
    </button>
  );
}

function WorkspaceSwitcherPanel({
  owners,
  activeOwner,
  pendingOwnerSegment,
  onClose,
  onSelect,
}: {
  owners: WorkspaceOwnerOption[];
  activeOwner: WorkspaceOwnerOption;
  pendingOwnerSegment: string | null;
  onClose: () => void;
  onSelect: (owner: WorkspaceOwnerOption) => void;
}) {
  const orgCount = owners.filter((owner) => owner.kind === "organization").length;
  const ActiveIcon = activeOwner.kind === "organization" ? Building2 : UserRound;

  return (
    <div className="overflow-hidden rounded-[28px]">
      <div className="border-b border-border/70 bg-linear-to-br from-primary/8 via-background to-cyan-500/8 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-background/80 text-primary shadow-sm">
            <ActiveIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <ButtonGroup className="mb-3 bg-background/70">
              <span className="rounded-xl px-2 py-1 text-[11px] font-medium text-muted-foreground">
                Current
              </span>
              <span className="rounded-xl bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                {activeOwner.kind === "organization" ? "Organization" : "Profile"}
              </span>
              <span className="rounded-xl px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {orgCount} org{orgCount === 1 ? "" : "s"}
              </span>
            </ButtonGroup>
            <h3 className="text-base font-semibold text-foreground">
              {activeOwner.label}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Jump between your personal notes and GitHub organizations without changing the underlying repo model.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {owners.map((owner) => (
          <WorkspaceOwnerCard
            key={owner.routeSegment ?? "__personal__"}
            owner={owner}
            active={owner.routeSegment === activeOwner.routeSegment}
            pending={pendingOwnerSegment === owner.routeSegment}
            onSelect={onSelect}
          />
        ))}

        <Button asChild variant="ghost" className="w-full justify-between rounded-2xl">
          <Link href={getWorkspaceSettingsPath()} onClick={onClose}>
            <span className="inline-flex items-center gap-2">
              <Settings2 className="size-4" />
              Workspace settings
            </span>
            <Sparkles className="size-4 text-primary" />
          </Link>
        </Button>
      </div>
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
      try {
        beginWorkspaceTransition();
        await rememberWorkspaceVisitAction(owner.routeSegment);
        setOpen(false);

        if (owner.routeSegment === PERSONAL_WORKSPACE_SEGMENT) {
          router.push(getWorkspaceBasePath(PERSONAL_WORKSPACE_SEGMENT));
        } else {
          router.push(getWorkspaceOwnerHref(owner));
        }
      } catch (error) {
        console.error(error);
        toast.error("Could not switch workspace. Please try again.");
      } finally {
        setPendingOwnerSegment(null);
      }
    });
  };

  const trigger = (
    <Button
      variant="outline"
      className="h-auto min-w-[15rem] justify-between rounded-2xl border-border/70 bg-background/70 px-3 py-2 text-left shadow-sm backdrop-blur-sm hover:bg-background"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {activeOwner.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {activeOwner.subtitle}
        </p>
      </div>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {trigger}
        <SheetContent
          side="bottom"
          className="rounded-t-[28px] border-x-0 border-b-0 px-0 pb-6 pt-0"
          showCloseButton={false}
        >
          <SheetHeader className="border-b border-border/70 px-5 py-4">
            <SheetTitle>Switch workspace</SheetTitle>
            <SheetDescription>
              Move between your profile and organization contexts.
            </SheetDescription>
          </SheetHeader>
          <WorkspaceSwitcherPanel
            owners={owners}
            activeOwner={activeOwner}
            pendingOwnerSegment={isPending ? pendingOwnerSegment : null}
            onClose={() => setOpen(false)}
            onSelect={handleSelect}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[26rem] p-0">
        <WorkspaceSwitcherPanel
          owners={owners}
          activeOwner={activeOwner}
          pendingOwnerSegment={isPending ? pendingOwnerSegment : null}
          onClose={() => setOpen(false)}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
