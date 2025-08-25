// tests/integration/test-circuit-breaker.js
// Error and Circuit Breaker Scenario Test

const fetch = require('node-fetch');
const assert = require('assert');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

async function testCircuitBreaker() {
  // Simulate repeated failures to trigger circuit breaker
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${WORKER_URL}/search?q=fail-circuit`);
    console.log(`Attempt ${i+1}: Status ${res.status}`);
  }
  // Check circuit breaker state (assumes endpoint or log output)
  const statusRes = await fetch(`${WORKER_URL}/admin/circuit-breaker-status`);
  const status = await statusRes.json();
  assert(status.state === 'OPEN' || status.state === 'HALF_OPEN');
  console.log('Circuit breaker state:', status.state);
}

testCircuitBreaker().catch(console.error);
