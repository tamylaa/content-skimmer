// tests/integration/test-service-failure.js
// Service Failure and Recovery Test

const fetch = require('node-fetch');
const assert = require('assert');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

async function testServiceFailureRecovery() {
  // Simulate a dependent service failure (e.g., search engine down)
  await fetch(`${WORKER_URL}/admin/simulate-service-down?service=meilisearch`);
  const res = await fetch(`${WORKER_URL}/search?q=service-failure`);
  assert(res.status === 503 || res.status === 500);
  console.log('Service failure handled, status:', res.status);

  // Simulate service recovery
  await fetch(`${WORKER_URL}/admin/simulate-service-up?service=meilisearch`);
  const res2 = await fetch(`${WORKER_URL}/search?q=service-recovery`);
  assert(res2.status === 200);
  console.log('Service recovery handled, status:', res2.status);
}

testServiceFailureRecovery().catch(console.error);
