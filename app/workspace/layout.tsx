import { WorkspaceTransitionProvider } from "@/components/workspace-transition-provider";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspaceSession();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <WorkspaceTransitionProvider>
        {children}
        </WorkspaceTransitionProvider>
    </div>
  );
}
