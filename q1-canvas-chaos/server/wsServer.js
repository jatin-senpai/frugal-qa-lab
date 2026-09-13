// Frugal QA Lab — Q1 WebSocket & Static Testbed Server
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createQ1Server(port = 3001) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../app')));

  let clients = new Set();
  let serverState = {
    status: 'LOADING',
    driftX: 0
  };

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const mode = url.searchParams.get('mode') || 'normal';
    const transitionDelay = parseInt(url.searchParams.get('delay') || '1200', 10);

    // Initial greeting
    ws.send(JSON.stringify({
      type: 'INIT',
      status: 'LOADING',
      message: 'Subscribed to ETH/USD high-frequency orderbook stream'
    }));

    // Start periodic ticks
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(tickInterval);
        return;
      }
      tickCount++;
      const price = 3450.50 + (Math.sin(tickCount) * 12);
      ws.send(JSON.stringify({
        type: 'TICK',
        tick: { seq: tickCount, price: price.toFixed(2), timestamp: Date.now() },
        latency: Math.floor(15 + Math.random() * 20)
      }));
    }, 100);

    // Mode handling
    if (mode === 'corrupt') {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'TICK',
            balance: '1e+7', // Scientific notation corruption
            contractSize: 12.3456789,
            corrupt: true
          }));
        }
      }, 500);
    } else {
      // Transition from LOADING to ACTIVE after transitionDelay ms
      const transitionTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          serverState.status = 'ACTIVE';
          ws.send(JSON.stringify({
            type: 'STATE_TRANSITION',
            status: 'ACTIVE',
            timestamp: Date.now()
          }));

          // If mode is drift, simulate coordinate drift 40ms later
          if (mode === 'drift') {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                serverState.driftX = 35;
                ws.send(JSON.stringify({
                  type: 'STATE_TRANSITION',
                  status: 'ACTIVE',
                  driftX: 35,
                  timestamp: Date.now()
                }));
              }
            }, 40);
          }
        }
      }, transitionDelay);

      ws.on('close', () => {
        clearTimeout(transitionTimer);
        clearInterval(tickInterval);
        clients.delete(ws);
      });
    }

    ws.on('close', () => {
      clearInterval(tickInterval);
      clients.delete(ws);
    });
  });

  // REST Control Endpoints
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', activeClients: clients.size, serverState });
  });

  app.post('/api/corrupt', (req, res) => {
    const payload = req.body || {
      type: 'TICK',
      balance: '1e+7',
      corrupt: true
    };
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }
    res.json({ status: 'corrupt_injected', clientsNotified: clients.size });
  });

  const stop = () => {
    for (const ws of clients) {
      try { ws.terminate(); } catch (e) {}
    }
    clients.clear();
    return new Promise((resolve) => {
      wss.close(() => {
        server.close(resolve);
      });
    });
  };

  return { app, server, wss, stop };
}

// Standalone execution entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3001;
  const { server } = createQ1Server(PORT);
  server.listen(PORT, () => {
    console.log(`[Q1 Server] Apex Canvas Terminal running on http://localhost:${PORT}`);
    console.log(`[Q1 Server] WebSocket streaming at ws://localhost:${PORT}/ws`);
  });
}
