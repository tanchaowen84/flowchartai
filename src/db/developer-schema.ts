/** Additive developer identities, revocable OAuth grants and durable operation receipts. */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { flowcharts, user } from './schema';

export const developerSettings = pgTable('developer_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  dailyCredits: integer('daily_credits').notNull().default(1000),
  dailyRequests: integer('daily_requests').notNull().default(100),
});
export const developerClients = pgTable('developer_oauth_clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const developerCredentials = pgTable(
  'developer_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    secretHash: text('secret_hash').unique(),
    clientId: text('client_id').references(() => developerClients.id),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    dailyCredits: integer('daily_credits').notNull(),
    dailyRequests: integer('daily_requests').notNull(),
    rateLimit: integer('rate_limit').notNull().default(60),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({ owner: index('developer_credentials_owner_idx').on(t.userId) })
);
export const developerCodes = pgTable('developer_oauth_codes', {
  hash: text('hash').primaryKey(),
  credentialId: text('credential_id')
    .notNull()
    .references(() => developerCredentials.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  challenge: text('challenge').notNull(),
  resource: text('resource').notNull(),
  offline: boolean('offline').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
});
export const developerTokens = pgTable(
  'developer_oauth_tokens',
  {
    hash: text('hash').primaryKey(),
    credentialId: text('credential_id')
      .notNull()
      .references(() => developerCredentials.id, { onDelete: 'cascade' }),
    familyId: text('family_id').notNull(),
    kind: text('kind').notNull(),
    resource: text('resource').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => ({ grant: index('developer_tokens_grant_idx').on(t.credentialId) })
);
export const developerTasks = pgTable(
  'developer_tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id')
      .notNull()
      .references(() => developerCredentials.id),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    operation: text('operation').notNull(),
    diagramId: text('diagram_id').notNull(),
    state: text('state').notNull(),
    budget: integer('budget').notNull(),
    charged: integer('charged').notNull().default(0),
    result: jsonb('result').$type<Record<string, unknown>>(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idempotency: uniqueIndex('developer_tasks_idempotency_idx').on(
      t.userId,
      t.idempotencyKey
    ),
    owner: index('developer_tasks_owner_date_idx').on(t.userId, t.createdAt),
  })
);
export const developerVersions = pgTable(
  'developer_diagram_versions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    diagramId: text('diagram_id')
      .notNull()
      .references(() => flowcharts.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    diagram: index('developer_versions_diagram_idx').on(
      t.diagramId,
      t.createdAt
    ),
  })
);
export const developerRateWindows = pgTable('developer_rate_windows', {
  id: text('id').primaryKey(),
  count: integer('count').notNull().default(1),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
