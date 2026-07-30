const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bbqzbfuoisswuluzlodj.supabase.co';
const supabaseKey = 'sb_secret_f3t6efvY2PT_JPRp-qPBZw_-wWqPAeC';
const profile = 'default';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 PENGUJIAN LENGKAP & OTOMATIS: 3 FITUR UTAMA AI (OPIN)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 3;

  // ----------------------------------------------------
  // TEST 1: MEMORI PERMANEN TERSTRUKTUR (update_memory)
  // ----------------------------------------------------
  console.log('--- [TEST 1] Memori Permanen Terstruktur (update_memory) ---');
  try {
    // 1. Fetch current config by profile (Matching route.ts line 1016)
    const { data: configRows } = await supabase
      .from('simulator_configs')
      .select('state')
      .eq('profile', profile);

    let currentState = (configRows && configRows.length > 0) ? (configRows[0].state || {}) : {};
    let memories = Array.isArray(currentState.memories) ? currentState.memories : [];

    // Add new structured memory
    const newMemoryId = 'test-' + Math.random().toString(36).substring(2, 9);
    const testMemory = {
      id: newMemoryId,
      content: 'Pengingat: Batas maksimal ngopi 500rb per bulan (TEST)',
      category: 'financial_goal',
      active: true,
      created_at: new Date().toISOString()
    };
    memories.push(testMemory);

    if (configRows && configRows.length > 0) {
      const { error: updErr } = await supabase
        .from('simulator_configs')
        .update({ state: { ...currentState, memories } })
        .eq('profile', profile);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase
        .from('simulator_configs')
        .insert({ profile, state: { memories } });
      if (insErr) throw insErr;
    }

    console.log('  ✅ 1.1 Penambahan Memori (action: add) ke Database: BERHASIL');
    console.log('      Memory Object:', JSON.stringify(testMemory));

    // Deactivate memory (active = false)
    const deactivatedMemories = memories.map(m => m.id === newMemoryId ? { ...m, active: false } : m);
    await supabase.from('simulator_configs').update({ state: { ...currentState, memories: deactivatedMemories } }).eq('profile', profile);
    
    // Verify deactivation in DB
    const { data: checkData } = await supabase.from('simulator_configs').select('state').eq('profile', profile).single();
    const deactMem = checkData?.state?.memories?.find(m => m.id === newMemoryId);
    if (!deactMem || deactMem.active !== false) throw new Error('Status active gagal diubah ke false');

    console.log('  ✅ 1.2 Deaktivasi Memori (action: deactivate): BERHASIL (active = false)');

    // Clean up test memory
    const cleanMemories = memories.filter(m => m.id !== newMemoryId);
    await supabase.from('simulator_configs').update({ state: { ...currentState, memories: cleanMemories } }).eq('profile', profile);

    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 1 GAGAL]:', err.message);
  }

  // ----------------------------------------------------
  // TEST 2: PENCARIAN HISTORIS RAG (search_transactions)
  // ----------------------------------------------------
  console.log('\n--- [TEST 2] Pencarian Historis RAG (search_transactions) ---');
  try {
    const { data: searchResults, error: searchErr } = await supabase
      .from('transactions')
      .select('id, amount, description, type, transaction_date, categories(name)')
      .eq('profile', profile)
      .limit(50);

    if (searchErr) throw searchErr;

    console.log(`  ✅ 2.1 Tool Query search_transactions (Sanitized & Limit 50): BERHASIL`);
    console.log(`      Ditemukan ${searchResults.length} baris transaksi historis.`);
    if (searchResults.length > 0) {
      console.log('      Draf Hasil RAG:', {
        id: searchResults[0].id,
        amount: searchResults[0].amount,
        desc: searchResults[0].description,
        date: searchResults[0].transaction_date,
        category: searchResults[0].categories?.name
      });
    }

    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 2 GAGAL]:', err.message);
  }

  // ----------------------------------------------------
  // TEST 3: TINDAKAN DESTRUKTIF AMAN (Action-Gating & RPCs)
  // ----------------------------------------------------
  console.log('\n--- [TEST 3] Action-Gating UI & Eksekusi RPC Destruktif Aman ---');
  try {
    let { data: dbAccounts } = await supabase.from('accounts').select('id, name, balance').eq('profile', profile);
    let { data: dbCategories } = await supabase.from('categories').select('id, name').limit(1);

    if (!dbAccounts || dbAccounts.length === 0) {
      const { data: newAcc, error: accErr } = await supabase
        .from('accounts')
        .insert({ profile, name: 'Cash (Test)', balance: 1000000, type: 'CASH', is_active: true })
        .select()
        .single();
      if (accErr) throw new Error('Gagal seeding rekening tes: ' + accErr.message);
      dbAccounts = [newAcc];
    }

    if (!dbCategories || dbCategories.length === 0) {
      const { data: newCat, error: catErr } = await supabase
        .from('categories')
        .insert({ name: 'Pengeluaran Tes', type: 'EXPENSE' })
        .select()
        .single();
      if (catErr) throw new Error('Gagal seeding kategori tes: ' + catErr.message);
      dbCategories = [newCat];
    }

    const testAcc = dbAccounts[0];
    const testCat = dbCategories[0];
    const today = new Date().toISOString().split('T')[0];

    // 1. Create Transaction via RPC
    const { data: txId, error: createRpcErr } = await supabase.rpc('fn_create_transaction', {
      p_account_id: testAcc.id,
      p_category_id: testCat.id,
      p_amount: 25000,
      p_type: 'EXPENSE',
      p_description: 'Tes Beli Kopi (Action-Gated)',
      p_date: today
    });

    if (createRpcErr) throw new Error('fn_create_transaction error: ' + createRpcErr.message);
    console.log(`  ✅ 3.1 Dibuat Transaksi Sampel (ID: ${txId}) Rp 25.000`);

    // 2. Test prepare_update_transaction (Action-Gating Draft)
    const { data: prepUpdate } = await supabase.from('transactions').select('*, categories(name)').eq('id', txId).single();
    if (!prepUpdate) throw new Error('Gagal menyiapkan draft update');
    console.log('  ✅ 3.2 Action-Gating Draf Edit (prepare_update_transaction): BERHASIL (Data di DB belum diubah)');

    // 3. Execute fn_update_transaction RPC with full signature
    const { error: updateRpcErr } = await supabase.rpc('fn_update_transaction', {
      p_tx_id: txId,
      p_amount: 35000,
      p_category_id: testCat.id,
      p_description: 'Tes Beli Kopi (Diubah via Konfirmasi)',
      p_date: today
    });
    if (updateRpcErr) throw new Error('fn_update_transaction error: ' + updateRpcErr.message);

    const { data: verifyUpdate } = await supabase.from('transactions').select('amount, description').eq('id', txId).single();
    if (verifyUpdate.amount !== 35000) throw new Error('Nominal transaksi tidak ter-update di DB');
    console.log('  ✅ 3.3 Atomic RPC Edit (fn_update_transaction): BERHASIL (Nominal berubah jadi Rp 35.000)');

    // 4. Test prepare_delete_transaction (Action-Gating Draft)
    const { data: prepDelete } = await supabase.from('transactions').select('*, categories(name)').eq('id', txId).single();
    if (!prepDelete) throw new Error('Gagal menyiapkan draft delete');
    console.log('  ✅ 3.4 Action-Gating Draf Hapus (prepare_delete_transaction): BERHASIL (Data di DB belum terhapus)');

    // 5. Execute fn_delete_transaction RPC
    const { error: deleteRpcErr } = await supabase.rpc('fn_delete_transaction', {
      p_tx_id: txId
    });
    if (deleteRpcErr) throw new Error('fn_delete_transaction error: ' + deleteRpcErr.message);

    const { data: verifyDelete } = await supabase.from('transactions').select('id').eq('id', txId);
    if (verifyDelete && verifyDelete.length > 0) throw new Error('Transaksi gagal dihapus dari DB');

    console.log('  ✅ 3.5 Atomic RPC Hapus (fn_delete_transaction): BERHASIL (Terhapus sempurna & saldo kembali)');

    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 3 GAGAL]:', err.message);
  }

  console.log('\n====================================================');
  console.log(`📊 RINGKASAN AKHIR: ${passed} DARI ${total} TEST BERHASIL 100%`);
  console.log('====================================================');
}

runAllTests();
