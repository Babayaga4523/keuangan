const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbqzbfuoisswuluzlodj.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function checkDatabase() {
  console.log('Connecting to Supabase:', url);
  console.log('Using Key:', key ? `${key.substring(0, 15)}...` : 'NONE');

  const { data: accounts, error: err1 } = await supabase.from('accounts').select('*');
  console.log('Accounts Error:', err1);
  console.log('Accounts Data:', accounts);

  const { data: transactions, error: err2 } = await supabase.from('transactions').select('*');
  console.log('Transactions Error:', err2);
  console.log('Transactions Data:', transactions);
}

checkDatabase();
