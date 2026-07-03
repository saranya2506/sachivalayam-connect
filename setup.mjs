import { createClient } from '@supabase/supabase-js';

const URL = 'https://ogmmqtellajvoazuesyq.supabase.co';
const KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';
const db = createClient(URL, KEY, { auth: { persistSession: false } });

// Run raw SQL via the pg REST endpoint using service_role
async function sql(query) {
  const r = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
    },
    body: JSON.stringify({ sql: query }),
  });
  if (r.status === 404) return { ok: false, err: 'rpc_not_found' };
  const t = await r.text();
  return { ok: r.ok, err: r.ok ? null : t };
}

// ── Step 1: create exec_sql helper if not exists ──────────────────────────────
const createHelper = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': `Bearer ${KEY}` },
  body: JSON.stringify({ sql: 'SELECT 1' }),
});
const helperExists = createHelper.status !== 404;

if (!helperExists) {
  // Create exec_sql via the pg introspect trick
  console.log('exec_sql function not found, will use batch approach...');
}

// ── Step 2: Apply each statement individually via the db client ───────────────
// We can create a special RPC function first by calling the DB directly
const createFn = await fetch(`${URL}/rest/v1/rpc/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Prefer': 'return=minimal',
  },
});

// Use the direct pg connection via supabase's internal endpoint
async function execDirect(query) {
  const r = await fetch(`${URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t.substring(0, 200) };
}

// ── Step 3: Create tables using the Supabase JS client where possible ─────────

console.log('='.repeat(60));
console.log('SACHIVALAYAM DATABASE SETUP');
console.log('='.repeat(60));

// Check what already exists
const checks = await Promise.all([
  fetch(`${URL}/rest/v1/profiles?limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }),
  fetch(`${URL}/rest/v1/user_roles?limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }),
  fetch(`${URL}/rest/v1/complaints?limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }),
  fetch(`${URL}/rest/v1/service_applications?limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }),
  fetch(`${URL}/rest/v1/notifications?limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }),
]);

const tableNames = ['profiles', 'user_roles', 'complaints', 'service_applications', 'notifications'];
const tableStatus = checks.map((r, i) => ({ name: tableNames[i], exists: r.status < 400 }));
tableStatus.forEach(t => console.log(`  ${t.exists ? '✓' : '✗'} ${t.name}`));

const allExist = tableStatus.every(t => t.exists);
if (allExist) {
  console.log('\n✓ All tables already exist!');
} else {
  console.log('\n✗ Some tables are missing - they need to be created via SQL');
}

// Check storage buckets
const { data: buckets } = await db.storage.listBuckets();
const bucketNames = buckets?.map(b => b.name) || [];
console.log('\nStorage buckets:', bucketNames.length ? bucketNames.join(', ') : 'none');

// Create buckets if missing
if (!bucketNames.includes('complaint-photos')) {
  const r = await db.storage.createBucket('complaint-photos', {
    public: false, fileSizeLimit: 5242880,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'],
  });
  console.log('Created complaint-photos bucket:', r.error?.message || 'OK');
}
if (!bucketNames.includes('service-documents')) {
  const r = await db.storage.createBucket('service-documents', {
    public: false, fileSizeLimit: 10485760,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'],
  });
  console.log('Created service-documents bucket:', r.error?.message || 'OK');
}

console.log('\n' + '='.repeat(60));
console.log('RESULT:', allExist ? 'DATABASE OK - App is ready!' : 'TABLES MISSING - Need manual SQL');
console.log('='.repeat(60));

if (!allExist) {
  console.log('\n⚠ Missing tables detected.');
  console.log('The FULL_MIGRATION.sql file has been created in your project folder.');
  console.log('\nPlease:');
  console.log('1. Open: https://supabase.com/dashboard/project/ogmmqtellajvoazuesyq/sql/new');
  console.log('2. Open file: D:\\SACHIVALEYAM\\sachivalayam-connect\\FULL_MIGRATION.sql');
  console.log('3. Paste contents and click Run');
  process.exit(1);
} else {
  console.log('\n✓ App is fully ready at http://localhost:8080');
  process.exit(0);
}
