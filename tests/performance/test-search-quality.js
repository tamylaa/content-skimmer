import '../../tests/testSetup.js';
import assert from 'assert';
import fetch from 'node-fetch';

// Precision/Recall and Search Quality Test

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const TEST_QUERIES = [
  { query: 'contract', relevantDocs: ['doc-1', 'doc-2'] },
  { query: 'invoice', relevantDocs: ['doc-3'] },
  { query: 'marketing', relevantDocs: ['doc-4', 'doc-5', 'doc-6'] },
];

async function isWorkerReachable() {
  try {
    const res = await fetch(`${WORKER_URL}/health`, { timeout: 2000 });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function evaluatePrecisionRecall() {
  let totalPrecision = 0, totalRecall = 0, count = 0;
  for (const { query, relevantDocs } of TEST_QUERIES) {
    const res = await fetch(`${WORKER_URL}/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const returnedIds = (data.results || []).map(d => d.id);
    const relevantReturned = returnedIds.filter(id => relevantDocs.includes(id));
    const precision = relevantReturned.length / (returnedIds.length || 1);
    const recall = relevantReturned.length / (relevantDocs.length || 1);
    totalPrecision += precision;
    totalRecall += recall;
    count++;
    console.log(`Query: ${query} | Precision: ${precision.toFixed(2)} | Recall: ${recall.toFixed(2)}`);
  }
  console.log(`\nAverage Precision: ${(totalPrecision/count).toFixed(2)}`);
  console.log(`Average Recall: ${(totalRecall/count).toFixed(2)}`);
}

(async () => {
  if (!(await isWorkerReachable())) {
    console.warn(`Worker at ${WORKER_URL} is not reachable. Skipping search quality test.`);
    return;
  }
  await evaluatePrecisionRecall();
})();
