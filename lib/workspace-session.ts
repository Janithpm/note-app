import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export const getWorkspaceSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export async function requireWorkspaceSession() {
  const session = await getWorkspaceSession();

  if (!session) {
    redirect("/");
  }

  return session;
}
