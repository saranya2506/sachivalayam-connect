import { createClient } from '@supabase/supabase-js';

const URL = 'https://ogmmqtellajvoazuesyq.supabase.co';
const KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';
const db = createClient(URL, KEY, { auth: { persistSession: false } });

console.log('Checking all users and their roles...\n');

// Get all users
const { data: { users } } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });

for (const u of users) {
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', u.id);
  const { data: profile } = await db.from('profiles').select('full_name, active_status').eq('id', u.id).maybeSingle();
  const intended = u.user_metadata?.intended_role || 'citizen';
  console.log(`User: ${u.email}`);
  console.log(`  Name: ${profile?.full_name || 'N/A'}`);
  console.log(`  Intended role: ${intended}`);
  console.log(`  Current roles: ${roles?.map(r => r.role).join(', ') || 'NONE'}`);
  console.log(`  Active: ${profile?.active_status}`);

  // Fix: if intended_role is government_authority or admin/officer but has wrong role
  if (intended === 'government_authority') {
    // Remove citizen role, add government_authority
    await db.from('user_roles').delete().eq('user_id', u.id).eq('role', 'citizen');
    const { error } = await db.from('user_roles').upsert({ user_id: u.id, role: 'government_authority' }, { onConflict: 'user_id,role' });
    await db.from('profiles').update({ active_status: true }).eq('id', u.id);
    console.log(`  ✓ Fixed → government_authority ${error ? '(error: ' + error.message + ')' : ''}`);
  }
  console.log('');
}

console.log('Done!');
