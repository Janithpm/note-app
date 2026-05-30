CREATE TABLE "workspace_owner_cache" (
	"user_id" text NOT NULL,
	"route_segment" text NOT NULL,
	"login" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "workspace_owner_cache_user_id_route_segment_pk" PRIMARY KEY("user_id","route_segment")
);
--> statement-breakpoint
ALTER TABLE "workspace_owner_cache" ADD CONSTRAINT "workspace_owner_cache_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;