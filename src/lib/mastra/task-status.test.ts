import { expect, it } from 'vitest';
import { taskStatusLabel } from './task-status';

it('keeps an active request visible after the assistant starts writing text', () => {
  expect(
    taskStatusLabel({
      active: true,
      phase: 'responding',
      startedAt: 1,
      outcome: 'ready',
    })
  ).toBe('Preparing the response…');
  expect(
    taskStatusLabel({
      active: true,
      phase: 'idle',
      startedAt: 1,
      outcome: 'ready',
    })
  ).toBe('Processing request…');
});

it('distinguishes a committed diagram, failed request and cancellation', () => {
  expect(
    taskStatusLabel({
      active: false,
      phase: 'idle',
      startedAt: 1,
      outcome: 'done',
    })
  ).toBe('Diagram updated');
  expect(
    taskStatusLabel({
      active: false,
      phase: 'idle',
      startedAt: 1,
      outcome: 'failed',
    })
  ).toContain('diagram kept');
  expect(
    taskStatusLabel({
      active: false,
      phase: 'idle',
      startedAt: 1,
      outcome: 'cancelled',
    })
  ).toBe('Cancelled · diagram kept');
});
