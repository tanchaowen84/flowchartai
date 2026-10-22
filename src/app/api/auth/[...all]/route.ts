import { auth } from '@/lib/auth'; // path to your auth file
import { guardEmailOtp } from '@/lib/email-otp-guard';
import { emailOtpStore } from '@/lib/email-otp-store';
import { toNextJsHandler } from 'better-auth/next-js';

const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request): Promise<Response> {
  return guardEmailOtp(request, emailOtpStore, handlers.POST);
}
