// Frugal QA Lab — Q2 Stateful Cryptographic Mock API Server
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

export const HMAC_SECRET = process.env.FRUGAL_HMAC_SECRET || 'frugal_testing_secure_hash_chain_salt_2026_x89a';

/**
 * Deterministic JSON key canonicalization
 */
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

export function createQ2Server(port = 3002) {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());

  // In-memory state repositories
  const transactions = new Map(); // id -> { id, challengeToken, serverTimeMs, status }
  const seenSignatures = new Map(); // mac -> { seenAt: Date.now(), timestampUs, transactionId }

  // 1. Dynamic Sequence Chaining: POST /transactions
  app.post('/transactions', (req, res) => {
    const transactionId = `txn_${crypto.randomBytes(12).toString('hex')}`;
    const challengeToken = `ch_${crypto.randomBytes(16).toString('hex')}`;
    const serverTimeMs = Date.now();

    const record = {
      id: transactionId,
      challengeToken,
      serverTimeMs,
      status: 'INITIATED',
      createdAt: serverTimeMs
    };

    transactions.set(transactionId, record);

    // Specification 1: Extract transaction ID wrapper from response header
    res.setHeader('X-Transaction-Id', transactionId);
    res.setHeader('X-Challenge-Token', challengeToken);
    res.setHeader('X-Server-Timestamp', serverTimeMs.toString());

    return res.status(201).json({
      transactionId,
      challengeToken,
      serverTimeMs,
      status: 'INITIATED',
      canonicalRule: 'id|canonicalBody|clientTimestampUs|challengeToken',
      hashAlgorithm: 'HMAC-SHA512'
    });
  });

  // Helper: Core verification logic
  function verifyRequest(req, res, enforceReplayCheck = true) {
    const { id } = req.params;
    const clientMac = req.headers['x-frugal-mac'];
    const clientTimestampUs = req.headers['x-client-timestamp-us'];

    if (!transactions.has(id)) {
      return { ok: false, status: 404, error: 'ERR_TRANSACTION_NOT_FOUND', message: `Transaction ${id} does not exist.` };
    }

    const tx = transactions.get(id);

    if (!clientMac || !clientTimestampUs) {
      return { ok: false, status: 400, error: 'ERR_MISSING_HEADERS', message: 'Missing X-Frugal-Mac or X-Client-Timestamp-Us headers.' };
    }

    const tsUs = parseInt(clientTimestampUs, 10);
    const nowUs = Date.now() * 1000;
    // Check timestamp freshness (allowed drift: +/- 10 seconds)
    if (Math.abs(nowUs - tsUs) > 10000000) {
      return { ok: false, status: 422, error: 'ERR_STALE_TIMESTAMP', message: `Timestamp delta ${Math.abs(nowUs - tsUs)}us exceeds allowed drift tolerance.` };
    }

    // Compute expected HMAC-SHA512
    const canonicalBody = canonicalizeJson(req.body);
    // Format A (5-tuple binding server timestamp): id|canonicalBody|clientTimestampUs|serverTimeMs|challengeToken
    const stringToSign5 = `${id}|${canonicalBody}|${clientTimestampUs}|${tx.serverTimeMs}|${tx.challengeToken}`;
    const expectedMac5 = crypto.createHmac('sha512', HMAC_SECRET).update(stringToSign5).digest('hex');

    // Format B (4-tuple legacy): id|canonicalBody|clientTimestampUs|challengeToken
    const stringToSign4 = `${id}|${canonicalBody}|${clientTimestampUs}|${tx.challengeToken}`;
    const expectedMac4 = crypto.createHmac('sha512', HMAC_SECRET).update(stringToSign4).digest('hex');

    // Constant-time comparison to prevent timing attacks
    const clientMacBuffer = Buffer.from(clientMac, 'hex');
    const expectedMac5Buffer = Buffer.from(expectedMac5, 'hex');
    const expectedMac4Buffer = Buffer.from(expectedMac4, 'hex');

    const isValid5 = clientMacBuffer.length === expectedMac5Buffer.length && crypto.timingSafeEqual(clientMacBuffer, expectedMac5Buffer);
    const isValid4 = clientMacBuffer.length === expectedMac4Buffer.length && crypto.timingSafeEqual(clientMacBuffer, expectedMac4Buffer);

    if (!isValid5 && !isValid4) {
      return { ok: false, status: 401, error: 'ERR_INVALID_MAC', message: 'HMAC-SHA512 signature verification failed.' };
    }

    // Replay Protection Verification
    if (enforceReplayCheck) {
      if (seenSignatures.has(clientMac)) {
        const originalEntry = seenSignatures.get(clientMac);
        const deltaFromFirstRequestMs = Date.now() - originalEntry.seenAt;
        return {
          ok: false,
          status: 409, // HTTP 409 Conflict: Standard idempotent state conflict for replay attacks
          error: 'ERR_TRANSACTION_REPLAY_DETECTED',
          message: 'Cryptographic replay attack detected: Identical payload and MAC signature already processed.',
          replayDetails: {
            signature: clientMac,
            deltaFromFirstRequestMs,
            originalSeenAt: originalEntry.seenAt
          }
        };
      }
    }

    // Record signature in sliding window cache
    seenSignatures.set(clientMac, {
      seenAt: Date.now(),
      timestampUs: clientTimestampUs,
      transactionId: id
    });

    tx.status = 'SETTLED';
    tx.settledPayload = req.body;
    tx.signature = clientMac;

    return { ok: true, status: 200, data: { status: 'SETTLED', transactionId: id, settledAt: Date.now(), proofOfWorkMac: clientMac } };
  }

  // 2. Cryptographic Nonce Injection & PUT Update Endpoint
  app.put('/transactions/:id', (req, res) => {
    const result = verifyRequest(req, res, true);
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        message: result.message,
        details: result.replayDetails || {}
      });
    }
    return res.status(200).json(result.data);
  });

  // 3. Intentionally Vulnerable Endpoint (Simulates misconfigured backend that omits replay defense)
  app.put('/transactions/vulnerable-replay/:id', (req, res) => {
    const result = verifyRequest(req, res, false); // Replay check disabled
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        message: result.message
      });
    }
    return res.status(200).json(result.data);
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      activeTransactions: transactions.size,
      cachedSignatures: seenSignatures.size
    });
  });

  const stop = () => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  };

  return { app, server, stop, transactions, seenSignatures };
}

// Standalone execution entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3002;
  const { server } = createQ2Server(PORT);
  server.listen(PORT, () => {
    console.log(`[Q2 Server] Cryptographic Mock Gateway active on http://localhost:${PORT}`);
  });
}
