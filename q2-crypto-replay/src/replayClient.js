// Frugal QA Lab — Q2 Replay Client & Chaining Dispatcher
import { getMicrosecondTimestamp, generateFrugalMac } from './cryptoSigner.js';

export class ReplayClient {
  constructor(baseUrl = 'http://localhost:3002', secret = 'frugal_testing_secure_hash_chain_salt_2026_x89a') {
    this.baseUrl = baseUrl;
    this.secret = secret;
  }

  /**
   * Step 1: POST /transactions
   * Extracts transactionId from response headers and challenge token from body
   */
  async createTransaction() {
    const res = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const headerTxnId = res.headers.get('x-transaction-id');
    const headerChallenge = res.headers.get('x-challenge-token');
    const headerTimestamp = res.headers.get('x-server-timestamp');
    const data = await res.json();

    return {
      status: res.status,
      headerTxnId,
      headerChallenge,
      headerTimestamp,
      body: data
    };
  }

  /**
   * Dispatches PUT request with calculated cryptographic HMAC header
   */
  async sendPutRequest(endpointPath, transactionId, bodyPayload, challengeToken, timestampUs, customMac = null) {
    const sig = customMac
      ? { mac: customMac, timestampUs }
      : generateFrugalMac(transactionId, bodyPayload, challengeToken, timestampUs, this.secret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Frugal-Mac': sig.mac,
      'X-Client-Timestamp-Us': timestampUs
    };

    const startTime = performance.now();
    const res = await fetch(`${this.baseUrl}${endpointPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(bodyPayload)
    });
    const endTime = performance.now();
    const responseBody = await res.json();

    return {
      status: res.status,
      elapsedMs: endTime - startTime,
      headers: Object.fromEntries(res.headers.entries()),
      body: responseBody,
      sentMac: sig.mac,
      sentTimestampUs: timestampUs
    };
  }

  /**
   * Executes the Replay Attack Vector:
   * 1. Sends initial PUT request
   * 2. Immediately duplicates and resends the exact same packet payload with
   *    identical timestamp and X-Frugal-Mac token within 150 ms of completion.
   */
  async executeReplayAttack(transactionId, bodyPayload, challengeToken, endpointPath = null) {
    const path = endpointPath || `/transactions/${transactionId}`;
    const timestampUs = getMicrosecondTimestamp();
    const sig = generateFrugalMac(transactionId, bodyPayload, challengeToken, timestampUs, this.secret);

    // Initial PUT Request
    const t0 = performance.now();
    const initialRes = await this.sendPutRequest(path, transactionId, bodyPayload, challengeToken, timestampUs, sig.mac);
    const tComplete = performance.now();

    // Replay Burst (<150ms)
    const tReplayStart = performance.now();
    const replayRes = await this.sendPutRequest(path, transactionId, bodyPayload, challengeToken, timestampUs, sig.mac);
    const tReplayEnd = performance.now();

    const burstDeltaMs = tReplayEnd - tComplete;

    return {
      initialResponse: initialRes,
      replayResponse: replayRes,
      burstDeltaMs,
      completedWithin150Ms: burstDeltaMs <= 150,
      signatureUsed: sig.mac,
      timestampUsed: timestampUs
    };
  }
}
