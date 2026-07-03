import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ogmmqtellajvoazuesyq.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';

// Check tables via direct REST (bypasses schema cache)
async function checkTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Accept': 'application/json',
    },
  });
  const text = await res.text();
  return { status: res.status, ok: res.status < 400, body: text.substring(0, 150) };
}

console.log('Checking tables via direct REST...\n');
const tables = ['user_roles', 'complaints', 'service_applications', 'profiles', 'complaint_timeline', 'notifications'];
for (const t of tables) {
  const r = await checkTable(t);
  console.log(`${r.ok ? '✓' : '✗'} ${t}: HTTP ${r.status} ${r.ok ? '' : '→ ' + r.body}`);
}

// Check if migrations have been applied via pg_tables
const pgRes = await fetch(`${SUPABASE_URL}/rest/v1/pg_tables?schemaname=eq.public&select=tablename`, {
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
});
console.log('\npg_tables check:', pgRes.status, await pgRes.text().then(t => t.substring(0, 300)));
