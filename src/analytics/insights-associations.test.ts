import { describe, expect, it } from 'vitest';
import { associateInsightsEvents } from './insights-associations';
describe('immutable Flowchart business associations', () => {
  it('links a saved artifact without inventing a generation task or changing the receipt', () => {
    const event = {
      event_id: 'growth:g1',
      name: 'save_succeeded',
      occurred_at: '2026-10-28T00:00:00.000Z',
      user_id: 'u',
      properties: { editor: 'drawio' },
    };
    const before = JSON.stringify(event);
    const batch = associateInsightsEvents(
      [event],
      [{ event_id: 'growth:g1', flowchart_id: 'file1' }]
    );
    expect(JSON.stringify(event)).toBe(before);
    expect(batch.entities).toHaveLength(1);
    expect(batch.entities![0]).toMatchObject({
      type: 'artifact',
      id: 'file1',
      attributes: { editor: 'drawio' },
    });
    expect(batch.links![0]).toMatchObject({
      event_id: 'growth:g1',
      role: 'artifact',
    });
    expect(batch.relations).toEqual([]);
  });
  it('joins task, artifact and recorded cost while keeping model choice observational', () => {
    const events = [
      {
        event_id: 'growth:g2',
        name: 'result_ready',
        occurred_at: '2026-10-28T00:00:00.000Z',
        properties: { task_id: 't1', editor: 'drawio' },
      },
      {
        event_id: 'cost:t1:1',
        name: 'cost_recorded',
        occurred_at: '2026-10-28T00:00:01.000Z',
        properties: { task_id: 't1', model: 'routed-model', amount_micros: 20 },
      },
    ];
    const batch = associateInsightsEvents(events, [
      { event_id: 'growth:g2', flowchart_id: 'file1' },
    ]);
    expect(batch.relations![0]).toMatchObject({
      relation: 'produces',
      from: { type: 'task', id: 't1' },
      to: { type: 'artifact', id: 'file1' },
    });
    expect(batch.entities!.filter((e) => e.type === 'task')).toHaveLength(2);
    expect(batch.entities![2].attributes).toEqual({ model: 'routed-model' });
  });
});
