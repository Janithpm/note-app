"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function WorkspaceToast({ message }: { message: string }) {
  useEffect(() => {
    toast.warning(message, {
      id: `workspace-warning:${message}`,
      duration: 5000,
    });
  }, [message]);

  return null;
}
