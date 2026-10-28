/** Source-owned observation revisions. No diagram content or current-state backdating. */
import { createHash } from 'node:crypto';
import type {
  Attributes,
  DataBatch,
  EntityRef,
  Manifest,
} from '@site-insights/sdk/analytics';
export const insightsManifest: Manifest = {
  version: 1,
  description:
    'Flowchart first-party observations and immutable business associations.',
  events: {},
  entities: {
    artifact: {
      description:
        'Saved diagram identity. Attributes describe this event observation, not the latest document.',
      attributes: { editor: { type: 'string' }, format: { type: 'string' } },
    },
    task: {
      description:
        'Generation task. Model identifies recorded routing, not explicit user preference.',
      attributes: { model: { type: 'string' } },
    },
    checkout: {
      description: 'Checkout handoff identity. Not proof of payment.',
      attributes: {},
    },
  },
};
type Observation = {
  event_id: string;
  occurred_at: string;
  properties?: Record<string, unknown>;
};
export function associateInsightsEvents(
  events: Observation[],
  references: { event_id: string; flowchart_id: string | null }[]
): DataBatch {
  const entities: NonNullable<DataBatch['entities']> = [];
  const links: NonNullable<DataBatch['links']> = [];
  const relations: NonNullable<DataBatch['relations']> = [];
  const artifacts = new Map(
    references
      .filter((r) => r.flowchart_id)
      .map((r) => [r.event_id, r.flowchart_id!])
  );
  for (const e of events) {
    const p = e.properties || {};
    const revision = createHash('sha256').update(e.event_id).digest('hex');
    const attach = (
      type: string,
      id: string,
      attributes: Attributes
    ): EntityRef => {
      const ref = { type, id, revision };
      entities.push({ ...ref, occurred_at: e.occurred_at, attributes });
      links.push({ event_id: e.event_id, role: type, entity: ref });
      return ref;
    };
    const task =
      typeof p.task_id === 'string'
        ? attach(
            'task',
            p.task_id,
            typeof p.model === 'string' ? { model: p.model } : {}
          )
        : undefined;
    const artifactId = artifacts.get(e.event_id);
    const attributes: Attributes = {};
    if (typeof p.editor === 'string') attributes.editor = p.editor;
    if (typeof p.format === 'string') attributes.format = p.format;
    const artifact = artifactId
      ? attach('artifact', artifactId, attributes)
      : undefined;
    if (task && artifact)
      relations.push({ from: task, relation: 'produces', to: artifact });
    if (typeof p.checkout_id === 'string')
      attach('checkout', p.checkout_id, {});
  }
  return { entities, links, relations };
}
