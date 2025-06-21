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
	model: text('model'), // e.g. 'google/gemini-2.5-flash-preview-05-20'
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
