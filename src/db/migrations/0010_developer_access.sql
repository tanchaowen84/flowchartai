CREATE TABLE "developer_oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_oauth_codes" (
	"hash" text PRIMARY KEY NOT NULL,
	"credential_id" text NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"challenge" text NOT NULL,
	"resource" text NOT NULL,
	"offline" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "developer_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text,
	"client_id" text,
	"scopes" jsonb NOT NULL,
	"daily_credits" integer NOT NULL,
	"daily_requests" integer NOT NULL,
	"rate_limit" integer DEFAULT 60 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "developer_credentials_secret_hash_unique" UNIQUE("secret_hash")
);
--> statement-breakpoint
CREATE TABLE "developer_rate_windows" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"daily_credits" integer DEFAULT 1000 NOT NULL,
	"daily_requests" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"operation" text NOT NULL,
	"diagram_id" text NOT NULL,
	"state" text NOT NULL,
	"budget" integer NOT NULL,
	"charged" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_oauth_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"credential_id" text NOT NULL,
	"family_id" text NOT NULL,
	"kind" text NOT NULL,
	"resource" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "developer_diagram_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"diagram_id" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "developer_oauth_codes" ADD CONSTRAINT "developer_oauth_codes_credential_id_developer_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."developer_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_credentials" ADD CONSTRAINT "developer_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_credentials" ADD CONSTRAINT "developer_credentials_client_id_developer_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."developer_oauth_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_settings" ADD CONSTRAINT "developer_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_tasks" ADD CONSTRAINT "developer_tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_tasks" ADD CONSTRAINT "developer_tasks_credential_id_developer_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."developer_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_oauth_tokens" ADD CONSTRAINT "developer_oauth_tokens_credential_id_developer_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."developer_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_diagram_versions" ADD CONSTRAINT "developer_diagram_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_diagram_versions" ADD CONSTRAINT "developer_diagram_versions_diagram_id_flowcharts_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."flowcharts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "developer_credentials_owner_idx" ON "developer_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developer_tasks_idempotency_idx" ON "developer_tasks" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "developer_tasks_owner_date_idx" ON "developer_tasks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "developer_tokens_grant_idx" ON "developer_oauth_tokens" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "developer_versions_diagram_idx" ON "developer_diagram_versions" USING btree ("diagram_id","created_at");