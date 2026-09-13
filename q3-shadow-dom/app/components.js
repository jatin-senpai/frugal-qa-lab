// Frugal QA Lab — Q3 Multi-Level Nested Web Components with Dynamic Obfuscation

// Helper: Generate randomized obfuscated class string on every page reload
function generateObfuscatedClass() {
  const salt = Math.random().toString(36).substring(2, 7);
  return `obfuscated_v4_${salt}`;
}

// 1. Level 1: <enterprise-portal> (Open Shadow Root)
class EnterprisePortal extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    const dynamicClass = generateObfuscatedClass();

    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 24px;
          background: #0f172a;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          width: 500px;
        }
        .portal-banner {
          font-size: 12px;
          font-family: ui-monospace, monospace;
          color: #64748b;
          margin-bottom: 16px;
        }
      </style>
      <div class="portal-banner">ENTERPRISE GATEWAY HOST // ROOT LAYER</div>
      <payment-terminal class="${dynamicClass}"></payment-terminal>
    `;
  }
}
customElements.define('enterprise-portal', EnterprisePortal);

// 2. Level 2: <payment-terminal> (Closed Shadow Root)
class PaymentTerminal extends HTMLElement {
  connectedCallback() {
    // Standard specification: mode is closed unless test harness explicitly sets mode
    const mode = window.__TEST_HARNESS_FORCE_OPEN__ ? 'open' : 'closed';
    const shadow = this.attachShadow({ mode });

    // Store private internal reference for test harness verification if attached
    if (window.__SHADOW_HARNESS_REGISTRY__) {
      window.__SHADOW_HARNESS_REGISTRY__.set(this, shadow);
    }

    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px dashed #334155;
          padding: 16px;
          border-radius: 6px;
          background: #1e293b;
        }
        .terminal-header {
          font-size: 11px;
          font-family: ui-monospace, monospace;
          color: #f59e0b;
          margin-bottom: 12px;
        }
      </style>
      <div class="terminal-header">SEALED BOUNDARY // PAYMENT TERMINAL (#shadow-root: ${mode})</div>
      <security-sandbox id="iframe-sandbox-wrapper"></security-sandbox>
    `;
  }
}
customElements.define('payment-terminal', PaymentTerminal);

// 3. Level 3: <security-sandbox> (Open Shadow Root)
class SecuritySandbox extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          background: #0f172a;
          padding: 16px;
          border-radius: 4px;
          border: 1px solid #3b82f6;
        }
        .trigger-finalize {
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
          font-family: ui-monospace, monospace;
        }
        .trigger-finalize:hover {
          background: #1d4ed8;
        }
        .trigger-finalize[data-qa-state="settled"] {
          background: #10b981;
        }
      </style>
      <button
        class="trigger-finalize"
        data-qa-state="unlocked-token"
        role="button"
        aria-label="Authorize Ledger Funds"
        aria-live="polite"
        aria-description="Submits finalized transaction to the core ledger"
      >
        Authorize Ledger Funds
      </button>
    `;

    const btn = shadow.querySelector('button');
    btn.addEventListener('click', () => {
      btn.setAttribute('data-qa-state', 'settled');
      btn.textContent = 'Ledger Funds Authorized ✓';
      btn.style.background = '#059669';

      window.dispatchEvent(new CustomEvent('frugal:ledger-authorized', {
        bubbles: true,
        composed: true,
        detail: {
          timestamp: Date.now(),
          component: 'security-sandbox',
          state: 'settled',
          token: 'TK_AUTH_LEDGER_CONFIRMED'
        }
      }));
    });
  }
}
customElements.define('security-sandbox', SecuritySandbox);
