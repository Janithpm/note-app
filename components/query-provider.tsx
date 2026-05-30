"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";

import { makeQueryClient } from "@/lib/query-client";
import { createIDBPersister } from "@/lib/query-persister";

// Bump when the persisted cache shape changes so stale caches are discarded.
const PERSIST_BUSTER = "v1";
const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(() => createIDBPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Only persist successful workspace data (tree/file/preferences).
            if (query.queryKey[0] !== "workspace") {
              return false;
            }
            if (query.state.status !== "success") {
              return false;
            }

            // Never persist mid-sync optimistic/pending state — restoring an
            // unconfirmed write would resurrect it as if it were the source of
            // truth. Covers both file objects and tree-listing arrays.
            const data = query.state.data as unknown;
            const isUnconfirmed = (value: unknown) =>
              typeof value === "object" &&
              value !== null &&
              ((value as { optimistic?: boolean }).optimistic === true ||
                (value as { pending?: boolean }).pending === true);

            if (Array.isArray(data)) {
              return !data.some(isUnconfirmed);
            }
            return !isUnconfirmed(data);
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
