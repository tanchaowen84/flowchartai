'use client';

import { LoginForm } from './login-form';

/** Shared verified-email entry for new and existing accounts. */
export function RegisterForm({
  callbackUrl,
}: { callbackUrl?: string }): React.ReactElement {
  return <LoginForm callbackUrl={callbackUrl} intent="register" />;
}
