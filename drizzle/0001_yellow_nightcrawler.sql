ALTER TABLE "user" ADD COLUMN "workspace_persistence_mode" text DEFAULT 'cookie' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "workspace_last_active_owner" text;