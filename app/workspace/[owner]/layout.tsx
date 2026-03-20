import { preloadWorkspaceShellData } from "@/lib/workspace-data";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export default async function WorkspaceOwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string }>;
}) {
  const session = await requireWorkspaceSession();
  const { owner } = await params;

  preloadWorkspaceShellData(session.user.id, owner);

  return children;
}
