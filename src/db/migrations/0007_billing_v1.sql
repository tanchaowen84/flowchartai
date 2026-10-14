CREATE TABLE "billing_checkouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"offer_key" text NOT NULL,
	"environment" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"order_id" text,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_checkouts_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"order_id" text,
	"payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"offer_key" text NOT NULL,
	"status" text NOT NULL,
	"anchor" timestamp NOT NULL,
	"paid_through" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"event_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"state" text NOT NULL,
	"budget" integer NOT NULL,
	"charged" integer DEFAULT 0 NOT NULL,
	"legacy" boolean DEFAULT false NOT NULL,
	"rate_version" text NOT NULL,
	"allocations" jsonb DEFAULT '[]' NOT NULL,
	"calls" jsonb DEFAULT '[]' NOT NULL,
	"result" jsonb,
	"result_hash" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"granted" integer NOT NULL,
	"remaining" integer NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_buckets_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider" text DEFAULT 'creem' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "offer_key" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "legacy_plan" text;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tasks" ADD CONSTRAINT "billing_tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_buckets" ADD CONSTRAINT "credit_buckets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_tasks_user_state_idx" ON "billing_tasks" USING btree ("user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX billing_tasks_one_active_per_user ON billing_tasks(user_id) WHERE state IN ('running','ready');
--> statement-breakpoint
ALTER TABLE credit_buckets ADD CONSTRAINT credit_buckets_nonnegative CHECK (granted >= 0 AND remaining >= 0 AND reserved >= 0 AND remaining + reserved <= granted);
--> statement-breakpoint
ALTER TABLE billing_tasks ADD CONSTRAINT billing_tasks_charge_budget CHECK (budget > 0 AND charged >= 0 AND charged <= budget);
--> statement-breakpoint
ALTER TABLE credit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_buckets, billing_tasks, billing_subscriptions, billing_checkouts, billing_events FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON credit_buckets,billing_tasks,billing_subscriptions,billing_checkouts,billing_events FROM anon'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON credit_buckets,billing_tasks,billing_subscriptions,billing_checkouts,billing_events FROM authenticated'; END IF;
END $$;
