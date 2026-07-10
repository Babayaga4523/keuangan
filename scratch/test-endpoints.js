const http = require('http');

const request = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
};

async function runTests() {
  console.log("=== RUNNING API ENDPOINT TESTS ===");
  
  // Test 1: GET /api/cron/bill-reminder without auth -> Expect 401
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/cron/bill-reminder',
      method: 'GET'
    });
    console.log(`Test 1 (No Auth): Status Code = ${res.statusCode} (Expected: 401)`);
    console.log(`Data: ${res.data}`);
  } catch (err) {
    console.error("Test 1 Failed:", err.message);
  }

  // Test 2: GET /api/cron/bill-reminder with WRONG auth -> Expect 401
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/cron/bill-reminder',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer wrong_token'
      }
    });
    console.log(`Test 2 (Wrong Auth): Status Code = ${res.statusCode} (Expected: 401)`);
  } catch (err) {
    console.error("Test 2 Failed:", err.message);
  }

  // Test 3: GET /api/cron/bill-reminder with CORRECT auth -> Expect 200
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/cron/bill-reminder',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer amanah_cron_secret_key_987654321_token'
      }
    });
    console.log(`Test 3 (Correct Auth): Status Code = ${res.statusCode} (Expected: 200)`);
    console.log(`Response: ${res.data}`);
  } catch (err) {
    console.error("Test 3 Failed:", err.message);
  }

  // Test 4: POST /api/bills/mark-paid without body -> Expect 400
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bills/mark-paid',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {});
    console.log(`Test 4 (POST mark-paid missing body): Status Code = ${res.statusCode} (Expected: 400)`);
    console.log(`Response: ${res.data}`);
  } catch (err) {
    console.error("Test 4 Failed:", err.message);
  }
}

runTests();
