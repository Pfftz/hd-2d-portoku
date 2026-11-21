# MCP Tool Routing & Execution Profile

To maximize accuracy, eliminate hallucinations, and conserve context tokens, strictly follow this decision matrix and execution protocol for every task.

## Installed MCP Inventory

1. **ESLint**: Code quality, formatting, syntax checking, and linting.
2. **context7**: Specialized, version-indexed slice for official library and framework documentation.
3. **exa**: Semantic, neural web search engine optimized for developer communities, codebases, and repositories.
4. **parallel-search**: Broad internet search engine optimized for multi-source synthesis, deep extraction, and complex page layouts.
5. **sequential-thinking**: Multi-step, systematic reasoning engine for breaking down architectural or complex logic problems.
6. **n8n**: Workflow automation engine for triggering external workflows or integration pipelines.

---

## Tool Selection & Routing Matrix

Before calling a tool, match the intent to the exact scenario below. Do not guess or use generalized search tools if a specialized tool is available.

| Category / Intent | Best Tool | Triggering Scenario | Execution Rule |
| :--- | :--- | :--- | :--- |
| **Official Syntax & APIs** | `context7` | Framework updates (v2 → v3), installing packages, verifying official function/method signatures, checking native SDK usage. | Always try `context7` first for library specs to avoid deprecated Stack Overflow answers. |
| **Bugs, Errors & Code Search** | `exa` | Terminal stack traces, obscure error codes, locating GitHub issues, pulling working repository examples, finding alternative community packages. | Pass the literal error message or conceptual code block into `exa` to bypass SEO-heavy landing pages. |
| **Deep Research & Analysis** | `parallel-search` | Comparing pricing plans, feature matrices of 3+ products, extracting data from JavaScript-heavy Single Page Apps (SPAs), summarizing multi-page architectural series. | State a clear research objective; allow it to run multi-step web fetches to build a unified report. |
| **Complex Logic / Design** | `sequential-thinking` | Writing complex algorithms, designing schemas, diagnosing intricate asynchronous race conditions, heavy code refactoring. | Run a sequence of thinking steps *before* emitting the first line of code. |
| **Code Refactoring & Health** | `ESLint` | Finalizing code generation, cleaning up imports, fixing unused variables, checking type enforcement, ensuring project code styling rules. | Run linting validation on newly generated or edited code blocks to guarantee clean execution. |
| **External Automations** | `n8n` | Triggering deployment hooks, syncing task updates, executing automated scripts across linked web applications. | Call only when explicitly tasked with running workflows, triggers, or external node webhooks. |

---

## Multi-Tool Chaining Protocols

When a task transitions through different states of complexity, string tools together sequentially and finish the chain before answering.

### Protocol A: The "New Implementation" Chain
*Use case: Implementing a new library or external framework feature.*
1. **`context7`** → Pull exact, current API signatures and official setup patterns.
2. **`sequential-thinking`** → Plan the application architecture, data flow, and file layout based on those specs.
3. **`ESLint`** (post-generation) → Run lint checks against freshly written code blocks to eliminate structural or syntax defects.

### Protocol B: The "Breaking Bug / Production Crash" Chain
*Use case: Fixing an obscure error thrown by local console or runtime.*
1. **`exa`** → Query the precise terminal error message to find matching GitHub Issues or community workarounds.
2. **`sequential-thinking`** → Evaluate why that bug applies to the local environment and trace the failure point systematically.
3. **`ESLint`** → Validate that the patch conforms cleanly to linting requirements without introducing regressions.

### Protocol C: The "Tech Stack Evaluation" Chain
*Use case: Selecting a new utility package, service provider, or third-party API.*
1. **`parallel-search`** → Scrape and extract features, limits, and trade-offs across competing options.
2. **`exa`** → Search developer communities or GitHub repositories to cross-reference practical sentiment and reliability issues.
3. **`sequential-thinking`** → Draft a structured pros/cons analysis mapping directly to the current project's constraints.

---

## Absolute Operational Restrictions

- **No Outdated Overlaps:** Never use `parallel-search` or general internet search tools to guess framework functions if `context7` handles that specific package registry.
- **Token Efficiency:** When using `parallel-search` or `exa`, pass precise parameters so the servers return pre-trimmed, token-dense fragments. Avoid loading massive, unformatted raw HTML blocks directly into the main context window.
- **Think First:** If the task involves high-risk code refactoring or multi-file architectural shifts, do not write code without first invoking at least 3 steps of `sequential-thinking`.

---

## Graphify (Agent-Only Comprehension)

- Use `graphify` (`~/.local/bin/graphify`) to understand the codebase, its architecture, and cross-file dependencies.
- If `graphify-out/` exists, query it first for architecture and file-relationship questions, and refresh it after each completed slice.
- Its output (`graphify-out/`) is git-ignored and is strictly for agent comprehension — never treat it as a user-facing deliverable.
- There is no application source code yet; run the first graph build after Slice 1 is implemented.

## Live MCP Discovery

- At the start of a task, inspect `~/.gemini/antigravity/mcp/` to see installed MCP servers, and use only servers that are actually exposed in the active session (for example, `context7_context7` when `context7` is registered under that server name).
- If a routed server is missing or disabled in the current session, state that explicitly and fall back to the next-best available tool (`context7` → `exa` → `search_web`). Never fake or hallucinate a tool call.

## Other Installed Servers Relevant to This Project

- **`chrome_devtools`** (when enabled in the session): WebGL runtime inspection, FPS profiling, shader/console error checks against the Vite dev server.
- **`firecrawl`** (when enabled in the session): Fallback for heavy web page extraction if `parallel-search` or `exa` cannot parse a target page.
- **Out of scope unless requested:** `notion`, `firebase`, `dart-mcp-server`, `zotero`, `laporan`, and `science_biomolecular_structure_viewer_mcp` are unrelated to this portfolio repository and should not be invoked unless explicitly asked.

## Project Mapping

- **Three.js / Vite / Postprocessing APIs (`EffectComposer`, shaders, `InstancedMesh`, `FogExp2`):** Route to `context7` (`context7_context7`).
- **GLSL Shader compilation errors, WebGL context warnings, or Vite bundling issues:** Route to `exa`.
- **TypeScript linting & code hygiene:** Run `ESLint` (`lint-files`) on every edited `.ts` / `.tsx` file once `eslint.config.*` exists (introduced during Slice 1 scaffolding).
