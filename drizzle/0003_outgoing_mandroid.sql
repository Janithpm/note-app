CREATE TABLE "share_link" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"route_owner" text,
	"target_path" text NOT NULL,
	"target_type" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "share_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_active_target_idx" ON "share_link" USING btree ("owner_user_id","route_owner","target_path","target_type") WHERE "share_link"."revoked_at" is null;