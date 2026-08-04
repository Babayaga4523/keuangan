const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const reqOpts = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', (err) => reject(err));

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runFullTestSuite() {
  console.log('====================================================');
  console.log('🚀 TESTING ALL APPLICATION PAGES & API ENDPOINTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const pages = [
    '/dashboard',
    '/transaksi',
    '/budget',
    '/recurring',
    '/tabungan',
    '/parameter',
    '/laporan',
    '/simulator',
    '/ai-advisor'
  ];

  console.log('--- 1. TESTING APP PAGES (SSR/HTML) ---');
  for (const pagePath of pages) {
    const start = Date.now();
    try {
      const res = await makeRequest(pagePath);
      const duration = Date.now() - start;
      if (res.statusCode === 200) {
        console.log(`  ✅ [200 OK] ${pagePath.padEnd(20)} (${duration}ms)`);
        passed++;
      } else {
        console.log(`  ❌ [${res.statusCode}] ${pagePath.padEnd(20)} (${duration}ms)`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ [ERROR] ${pagePath.padEnd(20)}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n--- 2. TESTING API ENDPOINTS ---');

  const apiTests = [
    { name: 'GET /api/accounts', path: '/api/accounts', method: 'GET' },
    { name: 'GET /api/insights', path: '/api/insights', method: 'GET' },
    { name: 'GET /api/roadmap', path: '/api/roadmap', method: 'GET' },
    { name: 'GET /api/chat/history (sessions)', path: '/api/chat/history?listSessions=true', method: 'GET' },
    { name: 'GET /api/chat/history (messages)', path: '/api/chat/history?sessionId=default', method: 'GET' },
    { 
      name: 'POST /api/ai-advisor/recommendation (savings)', 
      path: '/api/ai-advisor/recommendation?type=savings', 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { 
      name: 'POST /api/ai-advisor/recommendation (simulator)', 
      path: '/api/ai-advisor/recommendation?type=simulator', 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dreamName: 'iPhone 15 Pro',
        dreamCost: 12850000,
        startBalance: 5000000,
        targetMonth: 8,
        targetYear: 2026,
        incomes: [{ amount: 6000000 }],
        expenses: [{ amount: 3000000 }],
        oneOffs: [],
        timeline: [{ monthName: 'Agustus 2026', finalBalance: 1500000, statusText: 'Aman' }]
      })
    },
    {
      name: 'POST /api/chat (Stream Text)',
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Halo Opin, berapa saldo akun saya?' }],
        sessionId: 'default'
      })
    }
  ];

  for (const test of apiTests) {
    const start = Date.now();
    try {
      const res = await makeRequest(test.path, {
        method: test.method,
        headers: test.headers,
        body: test.body
      });
      const duration = Date.now() - start;
      if (res.statusCode === 200) {
        let snippet = res.body.substring(0, 80).replace(/\n/g, ' ');
        console.log(`  ✅ [200 OK] ${test.name.padEnd(45)} (${duration}ms)`);
        console.log(`     └─ Preview: ${snippet}...`);
        passed++;
      } else {
        console.log(`  ❌ [${res.statusCode}] ${test.name.padEnd(45)} (${duration}ms)`);
        console.log(`     └─ Error Body: ${res.body.substring(0, 150)}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ [ERROR] ${test.name.padEnd(45)}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullTestSuite();
