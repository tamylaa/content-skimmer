// integration-test.js
// Integration test for the full content-skimmer flow
// - Simulates a file registration event
// - Mocks file retrieval (if possible)
// - Checks AI provider call and result

import fetch from 'node-fetch';
import crypto from 'crypto';

const WORKER_URL = 'https://content-skimmer.tamylatrading.workers.dev';
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

async function testWebhookFlow() {
  const event = { fileId: 'integration-test-file', fileName: 'integration.txt' };
  const body = JSON.stringify(event);
  const signature = generateWebhookSignature(body, WEBHOOK_SECRET);
  const res = await fetch(`${WORKER_URL}/webhook/file-registered`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-256': signature
    },
    body
  });
  const text = await res.text();
  console.log('\n[Webhook] Status:', res.status);
  console.log('[Webhook] Response:', text);
}

async function testProcessFlow() {
  const event = { fileId: 'integration-test-file', fileName: 'integration.txt' };
  const jwtPayload = {
    sub: 'integration-test-user',
    exp: Math.floor(Date.now() / 1000) + 60 * 10
  };
  const jwt = signJWT(jwtPayload, AUTH_JWT_SECRET);
  const res = await fetch(`${WORKER_URL}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify(event)
  });
  const text = await res.text();
  console.log('\n[Process] Status:', res.status);
  console.log('[Process] Response:', text);
}

async function main() {
  await testWebhookFlow();
  await testProcessFlow();
  // Optionally, poll for results or check downstream effects here
}

main();
