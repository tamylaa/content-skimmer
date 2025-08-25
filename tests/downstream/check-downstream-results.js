// check-downstream-results.js
// Checks the downstream analysis results for a given fileId

import fetch from 'node-fetch';

const DATA_SERVICE_URL = 'https://data-service.tamyla.com'; // from wrangler.toml
const DATA_SERVICE_API_KEY = process.env.DATA_SERVICE_API_KEY || '<YOUR_DATA_SERVICE_API_KEY>';
const FILE_ID = 'integration-test-file';

async function checkAnalysisResults() {
  const url = `${DATA_SERVICE_URL}/api/files/${FILE_ID}/analysis-results`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${DATA_SERVICE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    console.error(`Failed to fetch analysis results: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    return;
  }
  const result = await res.json();
  console.log('Analysis Results:', JSON.stringify(result, null, 2));
}

checkAnalysisResults();
