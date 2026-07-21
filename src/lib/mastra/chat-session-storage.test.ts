import { describe, expect, it } from 'vitest';
import {
  buildRetryConversation,
  getCanvasChatStorageKey,
  parseCanvasChatSession,
  serializeCanvasChatSession,
} from './chat-session-storage';

describe('canvas chat session storage', () => {
  it('isolates saved flowchart ids and uses one stable unsaved key', () => {
    const first = getCanvasChatStorageKey('flowchart-1');
    const second = getCanvasChatStorageKey('flowchart-2');
    const unsaved = getCanvasChatStorageKey();

    expect(first).toBe(getCanvasChatStorageKey('flowchart-1'));
    expect(first).not.toBe(second);
    expect(unsaved).toBe(getCanvasChatStorageKey(undefined));
    expect(unsaved).not.toBe(first);
  });

  it('round-trips draft, mode, messages, and Date timestamps', () => {
    const userTimestamp = new Date('2026-07-21T06:10:00.000Z');
    const assistantTimestamp = new Date('2026-07-21T06:10:02.000Z');
    const session = {
      version: 1,
      draft: '把 Done 改成 Ready',
      mode: 'text_to_flowchart' as const,
      messages: [
        {
          id: 'user-1',
          role: 'user' as const,
          content: 'Create a simple flowchart',
          timestamp: userTimestamp,
        },
        {
          id: 'assistant-1',
          role: 'assistant' as const,
          content: 'Created the flowchart.',
          timestamp: assistantTimestamp,
        },
      ],
    };

    const parsed = parseCanvasChatSession(serializeCanvasChatSession(session));

    expect(parsed).toEqual(session);
    expect(parsed?.messages[0]?.timestamp).toBeInstanceOf(Date);
    expect(parsed?.messages[0]?.timestamp.toISOString()).toBe(
      userTimestamp.toISOString()
    );
    expect(parsed?.messages[1]?.timestamp).toBeInstanceOf(Date);
  });

  it('returns null for malformed or unknown-version data without throwing', () => {
    expect(() => parseCanvasChatSession('{not-json')).not.toThrow();
    expect(parseCanvasChatSession('{not-json')).toBeNull();
    expect(parseCanvasChatSession(null)).toBeNull();
    expect(
      parseCanvasChatSession(
        JSON.stringify({
          version: 999,
          draft: '',
          mode: 'text_to_flowchart',
          messages: [],
        })
      )
    ).toBeNull();
  });

  it('builds retry context through the preceding user request without duplicating it', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user' as const,
        content: 'Create a flowchart',
        timestamp: new Date('2026-07-21T06:00:00.000Z'),
      },
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'Created it.',
        timestamp: new Date('2026-07-21T06:00:01.000Z'),
      },
      {
        id: 'user-2',
        role: 'user' as const,
        content: 'Make Done green',
        timestamp: new Date('2026-07-21T06:00:02.000Z'),
      },
      {
        id: 'assistant-failed',
        role: 'assistant' as const,
        content: 'Unable to update the flowchart.',
        error: 'request failed',
        timestamp: new Date('2026-07-21T06:00:03.000Z'),
      },
      {
        id: 'user-after-error',
        role: 'user' as const,
        content: 'This must not be included',
        timestamp: new Date('2026-07-21T06:00:04.000Z'),
      },
    ];

    const retry = buildRetryConversation(messages, 'assistant-failed');

    expect(retry).toEqual(messages.slice(0, 3));
    expect(retry?.filter((message) => message.id === 'user-2')).toHaveLength(1);
    expect(retry?.some((message) => message.id === 'assistant-failed')).toBe(
      false
    );
  });

  it('returns null when the failed assistant id is invalid or has no preceding user', () => {
    const assistantOnly = [
      {
        id: 'assistant-failed',
        role: 'assistant' as const,
        content: 'Failed before a user request',
        error: 'request failed',
        timestamp: new Date('2026-07-21T06:00:00.000Z'),
      },
    ];

    expect(
      buildRetryConversation(assistantOnly, 'missing-assistant')
    ).toBeNull();
    expect(
      buildRetryConversation(assistantOnly, 'assistant-failed')
    ).toBeNull();
  });
});
