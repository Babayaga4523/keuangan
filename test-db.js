const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbqzbfuoisswuluzlodj.supabase.co', 'sb_secret_f3t6efvY2PT_JPRp-qPBZw_-wWqPAeC');

async function run() {
  const { data, error } = await supabase.from('accounts').select('*').eq('is_active', true);
  console.log(data);
}
run();
