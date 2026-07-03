import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ogmmqtellajvoazuesyq.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Each statement runs separately
const steps = [
  {
    name: 'Create complaint-photos bucket',
    fn: () => db.from('storage.buckets').upsert({ id: 'complaint-photos', name: 'complaint-photos', public: false }, { onConflict: 'id' }),
  },
];

// Use the undocumented /query endpoint that works with service role
async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  return res;
}

// Direct pg connection via Supabase's internal endpoint
async function execSQL(query) {
  const url = `${SUPABASE_URL}/pg/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

const r = await execSQL('SELECT 1 as test');
console.log('Test query result:', r);
