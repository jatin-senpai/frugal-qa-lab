// Frugal QA Lab — High-Frequency Canvas Rendering & State Engine

const canvas = document.getElementById('trading-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const errorBoundary = document.getElementById('canvas-error-boundary');
const errorDetails = document.getElementById('error-details');

// State Model
const state = {
  status: 'DISCONNECTED', // DISCONNECTED, LOADING, ACTIVE, EXECUTED, ERROR
  ticks: [],
  balance: 250000.00,
  target: {
    x: 480,
    y: 220,
    width: 220,
    height: 48,
    isHovered: false,
    isDragging: false,
    dragStartX: 0,
    dragDeltaX: 0,
    executed: false
  },
  metrics: {
    fps: 0,
    lastFrameTime: performance.now(),
    frameCount: 0,
    fpsUpdateInterval: 500,
    lastFpsUpdate: performance.now(),
    latency: 0
  },
  driftX: 0
};

// Colors
const COLOR_LOADING = { r: 120, g: 136, b: 150, hex: '#788896' };
const COLOR_ACTIVE = { r: 0, g: 230, b: 118, hex: '#00E676' };
const COLOR_EXECUTED = { r: 41, g: 121, b: 255, hex: '#2979FF' };
const COLOR_HOVER_BORDER = '#ffffff';

function logEvent(msg) {
  const list = document.getElementById('event-log-list');
  if (!list) return;
  const li = document.createElement('li');
  const now = new Date().toISOString().split('T')[1].slice(0, 12);
  li.textContent = `[${now}] ${msg}`;
  list.insertBefore(li, list.firstChild);
  if (list.children.length > 25) list.removeChild(list.lastChild);
}

// WebSocket Connection
let ws = null;
const urlParams = new URLSearchParams(window.location.search);
const wsPort = urlParams.get('wsPort') || '3001';
const wsUrl = `ws://${window.location.hostname}:${wsPort}/ws${window.location.search}`;

function connectWebSocket() {
  logEvent(`Connecting to ${wsUrl}...`);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    state.status = 'LOADING';
    document.getElementById('connection-status').innerHTML = `
      <span class="status-indicator loading"></span>
      <span id="status-label">STREAM SYNCING (LOADING)</span>
    `;
    logEvent('WebSocket connection established. Initializing canvas pipeline.');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleStreamMessage(data);
    } catch (err) {
      triggerErrorBoundary('ERR_STATE_CORRUPTION_PARSE_FAILURE', err.message, event.data);
    }
  };

  ws.onerror = (err) => {
    logEvent('WebSocket transport error encountered.');
  };

  ws.onclose = () => {
    if (state.status !== 'ERROR') {
      logEvent('WebSocket connection closed.');
    }
  };
}

// Strict Mismatched Server Boundary Checking
function validatePayload(payload) {
  // Check mathematical corruption: scientific notation strings or illegal float representations
  if (payload.balance !== undefined) {
    const rawVal = String(payload.balance);
    if (/[eE]/.test(rawVal)) {
      throw new Error(`Mathematical state boundary breach: Scientific notation disallowed [${rawVal}]`);
    }
    const num = Number(payload.balance);
    if (!Number.isFinite(num)) {
      throw new Error(`Mathematical state boundary breach: Non-finite balance [${rawVal}]`);
    }
    // Strict currency cents check (max 2 decimal places)
    const decimalParts = rawVal.split('.');
    if (decimalParts.length > 1 && decimalParts[1].length > 2) {
      throw new Error(`Precision corruption: Fractional balance exceeds 2 decimal places [${rawVal}]`);
    }
  }

  if (payload.type === 'CORRUPT_PAYLOAD' || payload.corrupt) {
    throw new Error(`Injected server corruption: [${JSON.stringify(payload)}]`);
  }
}

function handleStreamMessage(data) {
  // Validate incoming stream against server boundary specifications
  try {
    validatePayload(data);
  } catch (err) {
    triggerErrorBoundary('ERR_STATE_CORRUPTION_MATHEMATICAL_BOUNDARY', err.message, JSON.stringify(data, null, 2));
    return;
  }

  if (data.type === 'STATE_TRANSITION') {
    state.status = data.status; // e.g. ACTIVE
    if (data.driftX !== undefined) {
      state.driftX = data.driftX;
    }
    document.getElementById('connection-status').innerHTML = `
      <span class="status-indicator online"></span>
      <span id="status-label">STREAM ACTIVE (READY)</span>
    `;
    logEvent(`State transition: ${data.status} | Target active at (${getTargetCoords().centerX}, ${getTargetCoords().centerY})`);
  }

  if (data.type === 'TICK') {
    state.ticks.push(data.tick);
    if (state.ticks.length > 50) state.ticks.shift();
    if (data.latency) {
      state.metrics.latency = data.latency;
      document.getElementById('latency-metric').textContent = `${data.latency} ms`;
    }
  }
}

function triggerErrorBoundary(code, message, rawData) {
  state.status = 'ERROR';
  document.getElementById('connection-status').innerHTML = `
    <span class="status-indicator error"></span>
    <span id="status-label">CORRUPT STREAM HALTED</span>
  `;
  document.getElementById('execution-status-metric').textContent = 'HALTED (CORRUPTION)';
  document.getElementById('execution-status-metric').className = 'status-corrupt';

  errorDetails.textContent = `Exception: ${message}\n\nRaw Boundary Payload:\n${rawData}`;
  errorBoundary.classList.remove('hidden');
  logEvent(`[CRITICAL] Server Boundary Exception: ${code}`);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}

window.resetErrorBoundary = function() {
  errorBoundary.classList.add('hidden');
  state.status = 'DISCONNECTED';
  logEvent('Error boundary manually acknowledged.');
};

// Canvas Mouse / Action Handling
function getTargetCoords() {
  return {
    x: state.target.x + state.driftX,
    y: state.target.y,
    width: state.target.width,
    height: state.target.height,
    centerX: Math.round(state.target.x + state.driftX + state.target.width / 2),
    centerY: Math.round(state.target.y + state.target.height / 2)
  };
}

function isInsideTarget(px, py) {
  const t = getTargetCoords();
  return px >= t.x && px <= t.x + t.width && py >= t.y && py <= t.y + t.height;
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const inside = isInsideTarget(px, py);
  state.target.isHovered = inside;

  if (state.target.isDragging) {
    state.target.dragDeltaX = Math.max(0, px - state.target.dragStartX);
    document.getElementById('drag-metric').textContent = `${Math.round(state.target.dragDeltaX)} px`;
  }
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  if (isInsideTarget(px, py) && state.status === 'ACTIVE' && !state.target.executed) {
    state.target.isDragging = true;
    state.target.dragStartX = px;
    state.target.dragDeltaX = 0;
    logEvent(`Action chain start: MouseDown at (${px}, ${py})`);
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (state.target.isDragging) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (state.target.dragDeltaX >= 15 && isInsideTarget(px, py)) {
      state.target.executed = true;
      state.status = 'EXECUTED';
      document.getElementById('execution-status-metric').textContent = 'EXECUTED (ORDER FILLED)';
      document.getElementById('execution-status-metric').className = 'status-active';
      logEvent(`Action chain success: Dragged ${Math.round(state.target.dragDeltaX)}px & Clicked! Order executed.`);
    } else {
      logEvent(`Action aborted: Drag distance insufficient (${Math.round(state.target.dragDeltaX)}px < 15px)`);
    }
    state.target.isDragging = false;
  }
});

// Render Loop
function render(timestamp) {
  // FPS calculation
  state.metrics.frameCount++;
  if (timestamp - state.metrics.lastFpsUpdate >= state.metrics.fpsUpdateInterval) {
    state.metrics.fps = (state.metrics.frameCount * 1000) / (timestamp - state.metrics.lastFpsUpdate);
    document.getElementById('fps-metric').textContent = state.metrics.fps.toFixed(1);
    state.metrics.frameCount = 0;
    state.metrics.lastFpsUpdate = timestamp;
  }

  // Clear canvas
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Grid Lines
  ctx.strokeStyle = '#141c2b';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Header / Chart Area Mock
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(20, 20, 760, 160);
  ctx.fillStyle = '#00e676';
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText('ETH/USD PERPETUAL — 50ms ORDER FEED', 36, 45);

  // Draw simulated candlestick spikes
  ctx.strokeStyle = '#00e676';
  ctx.beginPath();
  let cx = 40;
  for (let i = 0; i < 30; i++) {
    const yVal = 100 + Math.sin(timestamp / 300 + i) * 20;
    ctx.lineTo(cx, yVal);
    cx += 24;
  }
  ctx.stroke();

  // Draw Target Order Confirmation Button
  const t = getTargetCoords();
  let fillColor = COLOR_LOADING.hex;
  let label = 'SYNCING STATE... (GRAY)';

  if (state.status === 'ACTIVE') {
    fillColor = COLOR_ACTIVE.hex;
    label = 'CONFIRM ORDER (DRAG 15px)';
  } else if (state.status === 'EXECUTED') {
    fillColor = COLOR_EXECUTED.hex;
    label = 'ORDER COMMITTED ✓';
  }

  // Drag visual offset
  const dragOffsetX = state.target.isDragging ? state.target.dragDeltaX : 0;

  // Background Box
  ctx.fillStyle = fillColor;
  ctx.fillRect(t.x + dragOffsetX, t.y, t.width, t.height);

  // Hover Highlight Border
  if (state.target.isHovered) {
    ctx.strokeStyle = COLOR_HOVER_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(t.x + dragOffsetX, t.y, t.width, t.height);
  }

  // Drag Track Indicator
  if (state.target.isDragging) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(t.x, t.y, t.width + 15, t.height);
    ctx.setLineDash([]);
  }

  // Button Label
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, t.x + dragOffsetX + t.width / 2, t.y + t.height / 2);

  // Update telemetry metrics in DOM
  document.getElementById('target-state-metric').textContent = state.status;
  document.getElementById('target-coords-metric').textContent = `(${t.centerX}, ${t.centerY})`;

  requestAnimationFrame(render);
}

// Start loop & WS
requestAnimationFrame(render);
connectWebSocket();

// Expose programmatic hooks for headless automation inspection
window.getCanvasTargetCoordinates = () => {
  const t = getTargetCoords();
  return {
    ...t,
    status: state.status,
    executed: state.target.executed,
    dragDeltaX: state.target.dragDeltaX
  };
};

window.getTradingState = () => state;
