"use client";

import { useSession, signIn, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, LogOut } from "lucide-react";

export function AuthButton() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Please wait
      </Button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center justify-between w-full min-w-0 gap-2">
        <span className="text-sm font-medium text-foreground truncate select-none">
          {session.user.name}
        </span>
        <Button 
          variant="ghost" 
          size="icon"
          title="Sign Out"
          onClick={() => signOut({
            fetchOptions: {
              onSuccess: () => {
                window.location.href = '/';
              }
            }
          })}
          className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={() => signIn.social({ provider: "github", callbackURL: "/dashboard" })}
    >
      <LogIn className="mr-2 h-4 w-4" />
      Sign In with GitHub
    </Button>
  );
}
