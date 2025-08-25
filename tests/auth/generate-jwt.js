// Utility to generate a JWT for testing the /process endpoint
// Usage: node generate-jwt.js <your AUTH_JWT_SECRET>

const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

if (process.argv.length < 3) {
  console.error('Usage: node generate-jwt.js <AUTH_JWT_SECRET>');
  process.exit(1);
}

const secret = process.argv[2];
const payload = {
  sub: 'test-user',
  exp: Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutes from now
};

const jwt = signJWT(payload, secret);
console.log(jwt);
