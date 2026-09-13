// Frugal QA Lab — Q3 Shadow DOM Host Server
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createQ3Server(port = 3003) {
  const app = express();
  const server = http.createServer(app);

  app.use(express.static(path.join(__dirname, '../app')));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'q3-shadow-dom-gateway' });
  });

  const stop = () => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  };

  return { app, server, stop };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3003;
  const { server } = createQ3Server(PORT);
  server.listen(PORT, () => {
    console.log(`[Q3 Server] Shadow DOM Gateway running on http://localhost:${PORT}`);
  });
}
