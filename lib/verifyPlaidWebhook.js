import crypto from 'crypto';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

// Plaid's verification keys are stable and meant to be cached — refetching
// per-webhook would be wasteful and Plaid explicitly recommends caching.
const keyCache = new Map();

async function getVerificationKey(keyId) {
  if (keyCache.has(keyId)) return keyCache.get(keyId);
  const res = await client.webhookVerificationKeyGet({ key_id: keyId });
  keyCache.set(keyId, res.data.key);
  return res.data.key;
}

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Verifies a Plaid webhook per https://plaid.com/docs/api/webhooks/webhook-verification/
// `rawBody` must be the exact raw request body bytes Plaid sent — not a
// re-serialized/re-stringified version, since the signature covers the
// original bytes exactly.
export async function verifyPlaidWebhook(signedJwt, rawBody) {
  const parts = signedJwt.split('.');
  if (parts.length !== 3) throw new Error('Malformed webhook JWT');
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(base64urlDecode(headerB64).toString('utf8'));
  const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));

  if (header.alg !== 'ES256') {
    throw new Error('Unexpected JWT algorithm: ' + header.alg);
  }

  const jwk = await getVerificationKey(header.kid);
  if (jwk.expired_at) {
    throw new Error('Webhook verification key has expired');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signature = base64urlDecode(sigB64);
  const signedData = headerB64 + '.' + payloadB64;

  const verified = crypto.verify(
    'sha256',
    Buffer.from(signedData),
    { key: publicKey, dsaEncoding: 'ieee-p1363' }, // JWT ECDSA sigs are raw r||s, not DER
    signature
  );
  if (!verified) throw new Error('Webhook signature verification failed');

  // Replay protection — Plaid recommends rejecting anything older than 5 minutes.
  const ageSeconds = Math.floor(Date.now() / 1000) - payload.iat;
  if (ageSeconds > 5 * 60) throw new Error('Webhook JWT is too old (possible replay)');

  // Integrity check — confirms this JWT was issued for THIS exact body,
  // not copy-pasted from a different (legitimate) webhook delivery.
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  if (bodyHash !== payload.request_body_sha256) {
    throw new Error('Webhook body hash does not match signed payload');
  }

  return true;
}