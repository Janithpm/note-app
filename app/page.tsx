import { ArrowRight, Github, ShieldCheck } from "lucide-react";

import { AuthButton } from "@/components/auth-button";

export const metadata = {
  title: "Note App",
  description: "Sign in with GitHub to open your personal or organization workspace.",
};

export default function Page() {
  return (
    <div className="min-h-svh bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <div className="w-full space-y-10">
          <div className="mx-auto max-w-2xl space-y-5 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Github className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                GitHub workspace
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Sign in to open your notes workspace.
              </h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                Connect your GitHub account to use your personal workspace or any
                organization workspace you have granted access to.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="space-y-6">
              <div className="space-y-3 text-center sm:text-left">
                <p className="text-sm font-medium text-foreground">
                  Get started
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  After signing in, you can choose between your personal GitHub
                  profile and available organizations, then store notes inside the
                  dedicated workspace repo.
                </p>
              </div>

              <div className="flex flex-col gap-4 border-y border-border py-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Workspace-aware access
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Use the same note app with your GitHub profile or inside an
                      approved organization context.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                    <ArrowRight className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Simple next step
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sign in once, then the app will guide you into the correct
                      workspace selection flow.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center sm:justify-start">
                <div className="w-full max-w-sm">
                  <AuthButton />
                </div>
              </div>

              <p className="text-center font-mono text-xs text-muted-foreground sm:text-left">
                Press <kbd>d</kbd> to toggle dark mode
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
