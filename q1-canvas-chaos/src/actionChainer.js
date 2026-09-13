// Frugal QA Lab — Precision Chained Action Engine (30ms - 100ms Race Window)

/**
 * Fires the chained action sequence: Hover -> Drag 15px X-axis -> Click
 * inside the required 30ms - 100ms race window following pixel state detection.
 */
export async function executeChainedAction(page, targetCoords, detectionTimestamp, options = {}) {
  const canvasSelector = options.canvasSelector || '#trading-canvas';
  const dragDistancePx = options.dragDistancePx || 15;

  // Get canvas bounding box in viewport coordinates to map canvas (x, y) to viewport (clientX, clientY)
  const canvasBox = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }, canvasSelector);

  const startX = canvasBox.left + targetCoords.centerX;
  const startY = canvasBox.top + targetCoords.centerY;
  const targetX = startX + dragDistancePx;

  const actionStart = performance.now();
  const telemetry = {
    detectionTimestamp,
    actionStart,
    steps: []
  };

  // Step 1: Hover
  await page.mouse.move(startX, startY);
  const hoverTime = performance.now();
  telemetry.steps.push({ step: 'HOVER', timestamp: hoverTime, x: startX, y: startY });

  // Step 2: Mouse Down
  await page.mouse.down();
  const mouseDownTime = performance.now();
  telemetry.steps.push({ step: 'MOUSE_DOWN', timestamp: mouseDownTime });

  // Step 3: Drag 15px along X-axis
  await page.mouse.move(targetX, startY, { steps: 3 });
  const dragEndTime = performance.now();
  telemetry.steps.push({ step: 'DRAG_15PX_X', timestamp: dragEndTime, x: targetX, y: startY });

  // Step 4: Click (Mouse Up)
  await page.mouse.up();
  const actionEnd = performance.now();
  telemetry.steps.push({ step: 'MOUSE_UP_CLICK', timestamp: actionEnd });

  const totalElapsedSinceDetection = actionEnd - detectionTimestamp;
  const actionExecutionDuration = actionEnd - actionStart;

  telemetry.actionEnd = actionEnd;
  telemetry.totalElapsedSinceDetectionMs = totalElapsedSinceDetection;
  telemetry.actionExecutionDurationMs = actionExecutionDuration;
  telemetry.isWithinRaceWindow = totalElapsedSinceDetection >= 30 && totalElapsedSinceDetection <= 100;

  return telemetry;
}
