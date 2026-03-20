import { redirect } from "next/navigation";

import {
  PERSONAL_WORKSPACE_SEGMENT,
  getWorkspaceBlobPath,
} from "@/lib/workspace";

export default async function PersonalBlobPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  redirect(getWorkspaceBlobPath(PERSONAL_WORKSPACE_SEGMENT, path.join("/")));
}
