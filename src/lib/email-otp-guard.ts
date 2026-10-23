/**
 * [INPUT] OTP HTTP request, serialized persistent state and Better Auth handler.
 * [OUTPUT] Original authentication response or bounded retry error.
 * [POS] Prevent OTP replay and cross-instance resend/guess races without issuing sessions.
 * [UPDATE] Keep PostgreSQL store, tests and docs/auth/tan-597-build-state.md in sync.
 */
export interface OtpGuardState {
  windowStarted: number;
  lastSend: number | null;
  sends: number;
  attempts: number;
}
export interface OtpGuardAccess {
  read(): Promise<OtpGuardState | null>;
  write(state: OtpGuardState): Promise<void>;
  clearCodes(): Promise<void>;
}
export interface OtpGuardStore {
  withLock(
    email: string,
    action: (access: OtpGuardAccess) => Promise<Response>
  ): Promise<Response>;
}
const WINDOW = 5 * 60 * 1000;
const COOLDOWN = 60 * 1000;

function limited(retryIn: number): Response {
  const seconds = Math.max(1, Math.ceil(retryIn / 1000));
  return Response.json(
    {
      code: 'OTP_RATE_LIMITED',
      message: `Too many requests. Try again in ${seconds} seconds.`,
    },
    { status: 429, headers: { 'Retry-After': String(seconds) } }
  );
}

export async function guardEmailOtp(
  request: Request,
  store: OtpGuardStore,
  run: (request: Request) => Promise<Response>,
  now: () => number = Date.now
): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const send = path === '/api/auth/email-otp/send-verification-otp';
  const verify = path === '/api/auth/sign-in/email-otp';
  if (request.method !== 'POST' || (!send && !verify)) return run(request);
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get('content-type')?.trim() || ''
    )
  ) {
    return Response.json(
      {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Use application/json for email verification.',
      },
      { status: 415 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await request.clone().json();
  } catch {
    return Response.json(
      { code: 'INVALID_REQUEST', message: 'Invalid authentication request.' },
      { status: 400 }
    );
  }
  if (!body || typeof body.email !== 'string') return run(request);
  const email = body.email.trim().toLowerCase();
  if (
    !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ||
    (send && body.type !== 'sign-in')
  )
    return run(request);
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const normalized = new Request(request, {
    headers,
    body: JSON.stringify({ ...body, email }),
  });
  return store.withLock(email, async (access) => {
    const time = now();
    const previous = await access.read();
    const state: OtpGuardState =
      previous && time - previous.windowStarted < WINDOW
        ? previous
        : { windowStarted: time, lastSend: null, sends: 0, attempts: 0 };
    if (send) {
      if (state.lastSend !== null && time - state.lastSend < COOLDOWN)
        return limited(COOLDOWN - (time - state.lastSend));
      if (state.sends >= 3)
        return limited(WINDOW - (time - state.windowStarted));
      state.lastSend = time;
      state.sends++;
      await access.clearCodes();
    } else {
      if (state.attempts >= 5)
        return limited(WINDOW - (time - state.windowStarted));
      state.attempts++;
    }
    await access.write(state);
    let response: Response;
    try {
      response = await run(normalized);
    } catch {
      response = Response.json(
        { message: 'Authentication is unavailable. Please try again.' },
        { status: 500 }
      );
    }
    if ((send && !response.ok) || (verify && response.ok))
      await access.clearCodes();
    return response;
  });
}
