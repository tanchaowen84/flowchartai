CREATE TABLE "guest_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"type" text NOT NULL,
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guest_usage_ip_date_idx" ON "guest_usage" USING btree ("ip_hash","created_at");