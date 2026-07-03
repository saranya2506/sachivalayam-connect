import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ogmmqtellajvoazuesyq.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_HafmoqI3nNSWoaqbGwqdeQ_PMxgnj_R';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Insert RLS policies directly into pg_catalog via supabase admin
// Use the storage API to set bucket policies
async function setBucketPolicy(bucketId, policy) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucketId}/policy`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(policy),
  });
  return { status: res.status, body: await res.text() };
}

// Check bucket exists
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Buckets:', buckets?.map(b => b.name).join(', '));

// For RLS policies we need to insert into the policies table directly
// Since we can't run raw SQL via REST, insert via the supabase_admin schema
const policies = [
  // complaint-photos: citizen can upload to own folder
  {
    name: 'complaint-photos: citizen upload',
    bucket_id: 'complaint-photos',
    definition: `(bucket_id = 'complaint-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)`,
    operation: 'INSERT',
  },
  {
    name: 'complaint-photos: citizen read',
    bucket_id: 'complaint-photos', 
    definition: `(bucket_id = 'complaint-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)`,
    operation: 'SELECT',
  },
  {
    name: 'service-docs: citizen',
    bucket_id: 'service-documents',
    definition: `(bucket_id = 'service-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)`,
    operation: 'ALL',
  },
];

console.log('\nInserting storage policies...');
for (const p of policies) {
  // Try inserting directly into storage.policies
  const { error } = await supabase
    .from('storage.policies')
    .insert({
      name: p.name,
      bucket_id: p.bucket_id,
      definition: p.definition,
      operation: p.operation,
    })
    .catch(e => ({ error: e }));
  console.log(p.name + ':', error?.message || 'OK');
}

console.log('\nDone!');
console.log('\nOnly one SQL statement still needs to be run manually in Supabase SQL Editor:');
console.log(`
DROP POLICY IF EXISTS "Timeline inserts" ON public.complaint_timeline;
CREATE POLICY "Timeline inserts" ON public.complaint_timeline 
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.complaints c WHERE c.id=complaint_id AND c.citizen_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id=complaint_id AND c.assigned_officer_id=auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'government_authority'::app_role)
);
`);
