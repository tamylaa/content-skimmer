// test-worker-endpoints.js

import fetch from 'node-fetch';

const WORKER_URL = 'https://content-skimmer.tamylatrading.workers.dev';

async function testEndpoint(path, options = {}) {
  const url = `${WORKER_URL}${path}`;
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    console.log(`\n[${options.method || 'GET'}] ${url}`);
    console.log(`Status: ${res.status}`);
    console.log('Response:', text);
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
  }
}

async function main() {
  // Test root
  await testEndpoint('/');

  // Test health
  await testEndpoint('/health');

  // Test webhook (simulate POST, expect 401 or 400)
  await testEndpoint('/webhook/file-registered', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: 'test', fileName: 'test.txt' })
  });

  // Test process (simulate POST, expect 401)
  await testEndpoint('/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: 'test', fileName: 'test.txt' })
  });
}

main();
