import {
  type PersistedClient,
  type Persister,
} from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

const PERSIST_KEY = "note-app:workspace-cache";

/**
 * IndexedDB-backed persister for the React Query cache. We use IndexedDB (via
 * idb-keyval) rather than localStorage so the workspace tree/note cache can grow
 * without hitting the ~5MB localStorage limit and without blocking the main
 * thread on read/write. This is the durable browser index that makes the explorer
 * and notes paint instantly on reload, then revalidate in the background.
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(PERSIST_KEY, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(PERSIST_KEY);
    },
    removeClient: async () => {
      await del(PERSIST_KEY);
    },
  };
}
