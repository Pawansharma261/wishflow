import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://llqmetaphnxyjtxzdegd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscW1ldGFwaG54eWp0eHpkZWdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxMDQ0MywiZXhwIjoyMDg5Mjg2NDQzfQ.DsBryHiIO0z0Ukt9KQ1zQ5KqTkegxqR98kGUS-wDn74'
);

async function checkSchema() {
  const { data: wishesData, error: wishesError } = await supabaseAdmin.from('wishes').select('*').limit(1);
  console.log('wishes columns sample:', wishesData && wishesData.length > 0 ? Object.keys(wishesData[0]) : 'Empty data');

  const { data: contactsData, error: contactsError } = await supabaseAdmin.from('contacts').select('*').limit(1);
  console.log('contacts columns sample:', contactsData && contactsData.length > 0 ? Object.keys(contactsData[0]) : 'Empty data');
}

checkSchema();
