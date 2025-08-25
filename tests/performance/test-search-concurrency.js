import '../../tests/testSetup.js';
import fetch from 'node-fetch';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const CONCURRENT_USERS = [10, 50, 100];

async function isWorkerReachable() {
  try {
    const res = await fetch(`${WORKER_URL}/health`, { timeout: 2000 });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function runConcurrentSearches(userCount) {
  const promises = [];
  for (let i = 0; i < userCount; i++) {
    promises.push(fetch(`${WORKER_URL}/search?q=concurrency-test-${i}`));
  }
  const results = await Promise.allSettled(promises);
  const success = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
  const failures = userCount - success;
  console.log(`Users: ${userCount} | Success: ${success} | Failures: ${failures}`);
}

(async () => {
  if (!(await isWorkerReachable())) {
    console.warn(`Worker at ${WORKER_URL} is not reachable. Skipping concurrency test.`);
    return;
  }
  for (const users of CONCURRENT_USERS) {
    await runConcurrentSearches(users);
  }
})();
