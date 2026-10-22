/** Read-only aggregate report. DATABASE_URL stays in the environment. */
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
async function main(): Promise<void> {
  const [start, end, asOf, classificationFile] = process.argv.slice(2);
  if (
    !start ||
    !end ||
    !asOf ||
    !classificationFile ||
    !process.env.DATABASE_URL
  )
    throw new Error(
      'Usage: DATABASE_URL=... tsx scripts/measurement/report.ts startUTC endUTC asOfUTC classification.json'
    );
  if (
    ![start, end, asOf].every(
      (x) => /Z$/.test(x) && Number.isFinite(Date.parse(x))
    ) ||
    Date.parse(start) >= Date.parse(end) ||
    Date.parse(asOf) < Date.parse(start)
  )
    throw new Error('Invalid UTC window');
  const classification = JSON.parse(await readFile(classificationFile, 'utf8'));
  for (const key of [
    'qaUserIds',
    'qaTaskIds',
    'qaFlowchartIds',
    'qaCheckoutIds',
    'naturalUserIds',
  ])
    if (
      !Array.isArray(classification[key]) ||
      !classification[key].every((x: unknown) => typeof x === 'string')
    )
      throw new Error(`Missing classification array: ${key}`);
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  try {
    await sql.begin('read only', async (tx) => {
      await tx`SET LOCAL TIME ZONE 'UTC'`;
      await tx`SET LOCAL statement_timeout = '30s'`;
      const query = await readFile(
        new URL('./cohort.sql', import.meta.url),
        'utf8'
      );
      const rows = await tx.unsafe(query, [
        start,
        end,
        asOf,
        JSON.stringify(classification),
      ]);
      console.log(
        JSON.stringify(
          {
            start,
            end,
            asOf,
            timezone: 'UTC (Shanghai boundaries converted by caller)',
            rows,
          },
          null,
          2
        )
      );
    });
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    'Measurement report failed; verify inputs and DB access. No row data printed.'
  );
  process.exitCode = 1;
});
