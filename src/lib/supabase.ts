import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Lazy-initialized Supabase client — works in both server and browser contexts.
 * Safe to import at module level (won't throw during build if env vars are absent).
 */
let _supabase: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

/**
 * Legacy export — use `getSupabase()` for new code.
 * Kept for backward compatibility with files importing `supabase` directly.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});

/**
 * Browser client — use in 'use client' components for SSR-aware auth.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Server client — use in Server Components, Route Handlers, Server Actions.
 * Each call creates a fresh client bound to the current request's cookies.
 */
export async function createSupabaseServerClient() {
  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Ignored when called from a Server Component (read-only cookies).
          // The middleware will handle refreshing the session.
        }
      },
    },
  });
}

/**
 * Admin client — bypasses RLS. Use only on the server for privileged operations.
 */
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseServiceRoleKey) return null;
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  }
  return _supabaseAdmin;
}

/** Legacy export */
export const supabaseAdmin = supabaseServiceRoleKey
  ? new Proxy({} as SupabaseClient, {
      get(_target, prop, receiver) {
        return Reflect.get(getSupabaseAdmin()!, prop, receiver);
      },
    })
  : null;
