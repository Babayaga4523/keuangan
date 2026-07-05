(global as any).WebSocket = class {};

import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://bbqzbfuoisswuluzlodj.supabase.co', 'sb_secret_f3t6efvY2PT_JPRp-qPBZw_-wWqPAeC');

async function run() {
  const { data: recList, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('profile', 'yoga');
    
  if (error) {
    console.error(error);
  } else {
    console.log('Recurring Transactions:', recList);
  }
}

run();
