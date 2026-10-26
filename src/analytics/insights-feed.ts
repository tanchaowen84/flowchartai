/** Server-controlled QA classification applies to every exported source. */
export function insightsQaUsers(): Set<string> {
  return new Set(
    (process.env.SITE_INSIGHTS_QA_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}
export function normalizeInsightsRecord(
  row: { at: Date | string; event: Record<string, any> },
  qaUsers = insightsQaUsers()
): Record<string, unknown> {
  const e = { ...row.event };
  for (const key of Object.keys(e)) if (e[key] === null) delete e[key];
  const providerAt =
    typeof e.occurred_at === 'string' &&
    Number.isFinite(Date.parse(e.occurred_at))
      ? e.occurred_at
      : null;
  const financial = ['payment_succeeded', 'refund_succeeded'].includes(e.name);
  return {
    ...e,
    qa: qaUsers.has(e.user_id),
    occurred_at: new Date(providerAt || row.at).toISOString(),
    properties: {
      ...e.properties,
      ...(financial ? { time_basis: providerAt ? 'provider' : 'receipt' } : {}),
    },
  };
}
