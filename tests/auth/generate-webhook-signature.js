// Utility to generate a valid x-signature-256 header for webhook testing
// Usage: node generate-webhook-signature.js <WEBHOOK_SECRET> <body>

const crypto = require('crypto');

if (process.argv.length < 4) {
  console.error('Usage: node generate-webhook-signature.js <WEBHOOK_SECRET> <body>');
  process.exit(1);
}

const secret = process.argv[2];
const body = process.argv[3];

const signature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

console.log(signature);
