'use client';

import { authClient } from '@/lib/auth-client';

export const useCurrentUser = () => {
  const { data: session } = authClient.useSession();

  return session?.user;
};

export const useCurrentUserWithStatus = () => {
  const { data: session, isPending } = authClient.useSession();

  return {
    user: session?.user,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  };
};
