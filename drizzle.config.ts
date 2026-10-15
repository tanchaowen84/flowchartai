import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * https://orm.drizzle.team/docs/get-started/neon-new#step-5---setup-drizzle-config-file
 */
export default defineConfig({
  out: './src/db/migrations',
  schema: ['./src/db/schema.ts', './src/db/developer-schema.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
