import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
					id: text("id").primaryKey(),
					name: text("name").notNull(),
					email: text("email").notNull().unique(),
					emailVerified: boolean("email_verified").notNull(),
					image: text("image"),
					workspacePersistenceMode: text("workspace_persistence_mode").notNull().default("cookie"),
					workspaceLastActiveOwner: text("workspace_last_active_owner"),
					createdAt: timestamp("created_at").notNull(),
					updatedAt: timestamp("updated_at").notNull()
			});

export const session = pgTable("session", {
					id: text("id").primaryKey(),
					expiresAt: timestamp("expires_at").notNull(),
					token: text("token").notNull().unique(),
					createdAt: timestamp("created_at").notNull(),
					updatedAt: timestamp("updated_at").notNull(),
					ipAddress: text("ip_address"),
					userAgent: text("user_agent"),
					userId: text("user_id").notNull().references(() => user.id)
			});

export const account = pgTable("account", {
					id: text("id").primaryKey(),
					accountId: text("account_id").notNull(),
					providerId: text("provider_id").notNull(),
					userId: text("user_id").notNull().references(() => user.id),
					accessToken: text("access_token"),
					refreshToken: text("refresh_token"),
					idToken: text("id_token"),
					accessTokenExpiresAt: timestamp("access_token_expires_at"),
					refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
					scope: text("scope"),
					password: text("password"),
					createdAt: timestamp("created_at").notNull(),
					updatedAt: timestamp("updated_at").notNull()
			});

export const verification = pgTable("verification", {
					id: text("id").primaryKey(),
					identifier: text("identifier").notNull(),
					value: text("value").notNull(),
					expiresAt: timestamp("expires_at").notNull(),
					createdAt: timestamp("created_at"),
					updatedAt: timestamp("updated_at")
			});

// Caches the resolved GitHub owner login for a (user, route segment) pair so
// mutating server actions don't re-resolve the workspace owner (2-3 GitHub
// calls) on every write. Refreshed lazily once the row is older than the TTL.
export const workspaceOwnerCache = pgTable("workspace_owner_cache", {
					userId: text("user_id").notNull().references(() => user.id),
					routeSegment: text("route_segment").notNull(),
					login: text("login").notNull(),
					updatedAt: timestamp("updated_at").notNull(),
			}, (table) => [
					primaryKey({ columns: [table.userId, table.routeSegment] }),
			]);

// A read-only public share link to a note (file) or folder (dir) in the owner's
// private workspace repo. The public viewer fetches content live, server-side,
// using the owner's stored GitHub token — the token is never exposed and the
// viewer never authenticates. `routeOwner` is stored alongside `ownerUserId` so
// the GitHub login can be re-resolved at view time. A partial unique index
// enforces "one active link per target" while letting revoked rows coexist as
// history.
export const shareLink = pgTable("share_link", {
					id: text("id").primaryKey(),
					token: text("token").notNull().unique(),
					ownerUserId: text("owner_user_id").notNull().references(() => user.id),
					routeOwner: text("route_owner"),
					targetPath: text("target_path").notNull(),
					targetType: text("target_type").notNull(),
					createdAt: timestamp("created_at").notNull(),
					expiresAt: timestamp("expires_at"),
					revokedAt: timestamp("revoked_at"),
			}, (table) => [
					uniqueIndex("share_link_active_target_idx")
						.on(table.ownerUserId, table.routeOwner, table.targetPath, table.targetType)
						.where(sql`${table.revokedAt} is null`),
			]);
