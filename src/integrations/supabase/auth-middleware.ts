import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
      ];
      throw new Error(`Missing Supabase environment variable(s): ${missing.join(', ')}.`);
    }

    const request = getRequest();
    if (!request?.headers) throw new Error('Unauthorized: No request headers available');

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized: No Bearer token provided');

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) throw new Error('Unauthorized: Empty token');

    // Create a Supabase client that uses the user's JWT for all requests (respects RLS)
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    // Validate the token and extract the user (works with all Supabase JS versions)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Unauthorized: Invalid or expired token');

    return next({
      context: {
        supabase,
        userId: user.id,
        claims: { sub: user.id, email: user.email, ...user.user_metadata },
      },
    });
  },
);
