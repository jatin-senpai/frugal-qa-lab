// Frugal QA Lab — Fibonacci Network Chaos & Jitter Engine

export class FibonacciJitterModel {
  constructor(maxCapMs = 8000) {
    this.maxCapMs = maxCapMs;
    this.fibCache = [1, 1];
    this.currentStep = 0;
  }

  getFib(n) {
    while (this.fibCache.length <= n) {
      const len = this.fibCache.length;
      this.fibCache.push(this.fibCache[len - 1] + this.fibCache[len - 2]);
    }
    return this.fibCache[n];
  }

  nextDelay() {
    const fibVal = this.getFib(this.currentStep);
    const delay = Math.min(1000 * fibVal, this.maxCapMs);
    this.currentStep++;
    return {
      step: this.currentStep,
      fibVal,
      delayMs: delay
    };
  }

  reset() {
    this.currentStep = 0;
  }
}

/**
 * Injects in-browser WebSocket message interception into the target page.
 * Uses the Fibonacci delay model (1000ms * Fib(n), capped at 8000ms)
 * to delay incoming WebSocket message dispatch deterministically.
 */
export async function injectWebSocketChaos(page, options = {}) {
  const maxCapMs = options.maxCapMs || 8000;

  await page.addInitScript(({ maxCapMs }) => {
    window.__networkChaosTelemetry = [];

    const OrigWebSocket = window.WebSocket;
    const fibCache = [1, 1];
    let step = 0;

    function getNextDelay() {
      while (fibCache.length <= step) {
        const len = fibCache.length;
        fibCache.push(fibCache[len - 1] + fibCache[len - 2]);
      }
      const delay = Math.min(1000 * fibCache[step], maxCapMs);
      const record = { step: step + 1, fib: fibCache[step], delayMs: delay };
      step++;
      return record;
    }

    window.WebSocket = function(url, protocols) {
      const ws = new OrigWebSocket(url, protocols);

      // Wrap addEventListener and onmessage
      let customOnMessage = null;
      Object.defineProperty(ws, 'onmessage', {
        get() {
          return customOnMessage;
        },
        set(handler) {
          customOnMessage = handler;
        }
      });

      ws.addEventListener('message', (event) => {
        const jitter = getNextDelay();
        const receivedAt = performance.now();

        const logEntry = {
          eventType: 'WS_FRAME_INTERCEPTED',
          step: jitter.step,
          fibValue: jitter.fib,
          injectedDelayMs: jitter.delayMs,
          receivedAt,
          dispatchedAt: null,
          payloadPreview: typeof event.data === 'string' ? event.data.slice(0, 80) : '[binary data]'
        };

        window.__networkChaosTelemetry.push(logEntry);

        // Queue dispatch according to Fibonacci delay
        setTimeout(() => {
          logEntry.dispatchedAt = performance.now();
          if (typeof customOnMessage === 'function') {
            customOnMessage.call(ws, event);
          }
        }, jitter.delayMs);
      });

      return ws;
    };

    window.WebSocket.prototype = OrigWebSocket.prototype;
    window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
    window.WebSocket.OPEN = OrigWebSocket.OPEN;
    window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
    window.WebSocket.CLOSED = OrigWebSocket.CLOSED;
  }, { maxCapMs });
}

export async function extractChaosTelemetry(page) {
  return await page.evaluate(() => window.__networkChaosTelemetry || []);
}
