import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared note",
  // Share links are private-by-obscurity; keep them out of search indexes.
  robots: { index: false, follow: false },
};

/**
 * Minimal layout for public read-only share pages. Inherits the app-wide
 * providers (theme, toaster, etc.) from the root layout but deliberately does
 * NOT pull in the workspace shell (sidebar/palette/tree), so a logged-out
 * viewer sees only the shared content.
 */
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-svh w-full bg-background">{children}</div>;
}
