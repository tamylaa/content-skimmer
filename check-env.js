// check-env.js
const required = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'MEILISEARCH_URL',
  'MEILISEARCH_API_KEY',
  'DATA_SERVICE_URL',
  'CONTENT_STORE_SERVICE_URL',
  'DATA_SERVICE_API_KEY',
  'WEBHOOK_SECRET',
  'AUTH_JWT_SECRET',
  'LOG_LEVEL'
];

console.log('--- Environment Variable Check ---');
for (const key of required) {
  if (process.env[key]) {
    console.log(`${key}: ${process.env[key]}`);
  } else {
    console.warn(`${key}: MISSING`);
  }
}
