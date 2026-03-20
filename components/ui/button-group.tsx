import * as React from "react"

import { cn } from "@/lib/utils"

function ButtonGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      className={cn(
        "inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-muted/50 p-1",
        className
      )}
      {...props}
    />
  )
}

export { ButtonGroup }
