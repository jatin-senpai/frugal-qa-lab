// Frugal QA Lab — Q3 Resilient Shadow DOM Piercing & Boundary Exploration

/**
 * Resilient recursive Shadow DOM walker.
 * Traverses nested open shadow roots dynamically without hardcoding obfuscated
 * class names, stable IDs, absolute XPaths, or exact text strings.
 */
export async function findElementAcrossOpenShadowRoots(page, targetMatcher) {
  return await page.evaluateHandle((matcherConfig) => {
    function matches(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

      // Match by ARIA role or functional attribute
      if (matcherConfig.role && el.getAttribute('role') === matcherConfig.role) return true;
      if (matcherConfig.ariaLabel && el.getAttribute('aria-label') === matcherConfig.ariaLabel) return true;
      if (matcherConfig.qaState && el.getAttribute('data-qa-state') === matcherConfig.qaState) return true;
      if (matcherConfig.tagName && el.tagName.toLowerCase() === matcherConfig.tagName.toLowerCase()) return true;

      return false;
    }

    function searchTree(node) {
      if (!node) return null;

      // Check current node
      if (matches(node)) return node;

      // If node has a shadow root, pierce into it
      if (node.shadowRoot) {
        const foundInShadow = searchTree(node.shadowRoot);
        if (foundInShadow) return foundInShadow;
      }

      // Search child nodes
      for (const child of node.children || []) {
        const foundInChild = searchTree(child);
        if (foundInChild) return foundInChild;
      }

      return null;
    }

    return searchTree(document.body);
  }, targetMatcher);
}

/**
 * Injects a pre-execution test harness hook into the browser runtime via addInitScript.
 * This bridges the closed Shadow DOM boundary by preserving an internal WeakMap registry
 * of shadow roots or forcing mode: 'open' within test environments.
 */
export async function injectShadowHarnessHook(page, options = { forceOpen: true }) {
  await page.addInitScript(({ forceOpen }) => {
    window.__SHADOW_HARNESS_REGISTRY__ = new Map();

    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
      const mode = forceOpen ? 'open' : init.mode;
      const root = origAttachShadow.call(this, { ...init, mode });
      window.__SHADOW_HARNESS_REGISTRY__.set(this, root);
      return root;
    };
  }, options);
}

/**
 * Architectural specification of the W3C Closed Shadow DOM Boundary
 */
export const CLOSED_SHADOW_DOM_ANALYSIS = {
  specification: 'W3C DOM Level 4 & Shadow DOM v1 Specification',
  securityBoundary: 'Element.attachShadow({ mode: "closed" }) forces element.shadowRoot to strictly evaluate to null outside the constructor closure. Browser C++ DOM bindings (V8/Blink, WebKit) enforce encapsulation so no standard webpage runtime JavaScript can pierce a closed root.',
  naiveFallacies: [
    'Claiming ordinary document.querySelector or Element.prototype.shadowRoot can access closed shadow trees.',
    'Relying on transient obfuscated class names (e.g. .obfuscated_v4_x89a) that regenerate on reload.',
    'Using absolute XPath expressions (/html/body/enterprise-portal/...) which break at every shadow boundary.'
  ],
  viableEngineeringStrategies: [
    {
      name: 'Pre-Execution Test Harness Injection',
      mechanism: 'Monkey-patching Element.prototype.attachShadow before any web components are loaded to force open mode or record roots into a private test registry.',
      defensibility: 'Standard practice in test runners (e.g. Playwright init scripts, Jest/JSDOM test harnesses).'
    },
    {
      name: 'Chrome DevTools Protocol (CDP) Piercing',
      mechanism: 'Using CDP commands (DOM.describeNode, DOM.resolveNode, Runtime.evaluate) with pierce: true, bypassing JavaScript execution context boundaries at the browser engine level.',
      defensibility: 'Operates out-of-band directly within the browser automation protocol.'
    },
    {
      name: 'Accessibility Tree Refactoring (AXTree / getByRole)',
      mechanism: 'Locating elements via their semantic accessibility role and properties (e.g. role: button, name: "Authorize Ledger Funds"). The OS Accessibility Tree is completely decoupled from DOM encapsulation and flattens closed shadow roots.',
      defensibility: 'Highest industry standard for user-centric and resilient test automation.'
    }
  ]
};
