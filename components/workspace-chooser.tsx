"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowRight,
  Building2,
  Loader2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { rememberWorkspaceVisitAction } from "@/app/workspace/actions";
import { Button } from "@/components/ui/button";
import { useWorkspaceTransition } from "@/components/workspace-transition-provider";
import {
  getWorkspaceOwnerHref,
  PERSONAL_WORKSPACE_SEGMENT,
  type WorkspaceOwnerOption,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

function WorkspaceChoiceCard({
  owner,
  onOpen,
  pending = false,
}: {
  owner: WorkspaceOwnerOption;
  onOpen?: () => void;
  pending?: boolean;
}) {
  const Icon = owner.kind === "organization" ? Building2 : UserRound;

  return (
    <div
      className={cn(
        "rounded-3xl border bg-card p-6 shadow-sm transition-colors",
        pending ? "border-primary/30" : "border-border hover:border-foreground/15"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1 text-left">
          <p className="text-sm font-medium text-foreground">{owner.label}</p>
          <p className="text-sm text-muted-foreground">{owner.subtitle}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-left">
          <p className="text-sm font-medium text-foreground">
            {owner.kind === "organization" ? "Organization" : "Personal profile"}
          </p>
          <p className="text-sm text-muted-foreground">
            {owner.kind === "organization"
              ? "Use the workspace inside this GitHub organization."
              : "Use the workspace inside your own GitHub profile."}
          </p>
        </div>

        <Button
          type="button"
          variant={pending ? "secondary" : "outline"}
          className="shrink-0"
          onClick={onOpen}
          disabled={pending}
          asChild={!onOpen}
        >
          {onOpen ? (
            <>
              {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              <span>Open workspace</span>
            </>
          ) : (
            <Link href={getWorkspaceOwnerHref(owner)}>
              <ArrowRight />
              <span>Open workspace</span>
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}

export function WorkspaceChooser({
  owners,
}: {
  owners: WorkspaceOwnerOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { beginWorkspaceTransition } = useWorkspaceTransition();
  const [profileOwner, ...organizationOwners] = owners;

  const openPersonalWorkspace = () => {
    startTransition(async () => {
      try {
        beginWorkspaceTransition();
        await rememberWorkspaceVisitAction(PERSONAL_WORKSPACE_SEGMENT);
        router.push(getWorkspaceOwnerHref({ routeSegment: PERSONAL_WORKSPACE_SEGMENT }));
      } catch (error) {
        console.error(error);
        toast.error("Could not open the personal workspace. Please try again.");
      }
    });
  };

  return (
    <div className="min-h-full bg-background px-6 py-10 mx-auto max-w-4xl">
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-3xl items-center justify-center">
        <div className="w-full space-y-10">
          <div className="mx-auto max-w-2xl space-y-5 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Choose where this note app should live right now.
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Pick the GitHub context for your notes. The app keeps the internal
              workspace repo behavior the same, while this screen stays focused on
              the workspace you want to open.
            </p>
          </div>

          <div className="mx-auto w-full max-w-2xl space-y-10">
            <WorkspaceChoiceCard
              owner={profileOwner}
              onOpen={openPersonalWorkspace}
              pending={isPending}
            />

            {organizationOwners.length > 0 ? (
              <div className="space-y-3">
                <div className="px-1 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Organizations
                  </p>
                </div>

                {organizationOwners.map((owner) => (
                  <WorkspaceChoiceCard
                    key={owner.routeSegment ?? "__personal__"}
                    owner={owner}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
