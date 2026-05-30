import { pgTable, text, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";

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
