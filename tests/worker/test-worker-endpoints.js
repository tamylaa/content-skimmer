// test-worker-endpoints.js


import fetch from 'node-fetch';
import crypto from 'crypto';

const WORKER_URL = 'https://content-skimmer.tamylatrading.workers.dev';

// Set your secrets here for local testing
const AUTH_JWT_SECRET = 'd49f3be21dc5ebb3e95e4dfee78f524f8899313ccde1ce362c5df2d33429ad61';
const WEBHOOK_SECRET = '3fde2f444560c2c5860c93a3e52f06c24d546ec46f41231ff501cc382b763c8a';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

function generateWebhookSignature(body, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

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

  // Test webhook (POST with valid signature)
  const webhookBody = JSON.stringify({ fileId: 'test', fileName: 'test.txt' });
  const webhookSignature = generateWebhookSignature(webhookBody, WEBHOOK_SECRET);
  await testEndpoint('/webhook/file-registered', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-256': webhookSignature
    },
    body: webhookBody
  });

  // Test process (POST with valid JWT)
  const jwtPayload = {
    sub: 'test-user',
    exp: Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutes from now
  };
  const jwt = signJWT(jwtPayload, AUTH_JWT_SECRET);
  await testEndpoint('/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ fileId: 'test', fileName: 'test.txt' })
  });
}

main();
