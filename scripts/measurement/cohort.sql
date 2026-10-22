-- $1 start UTC, $2 end UTC, $3 as-of UTC, $4 classification JSON.
-- All ranges are half-open. No row-level identifiers leave this query.
WITH p AS (
 SELECT $1::timestamp AS start_at, $2::timestamp AS end_at, $3::timestamp AS as_of, $4::text::jsonb AS classification
), qa_users AS (
 SELECT value AS id FROM p, jsonb_array_elements_text(coalesce(classification->'qaUserIds','[]'))
 UNION SELECT user_id FROM billing_tasks,p WHERE id IN (SELECT jsonb_array_elements_text(coalesce(classification->'qaTaskIds','[]')))
 UNION SELECT user_id FROM flowcharts,p WHERE id IN (SELECT jsonb_array_elements_text(coalesce(classification->'qaFlowchartIds','[]')))
 UNION SELECT user_id FROM billing_checkouts,p WHERE id IN (SELECT jsonb_array_elements_text(coalesce(classification->'qaCheckoutIds','[]')))
 UNION SELECT user_id FROM growth_events,p WHERE task_id IN (SELECT jsonb_array_elements_text(coalesce(classification->'qaTaskIds','[]'))) OR flowchart_id IN (SELECT jsonb_array_elements_text(coalesce(classification->'qaFlowchartIds','[]'))) OR checkout_id IN (SELECT jsonb_array_elements_text(coalesce(classification->'qaCheckoutIds','[]')))
), cohort AS (
 SELECT u.id,u.created_at,
   CASE WHEN u.id IN (SELECT id FROM qa_users) THEN 'qa'
        WHEN u.id IN (SELECT jsonb_array_elements_text(coalesce(classification->'naturalUserIds','[]'))) THEN 'natural'
        ELSE 'unclassified' END AS audience,
   u.created_at + interval '24 hours' <= p.as_of AS mature,
   coalesce(a.observation->>'kind','unknown') AS acquisition,
   coalesce(a.observation->>'source',a.observation->>'referrer','(none observed)') AS acquisition_source,
   coalesce(a.observation->>'medium','(none observed)') AS acquisition_medium,
   coalesce(a.observation->>'entry','/unknown') AS acquisition_entry,
   p.as_of
 FROM "user" u CROSS JOIN p
 LEFT JOIN growth_acquisition a ON a.user_id=u.id AND a.recorded_at<p.as_of
 WHERE u.created_at>=p.start_at AND u.created_at<p.end_at AND u.created_at<p.as_of
), events AS (
 SELECT e.* FROM growth_events e,p WHERE e.recorded_at<p.as_of
), delivery_observations AS (
 SELECT e.*,coalesce(e.flowchart_id,(SELECT r.flowchart_id FROM events r WHERE r.user_id=e.user_id AND r.task_id=e.task_id AND r.name='result_ready' AND r.flowchart_id IS NOT NULL ORDER BY r.recorded_at LIMIT 1)) AS linked_file
 FROM events e WHERE e.name IN ('result_delivered','result_ready') AND e.task_id IS NOT NULL
), delivered AS (
 -- The canonical result is one saved file, or one explicitly unmapped task.
 -- A task acknowledgement supersedes its earlier render observation.
 SELECT DISTINCT ON (e.user_id,coalesce('file:'||e.linked_file,'task:'||e.task_id))
   e.user_id,coalesce('file:'||e.linked_file,'task:'||e.task_id) AS result_key,
   e.task_id,e.linked_file AS flowchart_id,e.recorded_at AS delivered_at,e.name AS evidence,
   e.recorded_at + interval '24 hours'<=c.as_of AS mature
 FROM delivery_observations e JOIN cohort c ON c.id=e.user_id
 WHERE e.task_id IS NOT NULL
   AND e.recorded_at>=c.created_at AND e.recorded_at<c.created_at+interval '24 hours'
   AND NOT (e.name='result_ready' AND EXISTS (SELECT 1 FROM events x WHERE x.user_id=e.user_id AND x.task_id=e.task_id AND x.name='result_delivered'))
 ORDER BY e.user_id,coalesce('file:'||e.linked_file,'task:'||e.task_id),e.recorded_at
), result_usage AS (
 SELECT d.*,row_number() OVER (PARTITION BY d.user_id ORDER BY d.delivered_at,d.result_key) AS result_rank,
 EXISTS (SELECT 1 FROM events e WHERE e.user_id=d.user_id
   AND (e.name='export_initiated' OR e.name='save_succeeded')
   AND ((d.flowchart_id IS NOT NULL AND e.flowchart_id=d.flowchart_id)
     OR (d.flowchart_id IS NULL AND e.task_id=d.task_id))
   AND e.recorded_at>d.delivered_at AND e.recorded_at<d.delivered_at+interval '24 hours') AS used
 FROM delivered d
), exposure AS (
 SELECT c.id,min(e.recorded_at) AS exposed_at,c.as_of
 FROM cohort c JOIN events e ON e.user_id=c.id AND e.name='paywall_viewed'
 WHERE c.mature AND e.recorded_at>=c.created_at AND e.recorded_at<c.created_at+interval '24 hours'
 GROUP BY c.id,c.as_of
), funnel AS (
 SELECT x.*, x.exposed_at+interval '24 hours'<=x.as_of AS mature,
 EXISTS (SELECT 1 FROM events e JOIN billing_checkouts b ON b.id=e.checkout_id AND b.user_id=e.user_id
   WHERE e.user_id=x.id AND e.name='checkout_handoff' AND e.source='paywall'
   AND b.created_at<=e.recorded_at AND b.created_at<x.as_of
   AND e.recorded_at>=x.exposed_at AND e.recorded_at<x.exposed_at+interval '24 hours') AS handed_off,
 EXISTS (SELECT 1 FROM events e JOIN billing_checkouts b ON b.id=e.checkout_id AND b.user_id=e.user_id
   JOIN billing_events be ON be.order_id=b.order_id
   WHERE e.user_id=x.id AND e.name='checkout_handoff' AND e.source='paywall'
   AND b.environment='live' AND b.state='paid' AND be.provider='waffo'
   AND be.event_type IN ('order.completed','subscription.payment_succeeded')
   AND be.created_at>=e.recorded_at AND be.created_at<x.as_of
   AND e.recorded_at>=x.exposed_at AND e.recorded_at<x.exposed_at+interval '24 hours') AS order_with_provider_receipt
 FROM exposure x
)
SELECT c.audience,
 count(*)::int AS accounts,
 (SELECT jsonb_agg(to_jsonb(b)) FROM (SELECT k.acquisition AS kind,k.acquisition_source AS source,k.acquisition_medium AS medium,k.acquisition_entry AS entry,count(*)::int AS accounts FROM cohort k WHERE k.audience=c.audience GROUP BY 1,2,3,4 ORDER BY 1,2,3,4) b) AS acquisition_breakdown,
 count(*) FILTER (WHERE c.mature)::int AS mature_accounts_24h,
 count(*) FILTER (WHERE NOT c.mature)::int AS immature_accounts,
 count(*) FILTER (WHERE c.acquisition='unknown')::int AS source_unknown_accounts,
 count(*) FILTER (WHERE c.acquisition='direct_observed')::int AS direct_observed_accounts,
 (SELECT count(*)::int FROM billing_tasks t JOIN cohort k ON k.id=t.user_id WHERE k.audience=c.audience AND k.mature AND t.created_at>=k.created_at AND t.created_at<least(k.created_at+interval '24 hours',k.as_of)) AS accepted_billing_tasks,
 (SELECT count(*)::int FROM billing_tasks t JOIN cohort k ON k.id=t.user_id WHERE k.audience=c.audience AND k.mature AND t.created_at>=k.created_at AND t.created_at<least(k.created_at+interval '24 hours',k.as_of) AND NOT EXISTS (SELECT 1 FROM delivery_observations d WHERE d.user_id=t.user_id AND d.task_id=t.id AND d.recorded_at>=k.created_at AND d.recorded_at<least(k.created_at+interval '24 hours',k.as_of))) AS accepted_tasks_without_delivery_observation,
 (SELECT count(*)::int FROM ai_usage a JOIN cohort k ON k.id=a.user_id WHERE k.audience=c.audience AND k.mature AND a.id NOT LIKE 'billing:%' AND a.created_at>=k.created_at AND a.created_at<least(k.created_at+interval '24 hours',k.as_of)) AS legacy_usage_records_not_delivery_proof,
 (SELECT count(*)::int FROM result_usage r JOIN cohort k ON k.id=r.user_id WHERE k.audience=c.audience AND k.mature AND r.mature) AS mature_delivered_results,
 (SELECT count(*)::int FROM result_usage r JOIN cohort k ON k.id=r.user_id WHERE k.audience=c.audience AND k.mature AND r.mature AND r.result_rank=1) AS mature_first_results,
 (SELECT count(*)::int FROM result_usage r JOIN cohort k ON k.id=r.user_id WHERE k.audience=c.audience AND k.mature AND r.mature AND r.result_rank=1 AND r.used) AS used_first_results,
 (SELECT count(*)::int FROM result_usage r JOIN cohort k ON k.id=r.user_id WHERE k.audience=c.audience AND k.mature AND NOT r.mature) AS immature_results,
 (SELECT count(*)::int FROM result_usage r JOIN cohort k ON k.id=r.user_id WHERE k.audience=c.audience AND k.mature AND r.mature AND r.used) AS used_results,
 (SELECT count(*)::int FROM result_usage r JOIN cohort k ON k.id=r.user_id WHERE k.audience=c.audience AND k.mature AND r.flowchart_id IS NULL) AS delivered_without_saved_file,
 (SELECT count(*)::int FROM events e JOIN cohort k ON k.id=e.user_id WHERE k.audience=c.audience AND k.mature AND e.name IN ('save_succeeded','export_initiated') AND e.recorded_at>=k.created_at AND e.recorded_at<least(k.created_at+interval '48 hours',k.as_of) AND NOT EXISTS (SELECT 1 FROM delivered d WHERE d.user_id=e.user_id AND (d.flowchart_id=e.flowchart_id OR d.task_id=e.task_id))) AS use_events_without_cohort_delivery,
 (SELECT count(*)::int FROM funnel f JOIN cohort k ON k.id=f.id WHERE k.audience=c.audience AND f.mature) AS mature_paywall_accounts,
 (SELECT count(*)::int FROM funnel f JOIN cohort k ON k.id=f.id WHERE k.audience=c.audience AND NOT f.mature) AS immature_paywall_accounts,
 (SELECT count(*)::int FROM funnel f JOIN cohort k ON k.id=f.id WHERE k.audience=c.audience AND f.mature AND f.handed_off) AS paywall_to_checkout_accounts,
 (SELECT count(*)::int FROM funnel f JOIN cohort k ON k.id=f.id WHERE k.audience=c.audience AND f.mature AND f.order_with_provider_receipt) AS handed_off_orders_with_provider_receipt_accounts,
 (SELECT count(*)::int FROM events e JOIN cohort k ON k.id=e.user_id WHERE k.audience=c.audience AND e.name='checkout_handoff' AND e.recorded_at>=k.created_at AND e.recorded_at<least(k.created_at+interval '48 hours',k.as_of) AND e.checkout_id IS NULL) AS unlinked_handoff_events
FROM cohort c GROUP BY c.audience ORDER BY c.audience;
