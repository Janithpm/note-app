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
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {session.user.name}
        </span>
        <Button 
          variant="outline" 
          onClick={() => signOut({
            fetchOptions: {
              onSuccess: () => {
                window.location.href = '/';
              }
            }
          })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
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
