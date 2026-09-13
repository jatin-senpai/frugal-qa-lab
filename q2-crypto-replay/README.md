# Q2: Cryptographic Replay Testing, Stateful Nonces & Hash-Chain API Chaining

**Component**: Frugal QA Lab — Q2 Cryptographic Replay Engine  
**Score Weight**: 4 Points  
**Technologies**: Node.js Native `crypto`, Express, Playwright, HTTP/1.1 Microsecond Latency

---

## 1. Architectural Overview & Threat Model

In modern high-frequency financial settlement networks and banking gateways, simple session bearer tokens are insufficient. Adversaries observing network packets can perform **Replay Attacks**: intercepting signed payment instructions and resending them identical to the original to force unauthorized duplicate debits.

Public mock gateways (like Restful Booker) do not validate cryptographic nonce headers, verify HMAC signatures, or implement stateful replay caches. 

This project implements a localized, stateful Express mock settlement gateway and an automated client framework demonstrating:
1. Multi-step transaction chaining across dynamic tokens.
2. Canonicalized HMAC-SHA512 signature computation over raw body, challenge nonces, and microsecond timestamps.
3. Sub-150ms duplicate replay injection.
4. Deterministic rejection with `HTTP 409 Conflict`.
5. Automated high-risk data-mutation vulnerability detection.

```
 Client (Playwright Test Runner)                   Server (Express Mock Gateway)
        │                                                     │
        │─── 1. POST /transactions ─────────────────────────>│ (Generates txn_id, challengeToken, serverTime)
        │<── 201 Created [X-Transaction-Id: txn_...] ────────│
        │                                                     │
        │─── 2. PUT /transactions/:id ───────────────────────>│ (Verifies HMAC-SHA512, checks timestamp)
        │    Headers: X-Frugal-Mac, X-Client-Timestamp-Us     │ (Caches signature in sliding-window cache)
        │<── 200 OK [Status: SETTLED] ───────────────────────│
        │                                                     │
        │ [Δt <= 150ms]                                       │
        │─── 3. DUPLICATE PUT /transactions/:id ─────────────>│ (Detects duplicate signature in cache)
        │    Identical Body, Timestamp, and MAC               │ (Halts execution to prevent duplicate debit)
        │<── 409 Conflict [ERR_TRANSACTION_REPLAY_DETECTED] ─│
```

---

## 2. Cryptographic Specifications

### 2.1 Canonicalization & String-to-Sign
To prevent signature mismatch across platforms with unordered JSON keys, payloads are canonicalized using recursive ASCII key sorting:
$$\text{canonicalBody} = \text{Canonicalize}(\text{payload})$$

The raw string-to-sign joins four stateful variables using the pipe (`|`) delimiter:
$$\text{StringToSign} = \text{transactionId} \parallel \text{canonicalBody} \parallel \text{clientTimestampUs} \parallel \text{challengeToken}$$

### 2.2 Signature Calculation (X-Frugal-Mac)
The authentication header is computed using HMAC with SHA-512 over the string-to-sign:
$$\text{X-Frugal-Mac} = \text{HMAC}_{\text{SHA512}}(K_{\text{secret}}, \text{StringToSign}).\text{hex}()$$

Verification uses `crypto.timingSafeEqual` to eliminate side-channel timing attack vectors.

### 2.3 Sub-150ms Replay Injection
Within $\le 150\text{ ms}$ from receiving the initial `200 OK` settlement response, the runner fires an exact duplicate HTTP packet with identical headers, microsecond timestamp, and payload.

### 2.4 Replay Defense & HTTP 409 Conflict Rationale
- **Why HTTP 409 Conflict?**
  Per RFC 9110 Section 15.5.10, `409 Conflict` indicates that the request could not be processed because of conflict in the current state of the resource. Replaying an already-settled state token creates a state transition collision.
- **Vulnerability Alert Handler**:
  If a vulnerable endpoint mistakenly returns `200 OK` or `201 Created` for the duplicate request, the test framework traps this condition and raises a `CRITICAL_HIGH_RISK` alert in the audit logs.

---

## 3. How to Execute & Verify

Run the dedicated test suite from `frugal-qa-lab/`:

```bash
# Run Q2 Playwright suite
npm run test:q2
```

### Generated Evidence Artifacts:
- `evidence/q2/results.json`
- `evidence/q2/execution.log`

---

## 4. Video Walkthrough Plan (Mandatory Checkpoints)

1. **Checkpoint 1: The Output Window**
   - Run `npm run test:q2`.
   - Show all 4 test suites passing:
     - Dynamic chaining & HMAC verification
     - Immediate sub-150ms replay rejection (`HTTP 409 Conflict`)
     - Negative mutation matrix (tampered body, tampered timestamp, stale timestamp)
     - High-risk vulnerability detection alert on unprotected routes.

2. **Checkpoint 2: The Source Code**
   - Walk through `server/app.js` (replay sliding-window cache, `crypto.timingSafeEqual`).
   - Walk through `src/cryptoSigner.js` (canonicalization and HMAC-SHA512).
   - Walk through `src/replayClient.js` (precision sub-150ms burst dispatch).

3. **Checkpoint 3: GenAI Usage & Prompt History**
   - Display prompt iterations used to formulate the canonicalization rule and sliding window cache.
   - Show prompt queries that designed the negative security testing matrix and vulnerability alert handler.
