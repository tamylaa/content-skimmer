// tests/search/test-search-large-corpus.js
// Large Corpus Performance Test

const fetch = require('node-fetch');
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const CORPUS_SIZES = [1000, 10000, 100000];

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
  for (const size of CORPUS_SIZES) {
    await testCorpusSize(size);
  }
})();
