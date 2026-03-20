import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/workspace", request.url));
}

export const config = {
  matcher: "/",
};
