# Changelog

All notable changes to the "openrouter-performance-tester" extension are documented in this file.
This project follows Keep a Changelog and Semantic Versioning.

## [1.1.1] - 2025-08-08
### Changed
- README updated for GA: removed “Preview” wording, clarified bundled Chart.js/jsPDF and provider pinning.
- Packaging: version bump to 1.1.1 for Marketplace listing refresh (no breaking API changes).
### Fixed
- Provider endpoints handling: reinforce route construction to use /api/v1/models/{author}/{slug}/endpoints and read json.data.endpoints with provider_name when present.

## [1.1.0] - 2025-08-08 (GA)
### Added
- Setting: orpt.requestTimeoutMs (ms) with default 120000; applied to all OpenRouter requests.
- Cost transparency: TestResult now includes costEstimated?: boolean.
  - Single test card shows an “Estimated” chip next to cost when pricing or prompt tokens are missing.
  - Suite summary appends “(Est.)” to Mean Cost when any run used estimation.
- Provider pinning and richer provider metadata:
  - Pin specific providers using provider.only when a non-auto provider is selected.
  - Fetch detailed provider endpoints for the selected model via /api/v1/models/:author/:slug/endpoints and display:
    “<slug> • ctx <context_length> • <prompt_price>/<completion_price>”.
  - Safe fallbacks retained when the endpoints API is unavailable.
- Webview asset bundling:
  - Chart.js and jsPDF are bundled into a single media/vendor/vendor-bundle.js using esbuild.
  - Prepublish now compiles and bundles vendor assets.

### Changed
- Charts and rendering clarity:
  - HiDPI-aware with devicePixelRatio; increased font sizes and padding; legends moved to bottom with spacing.
  - Scatter bubbles have white outlines; radar is higher-contrast; quick bar chart adds gradient + subtle shadow.
  - Runtime canvas sizing to prevent cut-off labels and blurry text.
- Packaging:
  - .vscodeignore excludes node_modules/chart.js/** and node_modules/jspdf/**.
  - VSIX size reduced; vendor bundle loaded from media/vendor/vendor-bundle.js.

### Fixed
- Activity Bar icon path now points to media/icon.png (icon shows correctly).
- Request lifecycle:
  - Clear currentRequest and reset cancelled on all end/error paths.
  - Increased default timeout to 120s; configurable via orpt.requestTimeoutMs.
- Network environments:
  - proxy-agent wired into HTTPS requests (respects HTTPS_PROXY/HTTP_PROXY/ALL_PROXY).
- Provider inference fallbacks expanded (e.g., cohere, ai21).

### Notes
- Type addition (costEstimated) is backwards-compatible; no breaking changes to existing message flow.
- CI/tests remain out of scope for this release (to be added in a future update).

## [1.0.0] - Preview
### Added
- Secure API key storage using VS Code SecretStorage (encrypted at rest; OS keychain-backed).
- Dynamic model loading from OpenRouter; provider list scoped to the selected model using `/api/v1/models/{modelId}/endpoints` (with fallback mapping by model prefix).
- Single-model Benchmark Suites runner with aggregation:
  - Means for TPS, TTFB, Total Time, Cost; std devs; success rate; total tokens.
- Analytics:
  - Bar chart (mean TPS per case) with ±1 SD whiskers and reliability outline (green/amber/red by success rate).
  - Scatter (TTFB vs TPS) where bubble size ~ mean cost/run and color ~ success rate.
  - Radar with Speed, Latency, Cost, Consistency, Reliability.
- Recommendation Wizard (multi-model quick screen) with constraints, weights, progress, and Cancel.
- Exports: Executive Markdown, CSV, and PDF (when jsPDF UMD is present).
- Suite Builder (experimental): create/edit/import/export suites (JSON), merged with built-ins.
- Inline help “?” badges for key sections; suite run progress indicator; wizard run progress indicator.
- Suite Summary now shows the model and provider used.

### Changed
- Chart.js is now loaded from `node_modules/chart.js/dist/chart.umd.js` for reliable packaging.
- PDF export loads jsPDF from `node_modules/jspdf/dist/jspdf.umd.min.js` (packaged).

### Known Limitations (Preview)
- Quality scoring not implemented (references are placeholders).
- Weighted aggregation not applied (weights present but ignored in aggregates).
- Wizard is a quick screening tool, not a full multi-model suite runner.
- Message contracts could be strongly typed; tests/CI pending.
- VSIX includes node_modules for zero-config charts/PDF; slimming is planned.
