const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbqzbfuoisswuluzlodj.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function run() {
  console.log('--- DATA BY PROFILE ---');
  
  const { data: accounts } = await supabase.from('accounts').select('id, name, profile, balance, is_active');
  console.log('\nACCOUNTS:');
  (accounts || []).forEach(a => {
    console.log(`  Profile: [${a.profile}] | Name: ${a.name} | Balance: ${a.balance} | Active: ${a.is_active}`);
  });

  const { data: transactions } = await supabase.from('transactions').select('profile, amount, type, description').limit(20);
  console.log('\nTRANSACTIONS SAMPLE:');
  const txProfiles = {};
  (transactions || []).forEach(t => {
    txProfiles[t.profile] = (txProfiles[t.profile] || 0) + 1;
  });
  console.log('Transaction counts by profile in sample:', txProfiles);

  const { data: savingGoals } = await supabase.from('saving_goals').select('id, name, profile, target_amount, current_amount');
  console.log('\nSAVING GOALS:');
  (savingGoals || []).forEach(g => {
    console.log(`  Profile: [${g.profile}] | Name: ${g.name} | Progress: ${g.current_amount}/${g.target_amount}`);
  });
}

run();
