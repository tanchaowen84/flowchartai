import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: fixture.send };
  },
}));
vi.mock('@/mail', () => ({ getTemplate: vi.fn() }));
import { ResendProvider } from './resend';
describe('Resend acceptance receipt', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'isolated-test-key';
    fixture.send.mockReset();
  });
  const send = () =>
    new ResendProvider().sendRawEmail({
      to: 'fixture@example.invalid',
      subject: 'Fixture',
      html: '<p>Fixture</p>',
      text: 'Fixture',
    });
  it('requires an actual message ID before reporting API acceptance', async () => {
    fixture.send.mockResolvedValue({ data: {}, error: null });
    expect((await send()).success).toBe(false);
    fixture.send.mockResolvedValue({
      data: { id: 'test-message' },
      error: null,
    });
    expect(await send()).toEqual({ success: true, messageId: 'test-message' });
  });
  it('preserves provider failure', async () => {
    fixture.send.mockResolvedValue({
      error: { name: 'validation_error', message: 'API key is invalid' },
    });
    expect((await send()).success).toBe(false);
    fixture.send.mockRejectedValue(new Error('Transport unavailable'));
    expect((await send()).success).toBe(false);
  });
});
