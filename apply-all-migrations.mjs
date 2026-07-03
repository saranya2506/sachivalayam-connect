import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PROJECT_REF = 'ogmmqtellajvoazuesyq';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// Use the Supabase db/query endpoint (works with service role JWT)
// We need to get a proper access token first via the auth endpoint
const SERVICE_ROLE_KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';

async function runSQL(sql) {
  // Try the pg REST endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'tx=rollback',
    },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, body: await res.text() };
}

// Build combined SQL from all migration files
const migrationsDir = './supabase/migrations';
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && !f.includes('fix_storage'))
  .sort();

let combined = '';
for (const f of files) {
  const content = readFileSync(join(migrationsDir, f), 'utf8');
  combined += `\n-- === ${f} ===\n${content}\n`;
}

// Write the combined SQL to a file so user can paste it
import { writeFileSync } from 'fs';
writeFileSync('./FULL_MIGRATION.sql', combined);
console.log('Combined migration written to FULL_MIGRATION.sql');
console.log('File size:', combined.length, 'chars,', combined.split('\n').length, 'lines');
console.log('\nNow applying via Supabase Management API...');

// Try Supabase db endpoint
const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ query: combined }),
});
console.log('Status:', r.status);
const body = await r.text();
console.log('Response:', body.substring(0, 500));
