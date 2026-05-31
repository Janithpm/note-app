import type { Metadata, Viewport } from "next"
import { Geist_Mono, DM_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

import { QueryProvider } from "@/components/query-provider"
import { OfflineSyncProvider } from "@/components/offline-sync-provider"
import { PwaProvider } from "@/components/pwa-provider"

export const metadata: Metadata = {
  title: {
    default: "Note App",
    template: "%s · Note App",
  },
  description:
    "A GitHub-backed personal notes workspace. Write Markdown notes that sync to your repositories.",
  applicationName: "Note App",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Notes",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", dmSans.variable)}
    >
      <body>
        <QueryProvider>
          <PwaProvider>
            <OfflineSyncProvider>
              <TooltipProvider>
                <ThemeProvider>
                  {children}
                  <Toaster />
                </ThemeProvider>
              </TooltipProvider>
            </OfflineSyncProvider>
          </PwaProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
