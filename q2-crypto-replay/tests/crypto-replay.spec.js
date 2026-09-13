import { test, expect } from '@playwright/test';
import { createQ2Server, HMAC_SECRET } from '../server/app.js';
import { ReplayClient } from '../src/replayClient.js';
import { getMicrosecondTimestamp, generateFrugalMac } from '../src/cryptoSigner.js';
import { SecurityTelemetry } from '../src/telemetry.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;

test.describe('Q2: Cryptographic Replay Testing, Stateful Nonces & Hash-Chain API Chaining', () => {
  let serverInstance = null;
  let client;
  let telemetry;

  test.beforeAll(async () => {
    telemetry = new SecurityTelemetry('q2-crypto-replay');
    const srv = createQ2Server(PORT);
    serverInstance = srv;
    await new Promise((resolve) => srv.server.listen(PORT, resolve));
    client = new ReplayClient(BASE_URL, HMAC_SECRET);
    console.log(`[Test Setup] Q2 Cryptographic Mock Server active on ${BASE_URL}`);
  });

  test.afterAll(async () => {
    if (telemetry) {
      telemetry.exportEvidence([
        path.join(__dirname, '../artifacts'),
        path.join(__dirname, '../../evidence/q2')
      ]);
    }
    if (serverInstance && serverInstance.stop) {
      await serverInstance.stop();
      console.log('[Test Teardown] Q2 Server stopped.');
    }
  });

  test('Core Spec 1 & 2: Dynamic Sequence Chaining & Cryptographic Nonce Injection', async () => {
    telemetry.log('TEST_START', 'Initiating Dynamic Sequence Chaining (POST -> PUT) with HMAC-SHA512 verification');

    // Step 1: POST /transactions
    const initResult = await client.createTransaction();
    telemetry.log('TRANSACTION_CREATED', 'Received transaction wrapper from server', {
      status: initResult.status,
      headerTxnId: initResult.headerTxnId,
      headerChallenge: initResult.headerChallenge
    });

    // Verify Specification 1: Extract ID from response header
    expect(initResult.status).toBe(201);
    expect(initResult.headerTxnId).toBeDefined();
    expect(initResult.headerTxnId).toMatch(/^txn_[a-f0-9]{24}$/);
    expect(initResult.body.challengeToken).toBeDefined();
    telemetry.recordAssertion('Extracted valid transaction ID from X-Transaction-Id response header', true, {
      transactionId: initResult.headerTxnId
    });

    // Step 2: Formulate dynamic PUT request with HMAC-SHA512 header (Specification 2)
    const transactionId = initResult.headerTxnId;
    const challengeToken = initResult.body.challengeToken;
    const updatePayload = {
      action: 'SETTLE_FUNDS',
      amount: 45000.00,
      currency: 'USD',
      beneficiary: 'BUILDNEXT_ESCROW_NODE_01'
    };

    const timestampUs = getMicrosecondTimestamp();
    const putResult = await client.sendPutRequest(`/transactions/${transactionId}`, transactionId, updatePayload, challengeToken, timestampUs);
    telemetry.log('PUT_DISPATCHED', 'Dispatched signed PUT update request', {
      status: putResult.status,
      elapsedMs: putResult.elapsedMs,
      sentMac: putResult.sentMac
    });

    expect(putResult.status).toBe(200);
    expect(putResult.body.status).toBe('SETTLED');
    expect(putResult.body.transactionId).toBe(transactionId);
    telemetry.recordAssertion('Server verified dynamic HMAC-SHA512 header and settled transaction', true, {
      settledMac: putResult.body.proofOfWorkMac
    });
  });

  test('Core Spec 3 & 4: Exact Replay Attack Vector (<150ms) & Replay Assertion (HTTP 409 Conflict)', async () => {
    telemetry.log('TEST_START', 'Executing immediate Replay Attack within <150ms of PUT completion');

    // Setup fresh transaction
    const init = await client.createTransaction();
    const transactionId = init.headerTxnId;
    const challengeToken = init.body.challengeToken;
    const payload = {
      action: 'EXECUTE_PAYMENT_ORDER',
      amount: 150000.00,
      currency: 'EUR',
      nonceChannel: 'HASH_CHAIN_A'
    };

    // Execute Replay Attack (<150ms duplicate burst)
    const attackResult = await client.executeReplayAttack(transactionId, payload, challengeToken);
    telemetry.log('REPLAY_ATTACK_EXECUTED', 'Dispatched initial request followed by immediate duplicate payload', {
      initialStatus: attackResult.initialResponse.status,
      replayStatus: attackResult.replayResponse.status,
      burstDeltaMs: attackResult.burstDeltaMs,
      completedWithin150Ms: attackResult.completedWithin150Ms,
      replayedSignature: attackResult.signatureUsed
    });

    // Assert Initial Request Succeeded
    expect(attackResult.initialResponse.status).toBe(200);
    expect(attackResult.initialResponse.body.status).toBe('SETTLED');
    telemetry.recordAssertion('Initial financial transaction settled successfully', true);

    // Assert Burst Timing was strictly within 150ms
    expect(attackResult.burstDeltaMs).toBeLessThanOrEqual(150);
    telemetry.recordAssertion('Duplicate replay packet dispatched within 150ms window', true, {
      burstDeltaMs: attackResult.burstDeltaMs
    });

    // Assert Replay Defense: HTTP 409 Conflict
    expect(attackResult.replayResponse.status).toBe(409);
    expect(attackResult.replayResponse.body.error).toBe('ERR_TRANSACTION_REPLAY_DETECTED');
    telemetry.recordAssertion('Backend correctly dropped and rejected replay attempt with HTTP 409 Conflict', true, {
      status: attackResult.replayResponse.status,
      error: attackResult.replayResponse.body.error,
      deltaFromFirstRequestMs: attackResult.replayResponse.body.details?.deltaFromFirstRequestMs
    });
  });

  test('Negative Security Matrix: Tampered Payloads, Corrupted MAC, and Stale Timestamps', async () => {
    telemetry.log('TEST_START', 'Validating negative cryptographic mutation attack vectors');

    const init = await client.createTransaction();
    const transactionId = init.headerTxnId;
    const challengeToken = init.body.challengeToken;
    const basePayload = { amount: 1000.00, destinationAccount: 'ACC_RESERVE_99' };
    const validTsUs = getMicrosecondTimestamp();

    // 1. Tampered Body Attack: Sign one payload, send a mutated body with higher amount
    const sigForOriginal = generateFrugalMac(transactionId, basePayload, challengeToken, validTsUs, HMAC_SECRET);
    const tamperedPayload = { amount: 999999.00, destinationAccount: 'ACC_RESERVE_99' };
    const resTamperedBody = await client.sendPutRequest(
      `/transactions/${transactionId}`,
      transactionId,
      tamperedPayload,
      challengeToken,
      validTsUs,
      sigForOriginal.mac
    );
    expect(resTamperedBody.status).toBe(401);
    expect(resTamperedBody.body.error).toBe('ERR_INVALID_MAC');
    telemetry.recordAssertion('Backend rejected tampered payload body with HTTP 401 Unauthorized', true);

    // 2. Tampered Timestamp Attack: Change timestamp by 10 microseconds without recalculating MAC
    const tamperedTsUs = (BigInt(validTsUs) + 10n).toString();
    const resTamperedTs = await client.sendPutRequest(
      `/transactions/${transactionId}`,
      transactionId,
      basePayload,
      challengeToken,
      tamperedTsUs,
      sigForOriginal.mac
    );
    expect(resTamperedTs.status).toBe(401);
    expect(resTamperedTs.body.error).toBe('ERR_INVALID_MAC');
    telemetry.recordAssertion('Backend rejected tampered timestamp with HTTP 401 Unauthorized', true);

    // 3. Corrupted MAC Attack: Invert last hex characters
    const corruptedMac = sigForOriginal.mac.slice(0, -4) + 'ffff';
    const resCorruptedMac = await client.sendPutRequest(
      `/transactions/${transactionId}`,
      transactionId,
      basePayload,
      challengeToken,
      validTsUs,
      corruptedMac
    );
    expect(resCorruptedMac.status).toBe(401);
    telemetry.recordAssertion('Backend rejected corrupted MAC string with HTTP 401 Unauthorized', true);

    // 4. Stale Timestamp Attack: Clock skew exceeding allowed drift (>10 seconds in the past)
    const staleTsUs = (BigInt(Date.now() - 30000) * 1000n).toString();
    const sigStale = generateFrugalMac(transactionId, basePayload, challengeToken, staleTsUs, HMAC_SECRET);
    const resStale = await client.sendPutRequest(
      `/transactions/${transactionId}`,
      transactionId,
      basePayload,
      challengeToken,
      staleTsUs,
      sigStale.mac
    );
    expect(resStale.status).toBe(422);
    expect(resStale.body.error).toBe('ERR_STALE_TIMESTAMP');
    telemetry.recordAssertion('Backend rejected stale timestamp with HTTP 422 Unprocessable Entity', true);
  });

  test('Vulnerability Alert Layer: Framework Throws High-Risk Data-Mutation Alert on Unprotected Endpoint', async () => {
    telemetry.log('TEST_START', 'Testing Vulnerability Detection Engine against simulated unprotected replay endpoint');

    const init = await client.createTransaction();
    const transactionId = init.headerTxnId;
    const challengeToken = init.body.challengeToken;
    const payload = { amount: 7500.00, memo: 'SIMULATE_VULNERABLE_GATEWAY' };

    // Target the intentionally vulnerable mock route
    const attackResult = await client.executeReplayAttack(transactionId, payload, challengeToken, `/transactions/vulnerable-replay/${transactionId}`);

    telemetry.log('VULNERABLE_TEST_EXECUTED', 'Targeted vulnerable route to test security assertion handler', {
      initialStatus: attackResult.initialResponse.status,
      replayStatus: attackResult.replayResponse.status
    });

    // Verification: If backend fails replay safety and mistakenly returns 200 OK, framework MUST throw a high-risk vulnerability alert
    if (attackResult.replayResponse.status === 200 || attackResult.replayResponse.status === 201) {
      const alert = telemetry.raiseVulnerabilityAlert(
        'CRITICAL_HIGH_RISK',
        'HIGH-RISK DATA-MUTATION VULNERABILITY DETECTED: Server permitted duplicate transaction replay!',
        {
          transactionId,
          replayedMac: attackResult.signatureUsed,
          duplicateResponseStatus: attackResult.replayResponse.status,
          duplicateResponseBody: attackResult.replayResponse.body
        }
      );

      expect(alert.severity).toBe('CRITICAL_HIGH_RISK');
      telemetry.recordAssertion('Framework successfully trapped and alerted on high-risk replay vulnerability', true, alert);
    } else {
      throw new Error('Expected vulnerable endpoint to return 200 to test vulnerability detection logic.');
    }
  });
});
