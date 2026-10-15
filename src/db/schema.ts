import { boolean, pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires'),
	customerId: text('customer_id'),
	// Creem related fields
	creemCustomerId: text('creem_customer_id').unique(),
	country: text('country'),
	credits: integer('credits').default(0),
	metadata: jsonb('metadata').default('{}'),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	impersonatedBy: text('impersonated_by')
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const payment = pgTable("payment", {
	id: text("id").primaryKey(),
	priceId: text('price_id').notNull(),
	type: text('type').notNull(),
	interval: text('interval'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	customerId: text('customer_id').notNull(),
	subscriptionId: text('subscription_id'),
	status: text('status').notNull(),
	periodStart: timestamp('period_start'),
	periodEnd: timestamp('period_end'),
	cancelAtPeriodEnd: boolean('cancel_at_period_end'),
	trialStart: timestamp('trial_start'),
	trialEnd: timestamp('trial_end'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	provider: text("provider").notNull().default("creem"),
	offerKey: text("offer_key"),
	legacyPlan: text("legacy_plan"),
	// Creem specific fields
	canceledAt: timestamp('canceled_at'),
	metadata: jsonb('metadata').default('{}'),
});

export const creditsHistory = pgTable("credits_history", {
	id: text("id").primaryKey(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	amount: integer('amount').notNull(),
	type: text('type').notNull(), // 'add' | 'subtract'
	description: text('description'),
	creemOrderId: text('creem_order_id'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	metadata: jsonb('metadata').default('{}'),
});

export const flowcharts = pgTable("flowcharts", {
	id: text("id").primaryKey(),
	title: text('title').notNull().default('Untitled'),
	content: text('content').notNull(), // Excalidraw serializeAsJSON result
	thumbnail: text('thumbnail'), // Base64 encoded thumbnail image
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => {
	return {
		userUpdatedIdx: index('flowcharts_user_updated_idx').on(table.userId, table.updatedAt),
	}
});

export const aiUsage = pgTable("ai_usage", {
	id: text("id").primaryKey(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // 'flowchart_generation', 'canvas_analysis', etc.
	tokensUsed: integer('tokens_used').default(0),
	model: text('model'), // e.g. 'deepseek/deepseek-v4-flash'
	success: boolean('success').notNull().default(true),
	errorMessage: text('error_message'),
	metadata: jsonb('metadata').default('{}'), // Additional context like mermaid code length, etc.
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
	return {
		userDateIdx: index('ai_usage_user_date_idx').on(table.userId, table.createdAt),
		userTypeIdx: index('ai_usage_user_type_idx').on(table.userId, table.type),
	}
});

export const guestUsage = pgTable("guest_usage", {
	id: text("id").primaryKey(),
	ipHash: text('ip_hash').notNull(), // SHA256 hash of IP address
	type: text('type').notNull(), // 'flowchart_generation', etc.
	userAgent: text('user_agent'), // Browser fingerprint for additional validation
	success: boolean('success').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
	return {
		ipHashDateIdx: index('guest_usage_ip_date_idx').on(table.ipHash, table.createdAt),
	}
});

// Billing V1: additive tables; historical balances and ledger are preserved.
export const creditBuckets = pgTable('credit_buckets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  sourceKey: text('source_key').notNull().unique(),
  granted: integer('granted').notNull(),
  remaining: integer('remaining').notNull(),
  reserved: integer('reserved').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  paymentId: text('payment_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const billingTasks = pgTable(
  'billing_tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    requestHash: text('request_hash').notNull(),
    state: text('state').notNull(),
    budget: integer('budget').notNull(),
    charged: integer('charged').notNull().default(0),
    legacy: boolean('legacy').notNull().default(false),
    firstDiagram: boolean('first_diagram').notNull().default(false),
    rateVersion: text('rate_version').notNull(),
    allocations: jsonb('allocations').notNull().default('[]'),
    calls: jsonb('calls').notNull().default('[]'),
    result: jsonb('result'),
    resultHash: text('result_hash'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userState: index('billing_tasks_user_state_idx').on(t.userId, t.state),
  })
);
export const billingSubscriptions = pgTable('billing_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  offerKey: text('offer_key').notNull(),
  status: text('status').notNull(),
  anchor: timestamp('anchor').notNull(),
  paidThrough: timestamp('paid_through').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  eventAt: timestamp('event_at').notNull(),
});
export const billingCheckouts = pgTable('billing_checkouts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  offerKey: text('offer_key').notNull(),
  environment: text('environment').notNull(),
  state: text('state').notNull().default('pending'),
  orderId: text('order_id').unique(),
  sessionId: text('session_id'),
  checkoutUrl: text('checkout_url'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const billingEvents = pgTable('billing_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  orderId: text('order_id'),
  paymentId: text('payment_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
