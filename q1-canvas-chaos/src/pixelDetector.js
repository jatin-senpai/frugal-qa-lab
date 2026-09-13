// Frugal QA Lab — Canvas Pixel-State Transition Detector

/**
 * Polls the Canvas rendering context via requestAnimationFrame to detect
 * the exact frame where pixel color transitions from gray loading state
 * to active element color layout.
 *
 * Strictly adheres to Anti-AI constraints:
 * - NO DOM locators
 * - NO visibility fluent polls
 * - NO static setTimeout / sleeps
 * - NO hardcoded bounding box assumptions
 */
export async function waitForCanvasPixelStateTransition(page, canvasSelector = '#trading-canvas', timeoutMs = 20000) {
  return await page.evaluate(async ({ selector, timeout }) => {
    const canvas = document.querySelector(selector);
    if (!canvas) throw new Error(`Target canvas element ${selector} not found in DOM`);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to acquire 2D rendering context from canvas');

    const startTime = performance.now();

    // Helper: test if pixel is active target color (Greenish: G > 180, R < 80)
    function isActiveTargetPixel(r, g, b) {
      return g > 180 && r < 80 && b < 160;
    }

    // Helper: test if pixel is gray loading state
    function isLoadingGrayPixel(r, g, b) {
      return Math.abs(r - 120) <= 25 && Math.abs(g - 136) <= 25 && Math.abs(b - 150) <= 25;
    }

    // Dynamic contour scan to locate button center in interactive zone (y >= 180)
    function scanActiveElementCoordinates() {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let activePixelCount = 0;

      // Sample grid in interactive lower zone (y >= 180) to ignore chart area
      for (let y = 180; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          if (isActiveTargetPixel(r, g, b)) {
            activePixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Valid button contour check
      if (activePixelCount > 30 && (maxX - minX) >= 60 && (maxY - minY) >= 20) {
        return {
          found: true,
          activePixelCount,
          bounds: { minX, maxX, minY, maxY },
          centerX: Math.round((minX + maxX) / 2),
          centerY: Math.round((minY + maxY) / 2)
        };
      }
      return { found: false };
    }

    return new Promise((resolve, reject) => {
      let initialGrayConfirmed = false;
      let frameCount = 0;

      function checkFrame() {
        frameCount++;
        const now = performance.now();
        if (now - startTime > timeout) {
          return reject(new Error(`Pixel state detection timed out after ${timeout}ms. Frames polled: ${frameCount}`));
        }

        // 1. Confirm canvas is initially rendering gray loading state in interactive zone
        if (!initialGrayConfirmed) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          let grayCount = 0;
          for (let y = 180; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
              const idx = (y * canvas.width + x) * 4;
              if (isLoadingGrayPixel(data[idx], data[idx + 1], data[idx + 2])) {
                grayCount++;
              }
            }
          }
          if (grayCount > 30) {
            initialGrayConfirmed = true;
          }
        }

        // 2. Scan for transition to active element color ONLY after gray loading confirmed
        if (initialGrayConfirmed) {
          const target = scanActiveElementCoordinates();
          if (target.found) {
            const transitionTime = performance.now();
            const sampleX = target.bounds.minX + 10;
            const sampleY = target.bounds.minY + 10;
            const sample = ctx.getImageData(sampleX, sampleY, 1, 1).data;
            return resolve({
              transitionTimestamp: transitionTime,
              elapsedSinceStartMs: transitionTime - startTime,
              polledFrames: frameCount,
              initialGrayConfirmed,
              targetCoordinates: {
                centerX: target.centerX,
                centerY: target.centerY,
                bounds: target.bounds,
                pixelCount: target.activePixelCount
              },
              sampledColor: {
                r: sample[0],
                g: sample[1],
                b: sample[2],
                a: sample[3]
              }
            });
          }
        }

        // Continue requestAnimationFrame loop
        requestAnimationFrame(checkFrame);
      }

      requestAnimationFrame(checkFrame);
    });
  }, { selector: canvasSelector, timeout: timeoutMs });
}
