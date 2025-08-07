# Changelog

All notable changes to the "openrouter-performance-tester" extension are documented in this file.
This project follows Keep a Changelog and Semantic Versioning.

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
