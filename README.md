# OpenRouter Performance Tester (ORPT) — Preview

Benchmark OpenRouter models with transparent speed, latency, cost, and reliability analytics. Designed for practitioners who need reproducible evidence, not anecdotes.

Badges
- Preview release • VS Code ≥ 1.74 • MIT License • PRs welcome

Table of contents
- Why ORPT
- Features
- Quick start
- Workflows
  - Single test (ad‑hoc)
  - Benchmark Suites (full runs)
  - Recommendation Wizard (quick screening)
  - Exports (MD/CSV/PDF)
- Analytics explained
- Providers and models (accuracy)
- Custom suites (JSON)
- Security and privacy
- Requirements and settings
- Troubleshooting
- Roadmap (Preview → Stable)
- Contributing and license

Why ORPT
- Honest measurements: tokens/sec (TPS), time to first token (TTFB), total time, cost, success rate.
- Repeatable methodology: predefined suites for apples‑to‑apples comparisons.
- Practical UX: progress indicators, quick screening, and executive exports.

Features
- Secure API key management
  - Stored with VS Code SecretStorage (encrypted at rest, OS keychain‑backed). Never written to files or logs.
- Dynamic model/provider support
  - Models fetched from OpenRouter; provider list scoped per selected model via /api/v1/models/{id}/endpoints (with robust fallback mapping).
- Benchmark Suites (single model/provider at a time)
  - Aggregations: mean TPS, mean TTFB, mean total time, mean cost, std devs, success rate, total tokens.
  - Charts:
    - Bar: mean TPS per case with ±1 SD whiskers and reliability outline (green/amber/red by success rate)
    - Scatter: TTFB vs TPS; bubble size ~ mean cost/run; color ~ success rate
    - Radar: Speed, Latency, Cost, Consistency, Reliability
- Recommendation Wizard (multi‑model quick screen)
  - Multi‑select models, set constraints/weights, run a mini‑benchmark; Cancel anytime.
  - Ranked results with cost estimates.
- Exports
  - Executive Markdown report, raw results CSV, and PDF (when jsPDF is present).
- Suite Builder (experimental)
  - Create/edit/import/export suites as JSON. Custom suites merge with built‑ins and override by id.
- Inline help and progress
  - “?” badges explain sections at a glance; progress bars for suites and wizard runs.

Quick start
1) Install
   - VSIX: run npx vsce package, then code --install-extension openrouter-performance-tester-*.vsix, or install from Marketplace when available.
2) Open ORPT: “ORPT: Show ORPT Dashboard”.
3) API key: paste your OpenRouter key (sk‑or‑v1‑…), Save. Status turns Connected.
4) Select a model and provider in “Test Configuration”.
5) Run a suite (Benchmark Suites) or use the Recommendation Wizard for a quick compare.

Workflows

Single test (ad‑hoc)
- In Test Configuration:
  - Model: pick one (e.g., x‑ai/grok‑4)
  - Provider: pick exact endpoint or “auto”
  - Prompt and Max Tokens
- Click “Run Performance Test”.

Benchmark Suites (full runs)
- Select suite and iterations per case (the model/provider come from Test Configuration).
- Click “Run Suite”. You’ll see:
  - Summary cards with means
  - Bar/Scatter/Radar charts
  - Export buttons (Markdown/CSV/PDF; PDF requires jsPDF UMD)
- Suite Summary shows the exact model and provider used for the run.

Recommendation Wizard (quick screening)
- Select models in the multi‑select list (or Select All).
- Set constraints (budget per 1k, TTFB, TPS) and weights (speed/latency/cost).
- Click “Recommend”. Watch the progress bar; Cancel is available.
- Review ranked candidates with mean TPS/TTFB/Total and estimated cost.

Exports (MD/CSV/PDF)
- Markdown: human‑readable executive summary with per‑iteration table.
- CSV: raw per‑iteration results for spreadsheets.
- PDF: embeds charts and summary (button auto‑enables when jsPDF UMD is present at node_modules/jspdf/dist/jspdf.umd.min.js).

Analytics explained
- TPS (tokens/sec): throughput. Higher is better.
- TTFB (seconds): latency to first token. Lower is better.
- Total time (seconds): full request duration. Lower is better.
- Cost (USD): estimated using cached OpenRouter pricing where available.
- Success rate: fraction of successful iterations.
- Std devs: variability across iterations (e.g., std TPS).
- Bar chart: mean TPS per case, ±1 SD whiskers for variability, bar outline color = reliability (green 100%, amber 60–99%, red <60%).
- Scatter: TTFB (x) vs TPS (y), bubble size ~ mean cost/run, color ~ success rate.
- Radar: normalized 0..100 for Speed, (inverse) Latency, (inverse) Cost, (inverse) Variability, Reliability.

Providers and models (accuracy)
- On model change, ORPT calls /api/v1/models/{modelId}/endpoints to list its endpoints/providers.
- The provider dropdown shows only endpoints for that model (plus “auto”).
- If the endpoint API returns nothing, a safe fallback maps common prefixes (e.g., x‑ai → xAI, groq → Groq).

Custom suites (JSON)
- Built‑in suites live in media/suites.json.
- Create or edit with Suite Builder (experimental) and Save.
- Custom suites merge with built‑ins and override by id.

Minimal example
{
  "id": "custom-demo",
  "name": "Demo Suite",
  "iterations": 2,
  "cases": [
    { "id": "demo-1", "name": "Concise answer", "prompt": "Explain HTTP/2 in 2 sentences.", "params": { "max_tokens": 128, "temperature": 0.3 } }
  ]
}

Security and privacy
- API key is stored only via VS Code SecretStorage (encrypted at rest, OS keychain‑backed).
- Not persisted to files/settings/globalState; never logged.
- Used only as Authorization: Bearer for requests to openrouter.ai over HTTPS.
- No telemetry is collected by this extension.

Requirements and settings
- Requirements
  - VS Code 1.74+ and internet access
  - OpenRouter API key (sk‑or‑v1‑…)
- Settings
  - orpt.saveTestHistory (boolean, default true): save ad‑hoc test results to history
  - orpt.maxHistoryItems (number, default 100): cap history size

Troubleshooting
- Charts not visible:
  - Use the latest VSIX; ORPT loads Chart.js from node_modules/chart.js/dist/chart.umd.js in packaged builds.
  - If a chart shows “No data to display”, there were no successful datapoints to plot.
- Provider list looks wrong:
  - Change the model and wait for endpoints; the list is scoped to the selected model (plus “auto”).
- PDF export disabled:
  - Ensure jsPDF UMD is present (node_modules/jspdf/dist/jspdf.umd.min.js). Button auto‑enables when detected.
- Rate limiting:
  - OpenRouter or endpoints may throttle; reduce iterations or concurrency (suites run sequentially by design).

Roadmap (Preview → Stable)
- Quality scoring from reference outputs (starting with exact/heuristic checks for short answers).
- Weighted aggregations in suite metrics.
- Full multi‑model suite runner (batch entire suites across many models).
- Strongly typed message contracts, tests, and CI.
- Slimmer VSIX by moving vendor assets or bundling.

Contributing and license
- Issues/ideas: please open a GitHub issue.
- PRs welcome (Preview items above are a great place to start).
- License: MIT (see LICENSE).
