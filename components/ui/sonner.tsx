"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      closeButton
      richColors
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          toast:
            "border border-border/70 bg-background text-foreground shadow-lg",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}
