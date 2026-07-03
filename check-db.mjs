import { createClient } from '@supabase/supabase-js';

const URL = 'https://ogmmqtellajvoazuesyq.supabase.co';
const KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';

async function check(table) {
  const r = await fetch(`${URL}/rest/v1/${table}?limit=0`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
  });
  return { table, exists: r.status < 400, status: r.status, msg: await r.text().then(t => t.substring(0, 100)) };
}

const tables = [
  'profiles', 'user_roles', 'admin_registrations', 'officers', 
  'complaints', 'complaint_timeline', 'notifications', 'audit_logs',
  'service_applications', 'service_app_documents', 'service_app_timeline',
  'system_state'
];

console.log('Checking database tables...\n');
const results = await Promise.all(tables.map(check));

const exists = results.filter(r => r.exists);
const missing = results.filter(r => !r.exists);

console.log('✓ EXISTS:', exists.map(r => r.table).join(', ') || 'none');
console.log('\n✗ MISSING:', missing.map(r => r.table).join(', ') || 'none');

// Check storage buckets
const db = createClient(URL, KEY);
const { data: buckets } = await db.storage.listBuckets();
console.log('\nStorage buckets:', buckets?.map(b => b.name).join(', ') || 'none');

// Check enums
console.log('\nChecking enums via REST...');
const enumCheck = await fetch(`${URL}/rest/v1/`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Accept': 'application/json' }
});
console.log('REST API accessible:', enumCheck.status < 400);

console.log('\n' + '='.repeat(60));
if (missing.length === 0) {
  console.log('✓ ALL TABLES EXIST - Database is ready!');
} else {
  console.log(`✗ ${missing.length} tables missing - need SQL migration`);
}
console.log('='.repeat(60));
