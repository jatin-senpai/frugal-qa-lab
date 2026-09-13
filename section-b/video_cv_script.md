# Q23. Video Evaluation Presentation (Video CV Script)
**Target Duration:** Exactly 2 to 3 minutes (approx. 320–380 words spoken at a calm, confident, professional pace).  
**Tone:** Articulate, systems-focused, technically defensible, humble yet deeply authoritative.

---

### [00:00 – 00:40] Part 1: Redefining the AI-Native Software Engineer
*(Camera: Professional eye contact, well-lit frame, clear audio)*

> "Hello, my name is Jatin, and I am excited to present my vision for the AI-Native Software Engineer role at Frugal Testing.
>
> In an era where generative models can produce syntactically valid code in seconds, the definition of an engineer has fundamentally changed. The bottleneck is no longer typing syntax—it is **deterministic system specification, architectural boundary enforcement, and verification**. 
>
> An AI-Native Engineer does not treat AI as a magic black-box. Instead, we act as rigorous systems architects. We understand that probabilistic models optimize for fluency, not correctness. Our job is to construct the verification scaffolding—such as AST-driven test selection, mutation testing, and invariant state checkers—that turns probabilistic AI output into deterministic, production-grade software."

---

### [00:40 – 01:25] Part 2: Complex Technical Challenge & Undocumented Behaviors
*(Natural, confident transition into concrete systems experience)*

> "Recently, when architecting the **Frugal QA Lab** quality testbed, I encountered a classic asynchronous race failure. In the Canvas automation suite, incoming WebSocket orderbook ticks were subjected to a scaling Fibonacci delay model. 
>
> Naive DOM testing was impossible because the application rendered directly to raw HTML5 Canvas pixels. Standard pixel scanning initially triggered false positives by picking up adjacent candlestick chart lines rather than the target button. 
>
> Rather than relying on fragile arbitrary sleeps, I engineered an embedded `requestAnimationFrame` contour-detection engine. It polls the canvas context directly, verifies the initial gray loading threshold, and detects the active color transition. I then wrapped the subsequent chained mouse action—hover, drag 15 pixels, and click—inside a dynamic coordinate circuit-breaker that re-samples coordinates to prevent blind clicks during layout shifts, executing strictly within the 30-to-100 millisecond race window."

---

### [01:25 – 02:10] Part 3: Balancing GenAI Velocity with Security & Quality
*(Addressing security, context isolation, and dependency hygiene)*

> "To leverage generative AI without compromising security or architectural coherence, I practice **Zero-Trust Model Context Protocol (MCP) design**. 
>
> First, I never grant AI agents raw, unconstrained shell access. In my technical article for this assessment, I designed a hardened MCP sandbox using Linux namespaces, seccomp syscall filtering, and typed JSON schemas with explicit regex paths to prevent arbitrary code execution.
>
> Second, I prevent context fragmentation through structured single-turn Few-Shot prompts rather than multi-turn conversational drift. 
>
> Third, every AI suggestion undergoes strict deterministic gatekeeping: linters, typecheckers, dependency audits, and 100% locally reproducible test suites before a single line is committed."

---

### [02:10 – 02:50] Part 4: Solving Ambiguous Problems Without GenAI
*(Demonstrating first-principles engineering and debugging rigor)*

> "If generative AI were completely unavailable tomorrow, my problem-solving methodology remains grounded in first principles. 
>
> When faced with high ambiguity, I never guess:
> 1. I isolate the failing component into an isolated, reproducible local sandbox.
> 2. I map out the system boundaries using distributed tracing, network packet inspection, and memory dumps.
> 3. I formulate falsifiable hypotheses and write minimal reproduction test cases.
> 
> For example, when debugging connection pool timeouts, I don't look for AI opinions—I inspect HikariCP MBean telemetry, analyze thread dumps for blocked database lock states, and tune connection-to-core ratios empirically.
>
> AI accelerates my execution speed, but rigorous engineering logic, deep curiosity, and quality craftsmanship are how I solve problems. Thank you for your time, and I look forward to contributing to Frugal Testing."

---

### Video Delivery Checklist for Recording:
- [ ] Record in 1080p, well-lit background, landscape orientation.
- [ ] Practice 2–3 times with a stopwatch to hit between 2:15 and 2:45.
- [ ] Upload video to Google Drive.
- [ ] **Crucial:** Set permissions to *"Anyone with the link can view"*.
- [ ] Paste the shareable URL into the designated placeholder in the final submission document.
