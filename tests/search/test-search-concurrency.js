// tests/search/test-search-concurrency.js
// Concurrent User Load Test

const fetch = require('node-fetch');
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const CONCURRENT_USERS = [10, 50, 100];

async function runConcurrentSearches(userCount) {
  const promises = [];
  for (let i = 0; i < userCount; i++) {
    promises.push(fetch(`${WORKER_URL}/search?q=concurrency-test-${i}`));
  }
  const results = await Promise.all(promises);
  const statuses = results.map(r => r.status);
  const success = statuses.filter(s => s === 200).length;
  console.log(`Users: ${userCount} | Success: ${success} | Failures: ${userCount - success}`);
}

(async () => {
  for (const users of CONCURRENT_USERS) {
    await runConcurrentSearches(users);
  }
})();
