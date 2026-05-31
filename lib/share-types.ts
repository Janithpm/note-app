/** Shared, client-safe types for the share feature (no server-only imports). */

export type ShareTargetType = "file" | "dir";

export type ShareExpiry = "never" | "7d" | "30d";
