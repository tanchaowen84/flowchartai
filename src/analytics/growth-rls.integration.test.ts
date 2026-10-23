import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { expect, test } from 'vitest';

const url = process.env.MEASUREMENT_TEST_DATABASE_URL;
if (url && !/^postgres:\/\/[^@]+@127\.0\.0\.1:55499\//.test(url))
  throw new Error('Use isolated local port 55499');

test.skipIf(!url)(
  'actual migration denies public API roles while backend retains internal access',
  async () => {
    const sql = postgres(url!, { max: 1, prepare: false });
    const schema = `growth_rls_${randomUUID().replaceAll('-', '')}`;
    const owner = `rls-${randomUUID()}`;
    const migration = await readFile(
      new URL('../db/migrations/0012_needy_sinister_six.sql', import.meta.url),
      'utf8'
    );
    try {
      const rollback = new Error('ROLLBACK_LOCAL_RLS_FIXTURE');
      await expect(
        sql.begin(async (tx) => {
          // This guarded, owned local cluster has no Supabase roles. Roll back
          // roles, grants, schema and fixture together, even when assertions fail.
          const existing =
            await tx`SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')`;
          expect(existing).toHaveLength(0);
          await tx.unsafe('CREATE ROLE anon NOLOGIN NOBYPASSRLS');
          await tx.unsafe('CREATE ROLE authenticated NOLOGIN NOBYPASSRLS');
          await tx.unsafe(`CREATE SCHEMA ${schema}`);
          await tx.unsafe(`SET LOCAL search_path TO ${schema}, public`);
          await tx.unsafe(
            `GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated`
          );
          await tx.unsafe(
            `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON TABLES TO anon, authenticated`
          );
          for (const statement of migration.split('--> statement-breakpoint'))
            if (statement.trim()) await tx.unsafe(statement);
          await tx`INSERT INTO public."user" (id,name,email,email_verified,created_at,updated_at) VALUES (${owner},'Local RLS fixture',${`${owner}@example.invalid`},true,now(),now())`;
          await tx`INSERT INTO growth_acquisition (user_id,observation) VALUES (${owner},'{}')`;
          await tx`INSERT INTO growth_events (id,user_id,name) VALUES (${owner},${owner},'result_ready')`;
          for (const table of ['growth_acquisition', 'growth_events']) {
            const [state] =
              await tx`SELECT relrowsecurity FROM pg_class WHERE oid=${`${schema}.${table}`}::regclass`;
            expect(state.relrowsecurity).toBe(true);
            for (const role of ['anon', 'authenticated']) {
              for (const privilege of [
                'SELECT',
                'INSERT',
                'UPDATE',
                'DELETE',
                'TRUNCATE',
                'REFERENCES',
                'TRIGGER',
              ]) {
                const [grant] =
                  await tx`SELECT has_table_privilege(${role},${`${schema}.${table}`},${privilege}) AS allowed`;
                expect(grant.allowed).toBe(false);
              }
            }
            // Also prove RLS still denies rows if someone re-grants DML later.
            await tx.unsafe(
              `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO anon, authenticated`
            );
            for (const role of ['anon', 'authenticated']) {
              await tx.unsafe(`SET LOCAL ROLE ${role}`);
              expect(await tx.unsafe(`SELECT * FROM ${table}`)).toHaveLength(0);
              expect(
                (await tx.unsafe(`UPDATE ${table} SET user_id=user_id`)).count
              ).toBe(0);
              expect((await tx.unsafe(`DELETE FROM ${table}`)).count).toBe(0);
              await expect(
                tx.savepoint(async (save) => {
                  await (table === 'growth_acquisition'
                    ? save`INSERT INTO growth_acquisition (user_id,observation) VALUES (${owner + role},'{}')`
                    : save`INSERT INTO growth_events (id,user_id,name) VALUES (${owner + role},${owner},'result_ready')`);
                })
              ).rejects.toMatchObject({ code: '42501' });
              await tx.unsafe('RESET ROLE');
            }
            expect(await tx.unsafe(`SELECT * FROM ${table}`)).toHaveLength(1);
          }
          throw rollback;
        })
      ).rejects.toBe(rollback);
    } finally {
      await sql.end();
    }
  }
);
