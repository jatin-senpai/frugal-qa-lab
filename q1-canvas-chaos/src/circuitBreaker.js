// Frugal QA Lab — Coordinate Resilience & Dynamic Circuit Breaker Macro

/**
 * Wraps canvas interaction in a resilient circuit-breaker macro that dynamically
 * detects coordinate drift, stale frames, or repaint delays, revalidating and
 * recalculating offsets before committing actions.
 */
export class CoordinateCircuitBreaker {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.revalidationTolerancePx = options.revalidationTolerancePx || 5;
    this.state = 'CLOSED'; // CLOSED (normal), TRIPPED (drift/stale detected), RECOVERED
    this.trippedCount = 0;
  }

  /**
   * Samples pixel at specific canvas coordinate to verify target state
   */
  async samplePixelState(page, canvasSelector, canvasX, canvasY) {
    return await page.evaluate(({ selector, x, y }) => {
      const canvas = document.querySelector(selector);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      const isActive = pixel[1] > 180 && pixel[0] < 80; // Greenish active target
      return {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        isActive
      };
    }, { selector: canvasSelector, x: canvasX, y: canvasY });
  }

  /**
   * Scans canvas to find current active coordinate if drift occurred
   */
  async recalculateActiveCoordinates(page, canvasSelector) {
    return await page.evaluate((selector) => {
      const canvas = document.querySelector(selector);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let count = 0;

      for (let y = 180; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const idx = (y * canvas.width + x) * 4;
          if (imgData[idx + 1] > 180 && imgData[idx] < 80) {
            count++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (count > 20 && (maxX - minX) >= 60 && (maxY - minY) >= 20) {
        return {
          found: true,
          centerX: Math.round((minX + maxX) / 2),
          centerY: Math.round((minY + maxY) / 2),
          driftDetected: true
        };
      }
      return { found: false };
    }, canvasSelector);
  }

  /**
   * Executes guarded action with pre-flight and in-flight revalidation
   */
  async executeGuardedAction(page, initialTargetCoords, actionFn, options = {}) {
    const canvasSelector = options.canvasSelector || '#trading-canvas';
    let currentCoords = { ...initialTargetCoords };

    // 1. Pre-flight verification (offset by 14px to sample button padding rather than text glyph)
    const preCheck = await this.samplePixelState(page, canvasSelector, currentCoords.centerX, currentCoords.centerY - 14);
    
    if (!preCheck || !preCheck.isActive) {
      this.state = 'TRIPPED';
      this.trippedCount++;
      // Coordinate drift or stale frame detected before action start
      const recovery = await this.recalculateActiveCoordinates(page, canvasSelector);
      if (recovery.found) {
        currentCoords.centerX = recovery.centerX;
        currentCoords.centerY = recovery.centerY;
        this.state = 'RECOVERED';
      } else {
        throw new Error('Circuit Breaker Failed: Target pixel inactive and recovery scan found no active target.');
      }
    }

    // 2. Execute wrapped action with latest resolved coordinates
    const actionResult = await actionFn(currentCoords);

    // 3. Post-action verification
    return {
      circuitBreakerState: this.state,
      trippedCount: this.trippedCount,
      resolvedCoordinates: currentCoords,
      actionResult
    };
  }
}
