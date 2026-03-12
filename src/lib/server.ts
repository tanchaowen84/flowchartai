import 'server-only';

import { cache } from 'react';
import { createSupabaseServerClient } from './supabase';

/**
 * Get the current session via Supabase Auth.
 *
 * Returns the same shape the rest of the app expects:
 *   { user: { id, name, email, image } } | null
 *
 * NOTICE: do not call from middleware — use supabase-middleware.ts instead.
 */
export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        '',
      email: user.email || '',
      image:
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null,
    },
  };
});
