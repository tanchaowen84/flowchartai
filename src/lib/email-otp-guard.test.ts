import { describe, expect, it, vi } from 'vitest';
import { type OtpGuardStore, guardEmailOtp } from './email-otp-guard';

function harness() {
  let state: any = null;
  let chain = Promise.resolve();
  const clear = vi.fn(async () => undefined);
  const store: OtpGuardStore = {
    withLock: async (_email, action) => {
      const prior = chain;
      let release!: () => void;
      chain = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prior;
      try {
        return await action({
          read: async () => state,
          write: async (value) => {
            state = value;
          },
          clearCodes: clear,
        });
      } finally {
        release();
      }
    },
  };
  const request = (path: string, body: object) =>
    new Request(`http://localhost/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const send = () =>
    request('email-otp/send-verification-otp', {
      email: 'QA@Example.com ',
      type: 'sign-in',
    });
  const verify = () =>
    request('sign-in/email-otp', { email: 'qa@example.com', otp: '123456' });
  return { store, clear, send, verify };
}

describe('HTTP email OTP guard', () => {
  it('serializes duplicate sends and normalizes email before authentication', async () => {
    const h = harness();
    const run = vi.fn(async (request: Request) => {
      expect((await request.json()).email).toBe('qa@example.com');
      return Response.json({ success: true });
    });
    const responses = await Promise.all(
      [1, 2].map(() => guardEmailOtp(h.send(), h.store, run, () => 100000))
    );
    expect(responses.map((r) => r.status)).toEqual([200, 429]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(responses[1].headers.get('retry-after')).toBe('60');
  });

  it('invalidates codes on send failure and never changes failure into success', async () => {
    const h = harness();
    const response = await guardEmailOtp(h.send(), h.store, async () =>
      Response.json({ message: 'Failed to send' }, { status: 500 })
    );
    expect(response.status).toBe(500);
    expect(h.clear).toHaveBeenCalledTimes(2);
  });

  it('bounds failed verification attempts and resets after the window', async () => {
    const h = harness();
    const run = vi.fn(async () =>
      Response.json({ message: 'invalid otp' }, { status: 400 })
    );
    for (let i = 0; i < 5; i++)
      expect(
        (await guardEmailOtp(h.verify(), h.store, run, () => 100000)).status
      ).toBe(400);
    expect(
      (await guardEmailOtp(h.verify(), h.store, run, () => 100001)).status
    ).toBe(429);
    expect(run).toHaveBeenCalledTimes(5);
    expect(
      (await guardEmailOtp(h.verify(), h.store, run, () => 400001)).status
    ).toBe(400);
  });

  it('consumes all older codes after successful verification', async () => {
    const h = harness();
    const response = await guardEmailOtp(h.verify(), h.store, async () =>
      Response.json({ user: { id: 'u1' } })
    );
    expect(response.status).toBe(200);
    expect(h.clear).toHaveBeenCalledTimes(1);
  });

  it('does not swallow unrelated auth requests', async () => {
    const h = harness();
    const request = new Request('http://localhost/api/auth/sign-in/social', {
      method: 'POST',
      body: '{}',
    });
    const run = vi.fn(async () => Response.json({ url: '/google' }));
    expect((await guardEmailOtp(request, h.store, run)).status).toBe(200);
    expect(run).toHaveBeenCalledWith(request);
    expect(h.clear).not.toHaveBeenCalled();
  });
});
