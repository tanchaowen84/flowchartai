import { boolean, pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified'),
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
