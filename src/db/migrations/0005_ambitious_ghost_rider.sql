CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"tokens_used" integer DEFAULT 0,
	"model" text,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_date_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_user_type_idx" ON "ai_usage" USING btree ("user_id","type");