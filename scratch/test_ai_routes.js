const fs = require('fs');

async function testRoutes() {
  console.log('--- STARTING AI ENDPOINT TESTS ---');

  // Read API Key from .env.local
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const keyMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/);
  const apiKey = keyMatch ? keyMatch[1].trim() : '';

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in .env.local!');
    return;
  }
  console.log('✅ OPENROUTER_API_KEY loaded:', apiKey.substring(0, 15) + '...');

  // Test 1: Direct OpenRouter test with openai/gpt-oss-20b:free
  console.log('\n[Test 1] Testing direct connection to OpenRouter (openai/gpt-oss-20b:free)...');
  try {
    const res1 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b:free',
        messages: [{ role: 'user', content: 'Halo Opin, tes respons singkat 5 kata.' }]
      })
    });
    console.log('Status Code:', res1.status);
    const data1 = await res1.json();
    if (res1.ok) {
      console.log('✅ OpenRouter Response:', data1.choices?.[0]?.message?.content);
    } else {
      console.error('❌ OpenRouter Error:', data1.error);
    }
  } catch (err) {
    console.error('❌ OpenRouter Fetch Exception:', err.message);
  }

  // Test 2: Test Local Dev Server /api/chat route
  console.log('\n[Test 2] Testing Local Dev Server endpoint (http://localhost:3000/api/chat)...');
  try {
    const res2 = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'test_session',
        messages: [{ role: 'user', content: 'Berapa total saldo saya saat ini?' }]
      })
    });
    console.log('Status Code:', res2.status);
    if (res2.ok) {
      const text2 = await res2.text();
      console.log('✅ /api/chat Stream Chunk Preview:', text2.substring(0, 250));
    } else {
      const errText = await res2.text();
      console.error('❌ /api/chat Error Output:', errText);
    }
  } catch (err) {
    console.error('❌ /api/chat Exception:', err.message);
  }

  // Test 3: Test Local Dev Server /api/ai-advisor/recommendation route
  console.log('\n[Test 3] Testing Local Dev Server endpoint (http://localhost:3000/api/ai-advisor/recommendation)...');
  try {
    const res3 = await fetch('http://localhost:3000/api/ai-advisor/recommendation?type=savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Status Code:', res3.status);
    const data3 = await res3.json();
    if (res3.ok) {
      console.log('✅ /api/ai-advisor/recommendation Response:', data3.recommendation);
    } else {
      console.error('❌ /api/ai-advisor/recommendation Error:', data3);
    }
  } catch (err) {
    console.error('❌ /api/ai-advisor/recommendation Exception:', err.message);
  }

  console.log('\n--- TESTS COMPLETED ---');
}

testRoutes();
