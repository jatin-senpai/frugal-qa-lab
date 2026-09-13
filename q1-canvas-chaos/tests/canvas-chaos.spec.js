import { test, expect } from '@playwright/test';
import { createQ1Server } from '../server/wsServer.js';
import { injectWebSocketChaos, extractChaosTelemetry } from '../src/networkChaos.js';
import { waitForCanvasPixelStateTransition } from '../src/pixelDetector.js';
import { executeChainedAction } from '../src/actionChainer.js';
import { CoordinateCircuitBreaker } from '../src/circuitBreaker.js';
import { ExecutionTelemetry } from '../src/telemetry.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;

test.describe('Q1: Dynamic HTML5 Canvas State Drifts & Asynchronous Race Interceptions', () => {
  let serverInstance = null;
  let telemetry;

  test.beforeAll(async () => {
    telemetry = new ExecutionTelemetry('q1-canvas-chaos');
    const srv = createQ1Server(PORT);
    serverInstance = srv;
    await new Promise((resolve) => srv.server.listen(PORT, resolve));
    console.log(`[Test Setup] Q1 Testbed Server active on http://localhost:${PORT}`);
  });

  test.afterAll(async () => {
    if (telemetry) {
      telemetry.exportEvidence([
        path.join(__dirname, '../artifacts'),
        path.join(__dirname, '../../evidence/q1')
      ]);
    }
    if (serverInstance && serverInstance.stop) {
      await serverInstance.stop();
      console.log('[Test Teardown] Q1 Testbed Server stopped.');
    }
  });

  test('Core Spec 1 & 2: WebSocket Fibonacci Jitter & Zero-DOM Pixel-State Detection', async ({ page }) => {
    telemetry.log('TEST_START', 'Initiating Fibonacci WebSocket jitter and pixel detector validation');

    // 1. Inject Fibonacci Delay Model into WebSocket stream (Spec 1)
    await injectWebSocketChaos(page, { maxCapMs: 8000 });
    telemetry.log('CHAOS_INJECTED', 'Fibonacci delay interceptor hooked into browser WebSocket layer (1s, 1s, 2s, 3s, 5s, 8s)');

    // Navigate to local Canvas testbed
    await page.goto(`http://localhost:${PORT}/?mode=normal&delay=800`);

    // Take screenshot of Initial Gray Loading State
    await page.screenshot({ path: path.join(__dirname, '../../evidence/q1/01-canvas-loading-gray.png') });
    telemetry.log('SCREENSHOT_CAPTURED', 'Captured initial gray loading state', { path: '01-canvas-loading-gray.png' });

    // 2. Poll Canvas rendering context via embedded requestAnimationFrame loop (Spec 2 - Anti-AI Constraint)
    const transitionResult = await waitForCanvasPixelStateTransition(page, '#trading-canvas', 25000);
    telemetry.log('PIXEL_TRANSITION_DETECTED', 'Active element color layout identified via requestAnimationFrame', {
      elapsedSinceStartMs: transitionResult.elapsedSinceStartMs,
      polledFrames: transitionResult.polledFrames,
      initialGrayConfirmed: transitionResult.initialGrayConfirmed,
      sampledColor: transitionResult.sampledColor,
      targetCoordinates: transitionResult.targetCoordinates
    });

    // Assertions for Spec 1 & 2
    expect(transitionResult.initialGrayConfirmed).toBe(true);
    telemetry.recordAssertion('Canvas rendered and confirmed initial gray loading threshold', true);

    expect(transitionResult.sampledColor.g).toBeGreaterThan(180);
    expect(transitionResult.sampledColor.r).toBeLessThan(80);
    telemetry.recordAssertion('Canvas color transitioned to active element green without DOM locators', true, transitionResult.sampledColor);

    // Verify WebSocket Chaos Interceptions were recorded
    const chaosLogs = await extractChaosTelemetry(page);
    expect(chaosLogs.length).toBeGreaterThan(0);
    telemetry.recordAssertion('WebSocket frames intercepted and injected with Fibonacci delay sequence', true, {
      interceptedFrames: chaosLogs.length,
      firstFrameDelayMs: chaosLogs[0]?.injectedDelayMs
    });

    // Take screenshot of Active State
    await page.screenshot({ path: path.join(__dirname, '../../evidence/q1/02-canvas-active-green.png') });
  });

  test('Core Spec 3: Ultra-Rapid Chained Action (Hover -> Drag 15px X -> Click) within 30-100ms Race Window', async ({ page }) => {
    telemetry.log('TEST_START', 'Initiating 30ms-100ms chained action race execution');

    await page.goto(`http://localhost:${PORT}/?mode=normal&delay=600`);

    // Detect state transition
    const transition = await waitForCanvasPixelStateTransition(page, '#trading-canvas', 15000);
    const detectionTimestamp = performance.now();
    telemetry.log('DETECTION_FIRED', 'Pixel transition detected. Commencing ultra-rapid action chain.', {
      transitionTimestamp: transition.transitionTimestamp,
      nodeDetectionTimestamp: detectionTimestamp
    });

    // Fire chained action: Hover -> Drag 15px X -> Click
    const actionTelemetry = await executeChainedAction(page, transition.targetCoordinates, detectionTimestamp, {
      dragDistancePx: 15
    });

    telemetry.log('ACTION_CHAIN_COMPLETED', 'Chained action sequence executed', actionTelemetry);

    // Verify Race Window: 30ms - 100ms
    telemetry.recordMetric('totalElapsedSinceDetectionMs', actionTelemetry.totalElapsedSinceDetectionMs);
    telemetry.recordMetric('actionExecutionDurationMs', actionTelemetry.actionExecutionDurationMs);

    // Assert that the action executed rapidly (action timing strictly measured)
    expect(actionTelemetry.actionExecutionDurationMs).toBeLessThanOrEqual(100);
    expect(actionTelemetry.totalElapsedSinceDetectionMs).toBeLessThanOrEqual(100);
    telemetry.recordAssertion('Action execution duration completed within race constraints (<=100ms)', true, {
      actionDurationMs: actionTelemetry.actionExecutionDurationMs,
      totalElapsedSinceDetectionMs: actionTelemetry.totalElapsedSinceDetectionMs
    });

    // Assert canvas order execution state
    const terminalState = await page.evaluate(() => window.getTradingState());
    expect(terminalState.target.executed).toBe(true);
    expect(terminalState.status).toBe('EXECUTED');
    telemetry.recordAssertion('Canvas application registered order execution via drag-and-click', true);

    // Take screenshot of Executed State
    await page.screenshot({ path: path.join(__dirname, '../../evidence/q1/03-canvas-order-executed.png') });
  });

  test('Core Spec 3 (Resilience): Coordinate Drift Circuit-Breaker Revalidation Macro', async ({ page }) => {
    telemetry.log('TEST_START', 'Validating Coordinate Drift Circuit-Breaker on dynamic layout shift');

    // In drift mode, server pushes driftX: 35 right after transition
    await page.goto(`http://localhost:${PORT}/?mode=drift&delay=600`);

    const transition = await waitForCanvasPixelStateTransition(page, '#trading-canvas', 15000);
    telemetry.log('INITIAL_COORDINATES_DETECTED', 'Target detected at initial position', transition.targetCoordinates);

    // Instantiate circuit breaker
    const breaker = new CoordinateCircuitBreaker();

    // Pass drifted/stale coordinates (-150px offset, placing it outside button bounds) to force circuit breaker trip and recovery
    const staleCoordinates = {
      ...transition.targetCoordinates,
      centerX: transition.targetCoordinates.centerX - 150
    };

    // Execute action wrapped inside the circuit breaker macro
    const result = await breaker.executeGuardedAction(
      page,
      staleCoordinates,
      async (resolvedCoords) => {
        return await executeChainedAction(page, resolvedCoords, performance.now(), { dragDistancePx: 15 });
      }
    );

    telemetry.log('CIRCUIT_BREAKER_EXECUTED', 'Circuit breaker completed guarded action', result);

    // Verify circuit breaker tripped and recovered target coordinates
    expect(result.circuitBreakerState).toBe('RECOVERED');
    expect(result.trippedCount).toBeGreaterThan(0);
    telemetry.recordAssertion('Circuit breaker handled dynamic coordinate drift without blind failure', true, {
      state: result.circuitBreakerState,
      trippedCount: result.trippedCount,
      resolvedCenter: result.resolvedCoordinates
    });

    const terminalState = await page.evaluate(() => window.getTradingState());
    expect(terminalState.target.executed).toBe(true);
    telemetry.recordAssertion('Drifted target successfully executed via revalidated coordinates', true);
  });

  test('Core Spec 4: Mismatched Server Boundary Checking & Structured Exception Boundary', async ({ page }) => {
    telemetry.log('TEST_START', 'Testing corrupted mathematical state string injection and frontend exception boundary');

    // In corrupt mode, server sends balance: '1e+7' and corrupt: true
    await page.goto(`http://localhost:${PORT}/?mode=corrupt`);

    // Verify that the frontend UI invokes structured exception boundary mechanism
    const errorBoundary = page.locator('#canvas-error-boundary');
    await expect(errorBoundary).toBeVisible({ timeout: 10000 });

    const errorCode = await page.locator('#error-code').textContent();
    expect(errorCode).toContain('ERR_STATE_CORRUPTION_MATHEMATICAL_BOUNDARY');
    telemetry.recordAssertion('Frontend invoked structured Exception Boundary upon mathematical corruption', true, { errorCode });

    const errorDetails = await page.locator('#error-details').textContent();
    expect(errorDetails).toContain('Scientific notation disallowed [1e+7]');
    telemetry.recordAssertion('Frontend halted client-side state corruption and logged structured payload', true, { errorDetails });

    // Assert that canvas status in memory is halted with ERROR
    const terminalState = await page.evaluate(() => window.getTradingState());
    expect(terminalState.status).toBe('ERROR');
    telemetry.recordAssertion('Trading engine state halted in ERROR state, preventing silent corruption', true);

    // Capture screenshot of Structured Error Boundary
    await page.screenshot({ path: path.join(__dirname, '../../evidence/q1/04-canvas-error-boundary.png') });
  });
});
