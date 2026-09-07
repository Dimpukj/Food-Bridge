import { createServerClient } from '@supabase/ssr';

export async function updateSession(request, response) {
  let supabaseResponse = response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dbogtgvhoonqeuzdpqjw.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_b4fugmtnUk9-O5ZdT0S07g_JedRJt96',
    {
      cookies: {
        getAll() {
          return request && request.cookies && typeof request.cookies.getAll === 'function' 
            ? request.cookies.getAll() 
            : [];
        },
        setAll(cookiesToSet) {
          if (request && request.cookies && supabaseResponse && supabaseResponse.cookies) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          }
        },
      },
    }
  );

  return supabaseResponse;
}
