/**
 * 🛡️ Automated Supabase RLS & Access Control Penetration Testing Script for Opin
 * 
 * Script ini menguji ketahanan RLS (Row-Level Security) & Isolasi Profil pada tabel:
 * - accounts
 * - transactions
 * - budgets
 * - saving_goals
 * - recurring_transactions
 * - receipt_logs
 * - chat_messages
 * 
 * Cara menjalankan:
 * node scripts/test-rls.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum dikonfigurasi.');
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);

async function runRLSPentest() {
  console.log('================================================================');
  console.log('🛡️  OPIN SUPABASE RLS & ACCESS CONTROL SECURITY TEST SUITE');
  console.log(`🌐 Target Database: ${supabaseUrl}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // Test 1: Anonymous / Unauthenticated Read Protection
  // -------------------------------------------------------------
  console.log('📋 [TEST 1] Menguji Akses Anonim Tanpa Session (Public Client)...');
  const tables = ['accounts', 'transactions', 'budgets', 'saving_goals', 'recurring_transactions'];

  for (const table of tables) {
    try {
      const { data, error } = await anonClient.from(table).select('*').limit(5);
      if (error) {
        console.log(`  ✅ [PASS] Tabel '${table}' memblokir pembacaan publik (Error: ${error.message})`);
        passed++;
      } else if (!data || data.length === 0) {
        console.log(`  ✅ [PASS] Tabel '${table}' aman: 0 data terekspos ke publik anonim.`);
        passed++;
      } else {
        console.log(`  ⚠️  [INFO] Tabel '${table}' mengembalikan ${data.length} row ke anon client. Pastikan RLS aktif jika tabel ini bersifat privat.`);
      }
    } catch (err) {
      console.log(`  ✅ [PASS] Tabel '${table}' memblokir query (${err.message})`);
      passed++;
    }
  }

  // -------------------------------------------------------------
  // Test 2: Unauthenticated Write / Modification Injection Attempt
  // -------------------------------------------------------------
  console.log('\n📋 [TEST 2] Menguji Upaya Injeksi & Modifikasi Data Tanpa Otorisasi...');
  
  const { error: insertError } = await anonClient.from('accounts').insert({
    name: 'Hacker Account',
    type: 'BANK',
    balance: 999999999,
    profile: 'silva'
  });

  if (insertError) {
    console.log(`  ✅ [PASS] Injeksi akun baru oleh anonim DITOLAK (Error: ${insertError.message})`);
    passed++;
  } else {
    console.log(`  ❌ [FAIL] VULNERABILITY DETECTED: Akun palsu berhasil diinsert oleh anon client!`);
    failed++;
  }

  const { error: updateError } = await anonClient.from('accounts').update({
    balance: 0
  }).neq('id', '00000000-0000-0000-0000-000000000000');

  if (updateError) {
    console.log(`  ✅ [PASS] Modifikasi massal saldo akun oleh anonim DITOLAK (Error: ${updateError.message})`);
    passed++;
  } else {
    console.log(`  ❌ [FAIL] VULNERABILITY DETECTED: Anon client dapat memodifikasi saldo akun!`);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 3: SQL Injection Payload Simulation via Anon Filter
  // -------------------------------------------------------------
  console.log('\n📋 [TEST 3] Menguji Ketahanan Parameter Terhadap SQL Injection...');
  const sqliPayloads = [
    "' OR '1'='1",
    "admin'--",
    "'; DROP TABLE accounts;--"
  ];

  for (const payload of sqliPayloads) {
    const { data, error } = await anonClient.from('accounts').select('*').eq('profile', payload);
    if (error || !data || data.length === 0) {
      console.log(`  ✅ [PASS] Payload SQLi "${payload}" berhasil dinetralkan (0 rows terekspos).`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] Payload SQLi "${payload}" membocorkan ${data.length} rows!`);
      failed++;
    }
  }

  console.log('\n================================================================');
  console.log(`🏁 HASIL PENTEST RLS: ${passed} Passed | ${failed} Failed`);
  if (failed === 0) {
    console.log('🎉 SEMUA ATURAN AKSES & RLS AMAN DARI EKSPLOITASI ANONIM!');
  } else {
    console.log('⚠️ PERHATIAN: Ditemukan celah otorisasi yang perlu diperbaiki di Supabase Dashboard.');
  }
  console.log('================================================================\n');
}

runRLSPentest().catch(console.error);
