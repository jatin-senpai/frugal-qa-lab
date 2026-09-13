// Frugal QA Lab — Q2 Cryptographic Signer & Canonicalizer
import crypto from 'crypto';

export function canonicalizeJson(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  return '{' + sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(',') + '}';
}

/**
 * Returns microsecond timestamp as integer string
 */
export function getMicrosecondTimestamp() {
  const ms = Date.now();
  const subMs = Math.floor((performance.now() % 1) * 1000);
  return (BigInt(ms) * 1000n + BigInt(subMs)).toString();
}

/**
 * Generates X-Frugal-Mac using HMAC-SHA512
 * Supports canonical String-to-Sign formats:
 * - 5-tuple: id|canonicalBody|clientTimestampUs|serverTimestamp|challengeToken
 * - 4-tuple: id|canonicalBody|clientTimestampUs|challengeToken
 */
export function generateFrugalMac(transactionId, payload, challengeToken, timestampUs, serverTimestampOrSecret, optionalSecret) {
  let serverTimestamp = null;
  let secret = serverTimestampOrSecret;
  if (optionalSecret !== undefined) {
    serverTimestamp = serverTimestampOrSecret;
    secret = optionalSecret;
  }

  const canonicalBody = canonicalizeJson(payload);
  const stringToSign = serverTimestamp
    ? `${transactionId}|${canonicalBody}|${timestampUs}|${serverTimestamp}|${challengeToken}`
    : `${transactionId}|${canonicalBody}|${timestampUs}|${challengeToken}`;

  const mac = crypto.createHmac('sha512', secret).update(stringToSign).digest('hex');
  return {
    mac,
    canonicalBody,
    stringToSign,
    timestampUs,
    serverTimestamp
  };
}
