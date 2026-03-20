import { redirect } from "next/navigation";

import { PERSONAL_WORKSPACE_SEGMENT, getWorkspaceNewPath } from "@/lib/workspace";

export default function PersonalNewWorkspacePage() {
  redirect(getWorkspaceNewPath(PERSONAL_WORKSPACE_SEGMENT));
}
