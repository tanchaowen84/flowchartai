import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema';
/** Internal measurement only; never include these keys in third-party events. */
export const growthAcquisition = pgTable('growth_acquisition', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  captureKey: text('capture_key').unique(),
  observation: jsonb('observation').notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});
export const growthEvents = pgTable(
  'growth_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    taskId: text('task_id'),
    flowchartId: text('flowchart_id'),
    checkoutId: text('checkout_id'),
    source: text('source'),
    properties: jsonb('properties').notNull().default('{}'),
    recordedAt: timestamp('recorded_at').notNull().defaultNow(),
  },
  (t) => ({
    userTime: index('growth_events_user_time_idx').on(t.userId, t.recordedAt),
  })
);
