import { test, expect } from '@playwright/test';
import { createQ3Server } from '../server/hostServer.js';
import { findElementAcrossOpenShadowRoots, injectShadowHarnessHook, CLOSED_SHADOW_DOM_ANALYSIS } from '../src/shadowPiercer.js';
import { ShadowTelemetry } from '../src/telemetry.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3003;
const BASE_URL = `http://localhost:${PORT}`;

test.describe('Q3: Sealed Closed-Boundary Shadow DOM Pathfinding & Accessibility Tree Refactoring', () => {
  let serverInstance = null;
  let telemetry;

  test.beforeAll(async () => {
    telemetry = new ShadowTelemetry('q3-shadow-dom');
    const srv = createQ3Server(PORT);
    serverInstance = srv;
    await new Promise((resolve) => srv.server.listen(PORT, resolve));
    console.log(`[Test Setup] Q3 Host Server active on ${BASE_URL}`);
  });

  test.afterAll(async () => {
    if (telemetry) {
      telemetry.exportEvidence([
        path.join(__dirname, '../artifacts'),
        path.join(__dirname, '../../evidence/q3')
      ]);
    }
    if (serverInstance && serverInstance.stop) {
      await serverInstance.stop();
      console.log('[Test Teardown] Q3 Server stopped.');
    }
  });

  test('Core Spec 1: Resilient Open Shadow DOM Traversal across Obfuscated Regenerating Classes', async ({ page }) => {
    telemetry.log('TEST_START', 'Testing open shadow root piercing without static IDs, classes, or text matching');

    // In harness mode, set test hook to expose roots
    await injectShadowHarnessHook(page, { forceOpen: true });
    await page.goto(BASE_URL);

    // Verify classes are indeed dynamically generated/obfuscated
    const dynamicClass = await page.evaluate(() => {
      const portal = document.querySelector('enterprise-portal');
      const terminal = portal.shadowRoot.querySelector('payment-terminal');
      return terminal ? terminal.className : null;
    });

    expect(dynamicClass).toMatch(/^obfuscated_v4_[a-z0-9]+$/);
    telemetry.log('OBFUSCATED_CLASS_VERIFIED', 'Detected regenerating dynamic class string on shadow host', { dynamicClass });
    telemetry.recordAssertion('Verified custom element uses dynamic regenerating class strings', true, { dynamicClass });

    // Traverse shadow hierarchy using semantic role and attribute matching
    const handle = await findElementAcrossOpenShadowRoots(page, {
      role: 'button',
      qaState: 'unlocked-token'
    });

    expect(handle).not.toBeNull();
    telemetry.recordAssertion('Resilient tree walker located target element across nested shadow roots without DOM selectors', true);

    // Click target
    await handle.asElement().click();

    // Verify ledger funds authorized event
    const authorized = await page.evaluate(() => window.__LEDGER_AUTHORIZED);
    expect(authorized).toBe(true);
    telemetry.recordAssertion('Successfully triggered action on pierced target and mutated ledger state', true);

    await page.screenshot({ path: path.join(__dirname, '../../evidence/q3/01-shadow-dom-pierced.png') });
  });

  test('Core Spec 2: Verification of Closed Shadow DOM Boundary & Testability Solutions', async ({ page }) => {
    telemetry.log('TEST_START', 'Validating W3C Closed Shadow DOM security boundary and harness solutions');

    // Load page with closed boundary intact (standard mode)
    await page.goto(BASE_URL);

    // Assert that standard page JS cannot pierce closed shadow root
    const rootEvaluation = await page.evaluate(() => {
      const portal = document.querySelector('enterprise-portal');
      const terminal = portal.shadowRoot.querySelector('payment-terminal');
      return {
        hasTerminal: Boolean(terminal),
        shadowRootValue: terminal ? terminal.shadowRoot : 'TERMINAL_NOT_FOUND'
      };
    });

    expect(rootEvaluation.hasTerminal).toBe(true);
    expect(rootEvaluation.shadowRootValue).toBeNull(); // Strictly null per W3C specification
    telemetry.recordAssertion('Confirmed browser enforces W3C closed boundary: element.shadowRoot evaluates strictly to null', true);

    telemetry.log('CLOSED_BOUNDARY_PROVEN', 'Standard runtime JS cannot access closed root without test harness or CDP', {
      spec: CLOSED_SHADOW_DOM_ANALYSIS.specification,
      boundary: CLOSED_SHADOW_DOM_ANALYSIS.securityBoundary
    });
  });

  test('Core Spec 3: OS Accessibility Tree Pathfinding & Closed Shadow DOM Boundary Verification', async ({ page }) => {
    telemetry.log('TEST_START', 'Resolving target control via pure OS Accessibility Tree semantics');

    // 1. Navigate to page with CLOSED shadow root (NO harness hook!)
    await page.goto(BASE_URL);

    // 2. Document the exact platform limitation:
    // Standard Playwright getByRole relies on in-page DOM script evaluation, which CANNOT see past closed shadow roots
    const standardLocator = page.getByRole('button', { name: 'Authorize Ledger Funds' });
    const isVisibleInDom = await standardLocator.isVisible();
    expect(isVisibleInDom).toBe(false);
    telemetry.recordAssertion('Verified platform limitation: Standard in-page DOM getByRole cannot penetrate closed shadow roots', true);

    // 3. True OS/Browser-level Accessibility Tree resolution via Chrome DevTools Protocol (CDP)
    // The browser engine (Blink) builds the OS accessibility tree across ALL shadow roots regardless of closed encapsulation
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    await cdp.send('DOM.enable');

    const axTree = await cdp.send('Accessibility.getFullAXTree');
    const axButtonNode = axTree.nodes.find(n => n.role?.value === 'button' && n.name?.value === 'Authorize Ledger Funds');
    expect(axButtonNode).toBeDefined();
    telemetry.recordAssertion('Blink Accessibility Engine successfully extracted button node across closed shadow root', true, {
      role: axButtonNode.role?.value,
      name: axButtonNode.name?.value,
      backendDOMNodeId: axButtonNode.backendDOMNodeId
    });

    // 4. Resolve layout quad and click via accessibility coordinates
    const box = await cdp.send('DOM.getBoxModel', { backendNodeId: axButtonNode.backendDOMNodeId });
    const content = box.model.content;
    const clickX = (content[0] + content[2]) / 2;
    const clickY = (content[1] + content[5]) / 2;

    await page.mouse.click(clickX, clickY);

    // Verify execution
    const isAuthorized = await page.evaluate(() => window.__LEDGER_AUTHORIZED);
    expect(isAuthorized).toBe(true);
    telemetry.recordAssertion('Successfully committed financial ledger action via native browser Accessibility Tree coordinates without DOM piercing', true);

    await page.screenshot({ path: path.join(__dirname, '../../evidence/q3/02-accessibility-tree-authorized.png') });
  });
});
