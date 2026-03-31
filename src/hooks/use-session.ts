'use client';

import { authClient } from '@/lib/auth-client';

export const useSession = () => {
  const { data: session } = authClient.useSession();
  return session;
};
