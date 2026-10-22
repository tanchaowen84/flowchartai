CREATE TABLE "growth_acquisition" (
	"user_id" text PRIMARY KEY NOT NULL,
	"capture_key" text,
	"observation" jsonb NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "growth_acquisition_capture_key_unique" UNIQUE("capture_key")
);
--> statement-breakpoint
CREATE TABLE "growth_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"task_id" text,
	"flowchart_id" text,
	"checkout_id" text,
	"source" text,
	"properties" jsonb DEFAULT '{}' NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_acquisition" ADD CONSTRAINT "growth_acquisition_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_events" ADD CONSTRAINT "growth_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "growth_events_user_time_idx" ON "growth_events" USING btree ("user_id","recorded_at");