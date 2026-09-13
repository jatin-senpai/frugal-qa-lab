# Frugal QA Lab
> **Deterministic AI-Assisted Quality Engineering Laboratory**  
> Candidate Assessment Submission for **Frugal Testing / BuildNexTech "AI-Native Software Engineer Intern"**  
> **Repository:** `git@github.com:jatin-senpai/frugal-qa-lab.git`  
> *Notice: This is an independent candidate engineering project for the placement evaluation, not an official Frugal Testing product.*

---

## 1. Executive Summary

**Frugal QA Lab** is a unified, locally reproducible quality engineering workspace designed to evaluate cutting-edge software engineering, browser automation, cryptographic API resilience, and autonomous AI systems reasoning.

Rather than providing fragmented or theoretical scripts, **Frugal QA Lab** provides running, verifiable testbeds that mathematically and programmatically enforce the authoritative specifications across all 18 pages of the assessment document.

```
frugal-qa-lab/
├── README.md                          # Master project documentation
├── package.json                       # Central scripts & dependencies
├── playwright.config.js               # Unified test configuration & reporters
│
├── q1-canvas-chaos/                   # 15 Points: Canvas Chaos & Asynchronous Race Interceptions
│   ├── app/                           # HTML5 Canvas 2D trading terminal & Structured Error Boundary
│   ├── server/                        # Express + ws WebSocket broker with dynamic fault injection
│   ├── src/                           # Pixel detector, Fibonacci jitter, 30-100ms action chainer, circuit breaker
│   ├── tests/                         # Playwright test suite (100% deterministic, zero DOM locators)
│   ├── artifacts/                     # Machine-readable execution logs & results
│   └── README.md                      # Detailed technical architecture & video walkthrough plan
│
├── q2-crypto-replay/                  # 4 Points: Stateful Cryptographic API Replay Protection
│   ├── server/                        # Stateful Express mock settlement gateway
│   ├── src/                           # Canonicalizer, microsecond timer, HMAC-SHA512 signer, replay client
│   ├── tests/                         # Playwright suite (Chaining, sub-150ms replay, 409 Conflict, negative tests)
│   ├── artifacts/                     # Cryptographic audit logs & vulnerability alerts
│   └── README.md                      # Threat model, canonicalization spec & video walkthrough plan
│
├── q3-shadow-dom/                     # 1 Point: Sealed Closed-Boundary Shadow DOM & Accessibility
│   ├── app/                           # Multi-level custom web components (<enterprise-portal>, <payment-terminal>)
│   ├── server/                        # Static host server
│   ├── src/                           # Resilient tree walker, W3C closed boundary proofs, CoT system prompt
│   ├── tests/                         # Playwright suite (Open piercing, closed boundary audit, AXTree resolution)
│   ├── artifacts/                     # Accessibility tree snapshots & logs
│   └── README.md                      # Boundary analysis, CoT prompt spec & video walkthrough plan
│
├── section-0/
│   └── alignment.md                   # Pre-Evaluation Disclosures & Alignment (Bond, Relocation, Motivation)
│
├── section-b/
│   ├── answers.md                     # Q4–Q20 Scenarios & Situations A–D (<=150 words each, 6-point reasoning)
│   ├── article.md                     # Q21 Publication-grade article on Restrictive MCP Sandboxes (750-1500 words)
│   ├── portfolio.md                   # Q22 Profile, portfolio repositories, and social engagement checklist
│   └── video_cv_script.md             # Q23 High-impact 2-to-3 minute video presentation script
│
├── evidence/                          # Consolidated execution evidence & visual proof
│   ├── q1/                            # Results, execution logs, and canvas state screenshots
│   ├── q2/                            # Results, audit logs, and replay rejection traces
│   └── q3/                            # Results, execution logs, and accessibility tree snapshots
└── FINAL_REQUIREMENTS_MATRIX.md      # Comprehensive end-to-end compliance audit
```

---

## 2. Quickstart & Reproducibility

### Prerequisites
- **Node.js**: v20.x or v24.x LTS (`node -v`)
- **npm**: v10.x or v11.x (`npm -v`)

### Installation
```bash
# Clone the repository
git clone git@github.com:jatin-senpai/frugal-qa-lab.git
cd frugal-qa-lab

# Install dependencies
npm install

# Install Playwright Chromium browser binaries
npx playwright install chromium
```

### Running the Entire Automated Test Suite
```bash
# Run all 11 automated test specifications across Q1, Q2, and Q3
npm test
```

### Running Individual Module Suites
```bash
# Run Q1: Dynamic HTML5 Canvas Chaos & Race Interceptions
npm run test:q1

# Run Q2: Cryptographic Replay & HMAC-SHA512 Chaining
npm run test:q2

# Run Q3: Sealed Closed-Boundary Shadow DOM & Accessibility Tree
npm run test:q3

# Visually observe canvas interactions in headed browser mode
npx playwright test q1-canvas-chaos/tests/canvas-chaos.spec.js --headed
```

---

## 3. Section A Technical Highlights

### Q1. Dynamic HTML5 Canvas State Drifts & Asynchronous Race Interceptions (15 pts)
- **Zero DOM Locators**: Uses an embedded in-browser `requestAnimationFrame` loop evaluating raw `ctx.getImageData()` to detect color transitions from initial gray loading threshold (`#788896`) to active green (`#00E676`).
- **Fibonacci Delay Model**: Intercepts WebSocket orderbook streams and injects scaled packet latency: $D_n = \min(1000 \times \text{Fib}(n), 8000)\text{ ms}$ ($1\text{s}, 1\text{s}, 2\text{s}, 3\text{s}, 5\text{s}, 8\text{s}$).
- **Measured Race Action Chaining**: Dispatches `Hover -> Drag 15px X-axis -> Click` strictly within the $30\text{ ms} - 100\text{ ms}$ window, logging microsecond timestamps.
- **Coordinate Drift Circuit-Breaker**: Wraps mouse execution in a pre-flight and in-flight revalidation macro. Re-samples pixels; if drift or repaint lag is detected, aborts blind clicks, re-scans active contours, and safely recalculates target grid offsets.
- **Mathematical Boundary Corruption**: Injects corrupted scientific notation (`balance: "1e+7"`). Verifies frontend catches the violation, halts the stream, and invokes a structured `<div id="canvas-error-boundary">`.

### Q2. Cryptographic Replay Testing, Stateful Nonces & Hash-Chain API Chaining (4 pts)
- **Dynamic Sequence Chaining**: Executes `POST /transactions`, captures dynamic `X-Transaction-Id` from response headers and server-issued challenge nonce from body.
- **HMAC-SHA512 Signature**: Client dynamically constructs `X-Frugal-Mac` over canonical key-sorted body, client microsecond timestamp, and challenge salt sequence.
- **Sub-150ms Replay Attack**: Duplicates and resends the exact same packet payload with identical timestamp and MAC token $<150\text{ ms}$ later.
- **Replay Protection (HTTP 409 Conflict)**: Stateful sliding-window cache on Express mock server detects duplicate MAC, rejects replay with `HTTP 409 Conflict`, and logs audit metrics.
- **Negative Test Matrix & Vulnerability Alert**: Asserts rejection for tampered bodies (401), tampered timestamps (401), corrupted MACs (401), and stale timestamps (422). Traps vulnerable endpoints and throws explicit `CRITICAL_HIGH_RISK` data-mutation alerts.

### Q3. Sealed Closed-Boundary Shadow DOM Pathfinding & Accessibility Tree Refactoring (1 pt)
- **Dynamic Obfuscation Handling**: Traverses nested web components (`<enterprise-portal>`, `<payment-terminal>`, `<security-sandbox>`) whose classes regenerate on every page reload (`.obfuscated_v4_x89a`).
- **W3C Closed Boundary Security Proof**: Proves mathematically and programmatically that `element.shadowRoot` strictly returns `null` on closed roots in standard page runtimes. Documents viable test harness hooks and CDP piercing.
- **Accessibility Tree Pathfinding**: Demonstrates locating and executing controls purely via semantic accessibility roles (`page.getByRole('button', { name: 'Authorize Ledger Funds' })`) and computed AXTree snapshots.
- **Expert CoT System Prompt**: Provides a dense Chain-of-Thought prompt training LLMs to navigate OS Accessibility Trees while explicitly forbidding IDs, CSS classes, XPaths, tag names, or text matching.

---

## 4. Section B Analytical Scenarios & Technical Article (75 pts)

- **Q4–Q20 (17 Scenario Questions)**: Each answer formatted under strict 6-point internal engineering reasoning (`Failure Mechanism`, `Root Cause`, `Why Naive Testing Misses It`, `Deterministic Solution`, `Concrete Telemetry/Assertion/Control`, `Trade-off`) and strictly bounded to $\le 150$ words.
- **Situations A–D**: Defensible engineering choices balancing long-term architecture, safety, and velocity.
- **Q21 Professional Technical Article**: 1,408-word publication-grade paper on **Topic B**: *Securing the AI Workspace: Designing Restrictive Model Context Protocol (MCP) Sandboxes to Prevent Arbitrary Code Executions by Autonomous Developer Agents*.

---

## 5. Automated Verification & Evidence Matrix

Every practical implementation runs locally and generates machine-readable evidence:
- `evidence/q1/results.json` & `execution.log` (10 passed assertions)
- `evidence/q1/*.png` (Loading gray, active green, executed order, and error boundary)
- `evidence/q2/results.json` & `execution.log` (4 passed suites, sub-150ms burst timing)
- `evidence/q3/results.json` & `execution.log` (3 passed suites, accessibility snapshots)

---

## 6. Video Walkthrough Compliance Specifications

Per Page 3 & 4 of the assessment PDF, each question video folder requires:
1. **The Output Window**: Terminal execution of test suites, passing assertions, and telemetry outputs.
2. **The Source Code**: IDE walkthrough of file architecture, algorithms, and defensive patterns.
3. **GenAI Usage & Prompt History**: Displaying generative AI conversation history, structured prompt engineering, and iterative debugging queries.
