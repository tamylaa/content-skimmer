import '../../tests/testSetup.js';
import fetch from 'node-fetch';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const CORPUS_SIZES = [1000, 10000, 100000];

async function isWorkerReachable() {
  try {
    const res = await fetch(`${WORKER_URL}/health`, { timeout: 2000 });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function testCorpusSize(size) {
  // This assumes an endpoint to bulk load or simulate a corpus
  const res = await fetch(`${WORKER_URL}/admin/load-corpus?size=${size}`);
  if (res.status !== 200) {
    console.error(`Failed to load corpus of size ${size}`);
    return;
  }
  const t0 = Date.now();
  const searchRes = await fetch(`${WORKER_URL}/search?q=corpus-test`);
  const t1 = Date.now();
  console.log(`Corpus: ${size} | Search Time: ${t1-t0}ms | Status: ${searchRes.status}`);
}

(async () => {
  if (!(await isWorkerReachable())) {
    console.warn(`Worker at ${WORKER_URL} is not reachable. Skipping large corpus test.`);
    return;
  }
  for (const size of CORPUS_SIZES) {
    await testCorpusSize(size);
  }
})();
