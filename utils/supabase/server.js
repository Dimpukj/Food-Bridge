import { createServerClient } from '@supabase/ssr';

export function createClient(cookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dbogtgvhoonqeuzdpqjw.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_b4fugmtnUk9-O5ZdT0S07g_JedRJt96',
    {
      cookies: {
        getAll() {
          return cookieStore && typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          try {
            if (cookieStore && typeof cookieStore.set === 'function') {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            }
          } catch {
            // Handled for server components
          }
        },
      },
    }
  );
}
