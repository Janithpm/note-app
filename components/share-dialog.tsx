"use client";

import * as React from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createShareLinkAction,
  getShareLinkForTargetAction,
  revokeShareLinkAction,
  type ShareLinkInfo,
} from "@/app/workspace/share-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type ShareExpiry, type ShareTargetType } from "@/lib/share-types";

type ShareDialogProps = {
  routeOwner: string | null;
  path: string;
  type: ShareTargetType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EXPIRY_OPTIONS: { value: ShareExpiry; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function shareUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/share/${token}`;
}

export function ShareDialog({
  routeOwner,
  path,
  type,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [link, setLink] = React.useState<ShareLinkInfo | null>(null);
  const [expiry, setExpiry] = React.useState<ShareExpiry>("never");
  const [copied, setCopied] = React.useState(false);

  // Load any existing active link whenever the dialog opens for a target.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLink(null);
    setCopied(false);
    getShareLinkForTargetAction(routeOwner, path, type)
      .then((existing) => {
        if (!cancelled) setLink(existing);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load share status.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, routeOwner, path, type]);

  const handleCreate = async () => {
    setWorking(true);
    try {
      const info = await createShareLinkAction(routeOwner, path, type, expiry);
      setLink(info);
    } catch {
      toast.error("Couldn't create the share link.");
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!link) return;
    setWorking(true);
    try {
      await revokeShareLinkAction(link.token);
      setLink(null);
      toast.success("Share link revoked.");
    } catch {
      toast.error("Couldn't revoke the link.");
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(shareUrl(link.token));
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const label = type === "dir" ? "folder" : "note";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {label}</DialogTitle>
          <DialogDescription>
            Anyone with the link can view this {label}. No sign-in required.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking share status…
          </div>
        ) : link ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl(link.token)}
                className="font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={handleCopy}
                aria-label="Copy link"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {link.expiresAt
                ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}.`
                : "This link never expires."}
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={handleRevoke}
                className="text-destructive hover:text-destructive"
              >
                {working ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Revoke link
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Link expiry
              </span>
              <select
                value={expiry}
                onChange={(event) =>
                  setExpiry(event.target.value as ShareExpiry)
                }
                className={cn(
                  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              className="w-full"
              disabled={working}
              onClick={handleCreate}
            >
              {working ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 size-4" />
              )}
              Create link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
