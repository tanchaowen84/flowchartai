-- Credits per AI request, for CREDITS_PER_TYPICAL_DIAGRAM in src/lib/billing/presentation.ts.
-- Read-only. Run in the Supabase SQL editor (production) and paste the result back.
-- Counts settled, paid (non-legacy) requests only; first-diagram rows are split out
-- because their charge is capped at 20.
select
  first_diagram,
  count(*) as requests,
  count(distinct user_id) as users,
  percentile_cont(0.25) within group (order by charged) as p25,
  percentile_cont(0.50) within group (order by charged) as median,
  percentile_cont(0.75) within group (order by charged) as p75,
  percentile_cont(0.90) within group (order by charged) as p90,
  round(avg(charged), 1) as average,
  min(created_at)::date as first_day,
  max(created_at)::date as last_day
from billing_tasks
where state = 'committed'
  and not legacy
  and charged > 0
group by first_diagram
order by first_diagram;
