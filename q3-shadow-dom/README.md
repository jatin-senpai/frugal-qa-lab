# Q3: Sealed Closed-Boundary Shadow DOM Pathfinding & Accessibility Tree Refactoring

**Component**: Frugal QA Lab — Q3 Shadow DOM & Accessibility Refactoring  
**Score Weight**: 1 Point  
**Technologies**: Web Components (Custom Elements v1), Shadow DOM (Open & Closed), Playwright, W3C Accessibility Tree (AXTree)

---

## 1. Architectural Overview & The Challenge

Modern enterprise single-page applications and micro-frontends heavily encapsulate security-sensitive UI components (e.g. payment buttons, authorization controls) inside multi-level nested Shadow DOM boundaries with dynamic, obfuscated class names that regenerate on every build or page reload (e.g., `<payment-terminal class="obfuscated_v4_x89a">`).

Furthermore, components configured with `#shadow-root (closed)` present a strict browser runtime security boundary.

```
<enterprise-portal id="root-gateway">
  └── #shadow-root (open)
        └── <payment-terminal class="obfuscated_v4_x89a">  <-- Dynamic regenerating class
              └── #shadow-root (closed)                   <-- Browser runtime security boundary
                    └── <security-sandbox id="iframe-sandbox-wrapper">
                          └── #shadow-root (open)
                                └── <button class="trigger-finalize" role="button" aria-label="Authorize Ledger Funds">
```

---

## 2. Technical Solutions & Defensibility

### 2.1 Resilient Open Shadow Root Piercing
- **Failure Mode of Naive Automation**: Relying on static CSS classes (`.obfuscated_v4_x89a`) or absolute XPaths fails immediately upon reload because class hashes mutate and XPaths cannot cross shadow boundaries.
- **Deterministic Solution**: A recursive tree walker (`src/shadowPiercer.js`) that descends through `element.shadowRoot` properties, matching functional ARIA roles (`role="button"`) and state contracts (`data-qa-state="unlocked-token"`).

### 2.2 The Browser Closed-Boundary Security Reality
- **W3C Specification Truth**: By browser design, calling `element.shadowRoot` on a closed boundary returns `null`. Page-level runtime JavaScript cannot pierce a closed shadow tree once created.
- **Three Viable Engineering Approaches**:
  1. **Pre-Execution Test Harness Injection**: In test environments, monkey-patch `Element.prototype.attachShadow` via Playwright `addInitScript` to force open mode or record roots into an internal test registry.
  2. **Chrome DevTools Protocol (CDP)**: Utilizing `DOM.describeNode` / `DOM.resolveNode` with `pierce: true`, operating below the JS execution context at the browser engine level.
  3. **Out-of-Band Accessibility Tree (AXTree) Resolution via CDP**: Proving that in-page DOM locators (`getByRole`) evaluate to `isVisible() === false` inside closed shadow roots, while Chromium's native accessibility engine constructs the accessibility tree across all roots. Utilizing CDP (`Accessibility.getFullAXTree` + `DOM.getBoxModel`) resolves the node and clicks via native layout coordinates without DOM piercing.

### 2.3 Dense CoT System Prompt (`src/systemPromptCoT.md`)
Trains an LLM to exclusively reason from the computed OS Accessibility Tree (`AXRole`, `AXName`, `AXState`, `AXLiveRegion`, structural parent-child relationships), strictly forbidding:
- IDs
- CSS classes
- Absolute XPaths
- Raw text matching
- HTML/CSS tag assumptions.

---

## 3. How to Execute & Verify

Run the dedicated test suite from `frugal-qa-lab/`:

```bash
# Run Q3 Playwright suite
npm run test:q3
```

### Generated Evidence Artifacts:
- `evidence/q3/01-shadow-dom-pierced.png`
- `evidence/q3/02-accessibility-tree-authorized.png`
- `evidence/q3/results.json`
- `evidence/q3/execution.log`

---

## 4. Video Walkthrough Plan (Mandatory Checkpoints)

1. **Checkpoint 1: The Output Window**
   - Run `npm run test:q3`.
   - Show all 3 tests passing:
     - Open shadow root piercing with obfuscated class validation
     - Closed shadow root boundary proof (`element.shadowRoot === null`)
     - OS Accessibility tree pathfinding and state mutation.

2. **Checkpoint 2: The Source Code**
   - Walk through `app/components.js` (nested web components, dynamic class generator).
   - Walk through `src/shadowPiercer.js` (recursive tree walker, closed boundary analysis).
   - Review `src/systemPromptCoT.md` (CoT prompt architecture for LLMs).

3. **Checkpoint 3: GenAI Usage & Prompt History**
   - Display prompt queries formulating the recursive tree walker and closed shadow DOM testability strategies.
   - Show prompt iterations refining the 5-phase CoT system prompt for OS Accessibility Tree navigation.
