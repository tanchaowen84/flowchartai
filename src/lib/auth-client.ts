'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabase = createSupabaseBrowserClient();

// ---------------------------------------------------------------------------
// Types matching the shape consumers expect from the old Better Auth client
// ---------------------------------------------------------------------------
interface AppUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role?: string | null;
}

interface SessionData {
  user: AppUser;
}

function mapUser(user: User): AppUser {
  return {
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
    role: user.user_metadata?.role || null,
  };
}

// ---------------------------------------------------------------------------
// useSession hook — drop-in replacement for authClient.useSession()
// ---------------------------------------------------------------------------
function useSession(): { data: SessionData | null; isPending: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsPending(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setIsPending(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const data: SessionData | null = session?.user
    ? { user: mapUser(session.user) }
    : null;

  return { data, isPending };
}

// ---------------------------------------------------------------------------
// signIn.social — drop-in replacement for authClient.signIn.social()
// ---------------------------------------------------------------------------
async function signInSocial({
  provider,
  callbackURL,
}: {
  provider: 'google' | 'github';
  callbackURL?: string;
}) {
  const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(callbackURL || '/dashboard')}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  if (error) {
    return { error: { message: error.message } };
  }
  return {};
}

// ---------------------------------------------------------------------------
// signOut — drop-in replacement for authClient.signOut()
// ---------------------------------------------------------------------------
async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

// ---------------------------------------------------------------------------
// $store.atoms.session — synchronous session access for utils.ts
// ---------------------------------------------------------------------------
let _cachedSession: Session | null = null;

// Bootstrap once
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data: { session: s } }) => {
    _cachedSession = s;
  });
  supabase.auth.onAuthStateChange((_event, s) => {
    _cachedSession = s;
  });
}

const $store = {
  atoms: {
    session: {
      get(): SessionData | null {
        if (!_cachedSession?.user) return null;
        return { user: mapUser(_cachedSession.user) };
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Exported client — same shape as the old Better Auth authClient
// ---------------------------------------------------------------------------
export const authClient = {
  useSession,
  signIn: {
    social: signInSocial,
  },
  signOut,
  $store,
};
