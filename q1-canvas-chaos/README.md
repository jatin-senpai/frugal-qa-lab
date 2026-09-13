# Q1: Dynamic HTML5 Canvas State Drifts & Asynchronous Race Interceptions

**Component**: Frugal QA Lab — Q1 Canvas Chaos Engine  
**Score Weight**: 15 Points  
**Technologies**: HTML5 Canvas (2D Context), WebSockets (`ws`), Playwright, Node.js

---

## 1. Architectural Overview & Objectives

Traditional web test automation tools rely entirely on static DOM locators (`id`, CSS selectors, XPath). In modern high-frequency trading platforms, gaming sandboxes, and WebGL/HTML5 Canvas applications, elements are rendered directly as raw pixels on a bitmapped surface without exposing underlying DOM nodes.

This project implements a fully localized, deterministic testing harness for a dynamic Canvas trading terminal subjected to network chaos, state transitions, high-frequency race conditions, and corrupted server payloads.

```
┌────────────────────────────────────────────────────────┐
│               Apex Canvas Terminal (Frontend)          │
│  ┌─────────────────────────┐  ┌─────────────────────┐  │
│  │   2D Canvas Surface     │  │ Structured Error    │  │
│  │   - requestAnimFrame    │  │ Boundary            │  │
│  │   - Raw Pixel Scanning  │  │ (Math Corruption)   │  │
│  └─────────────────────────┘  └─────────────────────┘  │
└───────────────────────────▲────────────────────────────┘
                            │ WebSocket Frames
┌───────────────────────────┴────────────────────────────┐
│          Network Chaos Layer (Playwright / CDP)        │
│  - Fibonacci Jitter Model: 1000ms * Fib(n) <= 8000ms   │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│       WebSocket Testbed Server (Express + ws)          │
│  - Normal Mode (Loading -> Active)                     │
│  - Drift Mode (Simulated coordinate offset +35px)      │
│  - Corrupt Mode (Injected balance: '1e+7')             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Execution Specifications

### 2.1 WebSocket Stream Corruption & Jitter (Spec 1)
- **Fibonacci Delay Model**: Incoming WebSocket packets are intercepted and delayed dynamically according to:
  $$D_n = \min(1000 \times \text{Fib}(n), 8000)\text{ ms}$$
  Sequence: $1000\text{ ms} \rightarrow 1000\text{ ms} \rightarrow 2000\text{ ms} \rightarrow 3000\text{ ms} \rightarrow 5000\text{ ms} \rightarrow 8000\text{ ms}$.
- **Interception**: Implemented via browser-level WebSocket wrapping and CDP event tracking, logging timestamps before and after delayed dispatch.

### 2.2 Anti-AI Zero-DOM Pixel-State Detection (Spec 2)
- **No Static Sleep or DOM Locators**: The test does NOT query DOM selectors or visibility polls.
- **Embedded Pixel Scanner**: Runs a `requestAnimationFrame`-driven pixel-state observation loop evaluating `ctx.getImageData()` across the canvas buffer.
- **State Transition**:
  - Initial Gray Loading Threshold: $\text{RGB} \approx [120, 136, 150]$ ($\Delta < 30$).
  - Active Target Element: $\text{RGB}_{\text{green}} \rightarrow G > 180, R < 80$.
- **Contour Center Resolution**: Dynamically calculates target centroid $(\bar{X}, \bar{Y})$ from raw active pixel coordinates.

### 2.3 Race Injection Trap & Action Chaining (Spec 3)
- **Action Sequence**: `Hover` $\rightarrow$ `Drag 15px X-axis` $\rightarrow$ `Click`.
- **Race Window**: Must complete within **30 ms – 100 ms** from the exact pixel transition detection timestamp $T_{\text{detect}}$.
- **Measurement**: High-precision `performance.now()` microsecond tracking verifies actual execution timing.

### 2.4 Coordinate Drift Circuit-Breaker (Spec 3 Resilience)
- **Problem**: Asynchronous repaint delays or dynamic layout shifts can displace canvas targets mid-flight.
- **Circuit Breaker Macro**:
  1. Pre-flight verification samples target coordinate.
  2. If pixel color is invalid/stale, circuit trips (`TRIPPED`).
  3. Re-scans active contour to resolve updated offset $(\bar{X} + \Delta X_{\text{drift}}, \bar{Y})$.
  4. Resumes and completes the action safely (`RECOVERED`), avoiding blind clicks.

### 2.5 Mismatched Server Boundary Checking (Spec 4)
- **Fault Injection**: Server injects mathematically corrupted states (e.g. `balance: '1e+7'` or fractional cents).
- **Validation**: Frontend client enforces strict validation schema.
- **Assertion**: Verifies that the client halts rendering and invokes the structured `<div id="canvas-error-boundary">` with `ERR_STATE_CORRUPTION_MATHEMATICAL_BOUNDARY`.

---

## 3. How to Execute & Verify

Run the dedicated test suite from `frugal-qa-lab/`:

```bash
# Run Q1 Playwright suite
npm run test:q1

# Run in headed mode to visually observe canvas interactions
npx playwright test q1-canvas-chaos/tests/canvas-chaos.spec.js --headed
```

### Generated Evidence Artifacts:
- `evidence/q1/01-canvas-loading-gray.png`
- `evidence/q1/02-canvas-active-green.png`
- `evidence/q1/03-canvas-order-executed.png`
- `evidence/q1/04-canvas-error-boundary.png`
- `evidence/q1/results.json`
- `evidence/q1/execution.log`

---

## 4. Video Walkthrough Plan (Mandatory Checkpoints)

1. **Checkpoint 1: The Output Window**
   - Run `npm run test:q1` in terminal.
   - Display all 4 tests passing:
     - Fibonacci jitter & pixel detection
     - 30–100ms chained action execution
     - Circuit-breaker drift handling
     - Mathematical boundary exception
   - Show `results.json` with telemetry metrics.

2. **Checkpoint 2: The Source Code**
   - Walk through directory structure: `app/`, `server/`, `src/`, `tests/`.
   - Explain `pixelDetector.js` (embedded `requestAnimationFrame` loop, zero DOM).
   - Explain `actionChainer.js` and `circuitBreaker.js` (pre-flight checks and re-sampling).
   - Explain `wsServer.js` (drift and corrupt payload simulation).

3. **Checkpoint 3: GenAI Usage & Prompt History**
   - Display prompt engineering history used to formulate the pixel contour scanning algorithm and circuit-breaker state machine.
   - Show iterative query refining the 30–100ms timing measurement and race condition isolation.
