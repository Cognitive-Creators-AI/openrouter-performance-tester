# OpenRouter Performance Tester (ORPT) — Preview

Measure model performance on OpenRouter with transparent speed, latency, cost, and reliability analytics. This is a Preview build focused on delivering immediate value with a clean workflow and honest metrics.

Key features
- Secure API key management
  - Stored with VS Code SecretStorage (encrypted at rest, OS keychain-backed). Never written to files or logs.
- Dynamic model and provider support
  - Models fetched from OpenRouter; provider list scoped per selected model via /models/{id}/endpoints (with robust fallback mapping).
- Single-model Benchmark Suites
  - Run a predefined suite of cases against a selected model/provider with iterations and summary analytics.
  - Aggregations: mean TPS, TTFB, total time, cost, success rate, std devs, total tokens.
  - Charts:
    - Bar (mean TPS per case) with ±1 SD whiskers and reliability outline (green/amber/red by success rate)
    - Scatter (TTFB vs TPS): bubble size ~ mean cost/run; color ~ success rate
    - Radar: Speed, Latency, Cost, Consistency, Reliability
- Recommendation Wizard (multi-model quick screen)
  - Multi-select models, set constraints/weights, run a mini-benchmark, Cancel anytime.
  - Progressive feedback and ranked results.
- Exports
  - Executive summary (Markdown), raw results (CSV), and PDF (when jsPDF is present).
- Suite Builder (experimental)
  - Create/edit/import/export suites as JSON. Custom suites merge with built-ins and override by id.

Preview scope
- This is a stable Preview: production-safe API key handling, working analytics and exports, and clear UX for key workflows.
- Some roadmap items are intentionally not implemented yet (see “Known limitations & roadmap”).

Quick start
1) Install the VSIX (or from Marketplace when published).
2) Open the ORPT Dashboard (command: “ORPT: Show ORPT Dashboard”).
3) Save your OpenRouter API key (starts with sk-or-v1-).
4) Wait for the status to turn Connected and models/providers to load.
5) Choose a Model and Provider in “Test Configuration”.
6) Benchmark Suites:
   - Choose a Suite and Iterations per Case.
   - Click “Run Suite”. View summary, bar, scatter, and radar charts.
   - Export markdown/csv/pdf as needed (PDF requires jsPDF UMD bundled).
7) Recommendation Wizard:
   - Select models (multi-select), set constraints/weights, click “Recommend”.
   - Use Cancel to stop mid-run; review ranked candidates.

Security and privacy
- API key storage: VS Code SecretStorage via context.secrets (encrypted at rest, backed by OS keychain where available).
- No key written to files, settings, or globalState; never logged.
- Network: Key used only as Authorization: Bearer for requests to openrouter.ai over HTTPS.

How provider selection works
- When you change the Model in “Test Configuration”:
  - ORPT requests /api/v1/models/{modelId}/endpoints from OpenRouter.
  - The provider dropdown updates to only show endpoints for that model (plus “auto”).
  - If the endpoint API returns nothing, ORPT falls back to deriving the provider from the model id prefix (e.g., x‑ai → xAI, groq → Groq).
- Global providers are shown only when no model is selected.

Understanding Benchmark Suites
- Suites run against a single model/provider at a time (the one selected in Test Configuration).
- Aggregation and charts appear after the run completes:
  - Bar chart: mean TPS per case with SD whiskers and reliability outline (green/amber/red).
  - Scatter: TTFB vs TPS. Bubble size ~ mean cost/run, color ~ success rate.
  - Radar: Speed, Latency, Cost, Consistency, Reliability composite.
- If a chart has no data (e.g., all runs failed), it will display a fallback message instead of appearing blank.

Recommendation Wizard vs Suites
- Wizard: quick “mini-benchmark” across multiple selected models, designed to screen candidates fast with constraints and weights.
- Suites: full, repeatable benchmarking on one selected model/provider with deeper analytics and exports.

Exports
- Markdown executive summary (per-iteration table + aggregates)
- CSV of raw per-iteration results
- PDF of summary and charts (requires jsPDF UMD)
  - By default, ORPT loads jsPDF from node_modules/jspdf/dist/jspdf.umd.min.js when packaged.

Known limitations & roadmap
- Quality scoring: reference outputs exist but scoring is not implemented yet.
- Weighted aggregation: TestCase.weight exists but aggregates are simple means for now.
- Wizard is a screening tool; a full multi-model “suite runner” is not implemented yet.
- Stronger typing for webview/provider messages, tests and CI pipeline are not included in this Preview.
- Packaging size: node_modules are currently shipped to ensure Chart.js and jsPDF work out-of-the-box. We plan to move vendor files to media/ and slim the VSIX.

Troubleshooting
- Charts not visible:
  - Ensure you installed the latest VSIX and reloaded the window. ORPT now loads Chart.js from node_modules in the packaged extension.
  - If a chart says “No data to display”, there were no successful datapoints for that chart (e.g., all runs failed).
- Providers look incorrect:
  - Selecting a model triggers a model-scoped provider refresh. The provider dropdown should only show endpoints for the selected model (plus “auto”).
- PDF button disabled:
  - Bundle jsPDF UMD in the packaged extension (ORPT loads node_modules/jspdf/dist/jspdf.umd.min.js). When present, the PDF button auto-enables.

Contributing
- Issues / Ideas: Open a GitHub issue
- Pull requests welcome (Preview items above are good starting points)

License
- MIT (see LICENSE)

Thanks
- Built for practitioners who need transparent, reproducible model performance insights on OpenRouter.
