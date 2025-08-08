import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Generate a nonce for security
    const nonce = getNonce();
    
    // Get resource URIs
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
    const chartUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'));
    const jspdfUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>ORPT Dashboard</title>
        <script nonce="${nonce}" src="${chartUri}"></script>
        <script nonce="${nonce}" src="${jspdfUri}"></script>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>OpenRouter Performance Tester</h1>
                <p>Professional AI Model Benchmarking</p>
            </header>

            <section class="api-section">
                <h2>API Configuration <span class="help" tabindex="0" data-tip="Stores your OpenRouter API key securely in VS Code Secrets.
Status turns green when connected and models/providers will load.">?</span></h2>
                <div class="api-status" id="apiStatus">
                    <span class="status-indicator" id="statusIndicator"></span>
                    <span id="statusText">Not Connected</span>
                </div>
                <div class="form-group">
                    <label for="apiKeyInput">OpenRouter API Key</label>
                    <input type="password" id="apiKeyInput" placeholder="sk-or-v1-..." />
                    <div class="button-group">
                        <button id="saveApiKeyBtn" class="btn btn-primary">Save API Key</button>
                        <button id="clearApiKeyBtn" class="btn btn-secondary">Clear</button>
                    </div>
                </div>
            </section>

            <section class="wizard-section">
                <h2>Recommendation Wizard <span class="help" tabindex="0" data-tip="Run a quick mini-benchmark across selected models.
Set constraints and weights, click Recommend.
Use Cancel to stop.">?</span></h2>
                <div class="form-group">
                    <label for="wizardBudget">Budget per 1k tokens (USD)</label>
                    <input type="number" id="wizardBudget" placeholder="e.g. 0.005" step="0.0001" min="0" />
                </div>
                <div class="form-group">
                    <label for="wizardMaxTtfb">Max TTFB (seconds)</label>
                    <input type="number" id="wizardMaxTtfb" placeholder="e.g. 5" step="0.1" min="0" />
                </div>
                <div class="form-group">
                    <label for="wizardMinTps">Min Tokens/sec</label>
                    <input type="number" id="wizardMinTps" placeholder="e.g. 20" step="0.1" min="0" />
                </div>
                <div class="form-group">
                    <label>Weights (0..1 each)</label>
                    <div class="grid grid-2">
                        <div>
                            <label for="wSpeed">Speed</label>
                            <input type="number" id="wSpeed" value="0.4" step="0.1" min="0" max="1" />
                        </div>
                        <div>
                            <label for="wLatency">Latency</label>
                            <input type="number" id="wLatency" value="0.3" step="0.1" min="0" max="1" />
                        </div>
                        <div>
                            <label for="wCost">Cost</label>
                            <input type="number" id="wCost" value="0.3" step="0.1" min="0" max="1" />
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="wizardModelSelect">Models to benchmark</label>
                    <div class="button-group" style="margin-bottom:6px">
                        <button id="wizardSelectAllModelsBtn" class="btn btn-secondary" type="button">Select All</button>
                        <button id="wizardSelectNoneModelsBtn" class="btn btn-secondary" type="button">Select None</button>
                    </div>
                    <select id="wizardModelSelect" multiple size="6" style="min-height:120px;"></select>
                </div>
                <div class="button-group">
                    <button id="runRecommendBtn" class="btn btn-primary">Recommend from Selected Models</button>
                    <button id="cancelRecommendBtn" class="btn btn-secondary" disabled>Cancel</button>
                </div>
                <div id="wizardProgress" class="result-card" style="margin-top: 12px; display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="wizardRunFill"></div></div>
                    <p id="wizardRunText">Preparing...</p>
                </div>
                <div id="wizardResults" class="result-card" style="margin-top: 12px;"></div>
            </section>

            <section class="test-section">
                <h2>Test Configuration <span class="help" tabindex="0" data-tip="Choose the model and provider used for single tests and full suites.
'Auto' lets OpenRouter choose an endpoint for the model.">?</span></h2>
                <div class="form-group">
                    <label for="modelSelect">Model</label>
                    <select id="modelSelect">
                        <option value="">Loading models...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="providerSelect">Provider</label>
                    <select id="providerSelect">
                        <option value="auto">Auto (Best Available)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="promptInput">Test Prompt</label>
                    <textarea id="promptInput" rows="4">Write a detailed analysis of quantum computing's impact on cryptography.</textarea>
                </div>
                <div class="form-group">
                    <label for="maxTokensInput">Max Tokens</label>
                    <input type="number" id="maxTokensInput" value="1000" min="1" max="10000" />
                </div>
                <button id="runTestBtn" class="btn btn-primary btn-large">Run Performance Test</button>
            </section>

            <section class="progress-section" id="progressSection" style="display: none;">
                <h2>Test Progress</h2>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <p id="progressText">Initializing...</p>
                <div class="button-group">
                    <button id="cancelTestBtn" class="btn btn-secondary" disabled>Cancel</button>
                </div>
            </section>

            <section class="results-section">
                <h2>Test Results</h2>
                <div id="currentResult" class="result-card" style="display: none;">
                    <!-- Current result will be inserted here -->
                </div>
                <div id="resultHistory">
                    <p class="empty-state">No test results yet. Run a test to see results here.</p>
                </div>
            </section>

            <section class="suite-section">
                <h2>Benchmark Suites <span class="help" tabindex="0" data-tip="Runs the selected suite of prompts against the currently selected model/provider only.
Shows summary, charts and exports.
Use the Wizard to compare many models quickly.">?</span></h2>
                <div class="form-group">
                    <label for="suiteSelect">Suite</label>
                    <select id="suiteSelect">
                        <option value="">Loading suites...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="suiteIterations">Iterations per Case</label>
                    <input type="number" id="suiteIterations" value="3" min="1" max="20" />
                </div>
                <div class="button-group">
                    <button id="runSuiteBtn" class="btn btn-primary">Run Suite</button>
                    <button id="exportReportBtn" class="btn btn-secondary" disabled>Export Report (Markdown)</button>
                    <button id="exportCsvBtn" class="btn btn-secondary" disabled>Export Results (CSV)</button>
                    <button id="exportPdfBtn" class="btn btn-secondary" disabled title="PDF export requires bundled jsPDF (media/vendor/jspdf.umd.min.js)">Export Report (PDF)</button>
                </div>
                <div id="suiteRun" class="result-card" style="margin-top: 12px; display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="suiteRunFill"></div></div>
                    <p id="suiteRunText">Starting suite...</p>
                </div>

                <div id="suiteSummary" class="result-card" style="margin-top: 12px;"></div>

                <!-- Quick canvas-based chart (kept) -->
                <canvas id="suiteChart" width="800" height="260" style="margin-top: 12px; background: var(--vscode-input-background, #1e1e1e); border-radius: 6px;"></canvas>

                <!-- Chart.js charts -->
                <div class="grid" style="grid-template-columns: 1fr; gap: 12px; margin-top: 12px;">
                    <canvas id="scatterChart" style="background: var(--vscode-input-background, #1e1e1e);"></canvas>
                    <canvas id="radarChart" style="background: var(--vscode-input-background, #1e1e1e);"></canvas>
                </div>
                <p class="help-text" style="margin-top:4px;">Scatter: bubble size ~ mean cost/run; color ~ success rate</p>
            </section>


            <section class="suite-builder-section">
                <h2>Suite Builder (Experimental) <span class="help" tabindex="0" data-tip="Create or edit suites as JSON.
Saved suites merge with built-ins and override by id.
Import/Export to share with your team.">?</span></h2>
                <p class="help-text">Create or edit custom suites using JSON. Saved suites are stored locally and merged with built-in suites.</p>
                <div class="button-group">
                    <button id="newSuiteBtn" class="btn btn-secondary">New Custom Suite</button>
                    <button id="loadSelectedSuiteBtn" class="btn btn-secondary">Load Selected Suite to Editor</button>
                    <button id="deleteSuiteBtn" class="btn btn-secondary">Delete Selected Custom Suite</button>
                    <button id="importSuitesBtn" class="btn btn-secondary">Import Suites (JSON)</button>
                    <button id="exportSuitesBtn" class="btn btn-secondary">Export Suites (JSON)</button>
                </div>
                <div class="form-group">
                    <label for="suiteEditor">Suite JSON Editor</label>
                    <textarea id="suiteEditor" rows="12" placeholder='{
  "id": "custom-suite-1",
  "name": "My Suite",
  "description": "Description",
  "iterations": 2,
  "cases": [
    { "id": "c1", "name": "Case 1", "prompt": "Write a haiku.", "params": { "max_tokens": 128 } }
  ]
}'></textarea>
                </div>
                <div class="button-group">
                    <button id="saveSuiteBtn" class="btn btn-primary">Save Suite JSON</button>
                </div>
            </section>
        </div>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            // Store state
            let state = {
                apiKey: '',
                models: [],
                providers: [],
                history: [],
                suites: [],
                lastSuiteResult: null,
                recommendations: [],
                charts: {
                    scatter: null,
                    radar: null
                },
                currentModelId: ''
            };

            // Log function for debugging
            function log(message) {
                vscode.postMessage({ command: 'log', text: message });
            }

            // Robust bootstrap - run immediately if DOMContentLoaded already fired
            function bootstrap() {
                try {
                    log('Webview bootstrap start');
                    setupEventListeners();
                    requestInitialData();
                    updatePdfButtonAvailability();
                    log('Webview bootstrap complete');
                } catch (e) {
                    console.error('Bootstrap error', e);
                    vscode.postMessage({ command: 'log', text: 'Bootstrap error: ' + (e?.message || e) });
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', bootstrap);
            } else {
                bootstrap();
            }

            // Setup all event listeners
            function setupEventListeners() {
                // API Key buttons
                const saveBtn = document.getElementById('saveApiKeyBtn');
                if (saveBtn) saveBtn.addEventListener('click', saveApiKey);
                const clearBtn = document.getElementById('clearApiKeyBtn');
                if (clearBtn) clearBtn.addEventListener('click', clearApiKey);
                
                // Test buttons
                const runBtnEl = document.getElementById('runTestBtn');
                if (runBtnEl) runBtnEl.addEventListener('click', runTest);
                const cancelBtn = document.getElementById('cancelTestBtn');
                if (cancelBtn) cancelBtn.addEventListener('click', cancelTest);

                // Suite buttons
                const runSuiteBtn = document.getElementById('runSuiteBtn');
                if (runSuiteBtn) runSuiteBtn.addEventListener('click', runSuite);
                const exportReportBtn = document.getElementById('exportReportBtn');
                if (exportReportBtn) exportReportBtn.addEventListener('click', exportReport);
                const exportCsvBtn = document.getElementById('exportCsvBtn');
                if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);
                const exportPdfBtn = document.getElementById('exportPdfBtn');
                if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportPdf);

                // Wizard
                const runRecommendBtn = document.getElementById('runRecommendBtn');
                if (runRecommendBtn) runRecommendBtn.addEventListener('click', runRecommendation);
                const cancelRecommendBtn = document.getElementById('cancelRecommendBtn');
                if (cancelRecommendBtn) cancelRecommendBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'cancelRecommendation' });
                    const runBtn = document.getElementById('runRecommendBtn');
                    if (runBtn) runBtn.removeAttribute('disabled');
                    const cancelBtn = document.getElementById('cancelRecommendBtn');
                    if (cancelBtn) cancelBtn.setAttribute('disabled', 'true');
                });
                const wizardSelectAllModelsBtn = document.getElementById('wizardSelectAllModelsBtn');
                if (wizardSelectAllModelsBtn) wizardSelectAllModelsBtn.addEventListener('click', wizardSelectAllModels);
                const wizardSelectNoneModelsBtn = document.getElementById('wizardSelectNoneModelsBtn');
                if (wizardSelectNoneModelsBtn) wizardSelectNoneModelsBtn.addEventListener('click', wizardSelectNoneModels);

                // Model -> Providers dynamic population
                const modelSelectEl = document.getElementById('modelSelect');
                if (modelSelectEl) {
                    modelSelectEl.addEventListener('change', () => {
                        const modelId = modelSelectEl.value;
                        state.currentModelId = modelId || '';
                        if (!modelId) {
                            vscode.postMessage({ command: 'getAllProviders' });
                        } else {
                            vscode.postMessage({ command: 'getProvidersForModel', modelId });
                        }
                    });
                }

                // Suite Builder
                const newSuiteBtn = document.getElementById('newSuiteBtn');
                if (newSuiteBtn) newSuiteBtn.addEventListener('click', newSuiteTemplate);
                const loadSelectedSuiteBtn = document.getElementById('loadSelectedSuiteBtn');
                if (loadSelectedSuiteBtn) loadSelectedSuiteBtn.addEventListener('click', loadSelectedSuiteToEditor);
                const deleteSuiteBtn = document.getElementById('deleteSuiteBtn');
                if (deleteSuiteBtn) deleteSuiteBtn.addEventListener('click', deleteSelectedSuite);
                const saveSuiteBtn = document.getElementById('saveSuiteBtn');
                if (saveSuiteBtn) saveSuiteBtn.addEventListener('click', saveSuiteJson);
                const importSuitesBtn = document.getElementById('importSuitesBtn');
                if (importSuitesBtn) importSuitesBtn.addEventListener('click', () => vscode.postMessage({ command: 'importSuitesJson' }));
                const exportSuitesBtn = document.getElementById('exportSuitesBtn');
                if (exportSuitesBtn) exportSuitesBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportSuitesJson' }));
                
                log('Event listeners set up');
            }

            function updatePdfButtonAvailability() {
                const btn = document.getElementById('exportPdfBtn');
                if (!btn) return;
                // If jsPDF is available in the webview (via vendor file), enable. Otherwise disable.
                const available = typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined';
                if (available) {
                    btn.removeAttribute('disabled');
                    btn.title = 'Export Report (PDF)';
                } else {
                    btn.setAttribute('disabled', 'true');
                    btn.title = 'PDF export requires bundled jsPDF (node_modules/jspdf/dist/jspdf.umd.min.js)';
                }
            }

            // Request initial data from extension
            function requestInitialData() {
                vscode.postMessage({ command: 'getApiKey' });
                vscode.postMessage({ command: 'getHistory' });
                vscode.postMessage({ command: 'getSuites' });
                vscode.postMessage({ command: 'getAllProviders' });
            }

            // Save API key
            function saveApiKey() {
                const apiKey = document.getElementById('apiKeyInput').value.trim();
                if (!apiKey) {
                    showError('Please enter an API key');
                    return;
                }
                vscode.postMessage({ command: 'saveApiKey', apiKey });
                document.getElementById('apiKeyInput').value = '';
            }

            // Clear API key
            function clearApiKey() {
                vscode.postMessage({ command: 'clearApiKey' });
                updateApiStatus(false);
            }

            // Run performance test
            function runTest() {
                const config = {
                    model: document.getElementById('modelSelect').value,
                    provider: document.getElementById('providerSelect').value,
                    prompt: document.getElementById('promptInput').value,
                    maxTokens: parseInt(document.getElementById('maxTokensInput').value)
                };
                
                if (!config.model) {
                    showError('Please select a model');
                    return;
                }
                
                vscode.postMessage({ command: 'runTest', config });
            }

            function cancelTest() {
                vscode.postMessage({ command: 'cancelTest' });
                hideProgress();
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.command) {
                    case 'apiKey':
                        updateApiStatus(message.hasKey);
                        break;
                    case 'apiKeySaved':
                        updateApiStatus(true);
                        showSuccess('API key saved successfully');
                        break;
                    case 'models':
                        updateModels(message.models);
                        break;
                    case 'providers':
                        handleProviders(message);
                        break;
                    case 'testStarted':
                        showProgress();
                        break;
                    case 'testProgress':
                        updateProgress(message.progress);
                        break;
                    case 'testCompleted':
                        hideProgress();
                        showResult(message.result);
                        break;
                    case 'testError':
                        hideProgress();
                        showError(message.error);
                        break;
                    case 'history':
                        updateHistory(message.history);
                        break;
                    case 'suites':
                        updateSuites(message.suites);
                        break;
                    case 'suiteProgress':
                        showProgress();
                        updateProgress(message.progress);
                        showSuiteProgress();
                        updateSuiteProgress(message.progress);
                        break;
                    case 'suiteCompleted':
                        hideProgress();
                        hideSuiteProgress();
                        state.lastSuiteResult = message.result;
                        updateSuiteSummary(message.result);
                        renderSuiteChart(message.result);
                        renderScatterChart(message.result);
                        renderRadarChart(message.result);
                        const exportBtn = document.getElementById('exportReportBtn');
                        if (exportBtn) exportBtn.removeAttribute('disabled');
                        const exportCsvBtn2 = document.getElementById('exportCsvBtn');
                        if (exportCsvBtn2) exportCsvBtn2.removeAttribute('disabled');
                        updatePdfButtonAvailability();
                        break;
                    case 'suiteError':
                        hideProgress();
                        hideSuiteProgress();
                        showError(message.error);
                        break;
                    case 'wizardProgress':
                        updateWizardProgress(message.progress);
                        break;
                    case 'wizardRecommendation':
                        renderRecommendations(message.payload);
                        const runBtn3 = document.getElementById('runRecommendBtn');
                        if (runBtn3) runBtn3.removeAttribute('disabled');
                        const cancelBtn3 = document.getElementById('cancelRecommendBtn');
                        if (cancelBtn3) cancelBtn3.setAttribute('disabled', 'true');
                        break;
                }
            });

            // UI update functions
            function updateApiStatus(connected) {
                const indicator = document.getElementById('statusIndicator');
                const text = document.getElementById('statusText');
                
                if (connected) {
                    indicator.className = 'status-indicator status-connected';
                    text.textContent = 'Connected';
                } else {
                    indicator.className = 'status-indicator status-disconnected';
                    text.textContent = 'Not Connected';
                }
            }

            function updateModels(models) {
                state.models = models || [];
                const select = document.getElementById('modelSelect');
                if (select) {
                    select.innerHTML = '<option value="">Select a model...</option>';
                    (models || []).forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = (model.name || model.id) + (model.provider ? ' (' + model.provider + ')' : '');
                        select.appendChild(option);
                    });
                }
                const wsel = document.getElementById('wizardModelSelect');
                if (wsel) {
                    wsel.innerHTML = '';
                    (models || []).forEach(model => {
                        const opt = document.createElement('option');
                        opt.value = model.id;
                        opt.textContent = model.name || model.id;
                        wsel.appendChild(opt);
                    });
                }
            }

            function updateProviders(providers) {
                const list = Array.from(new Set(['auto', ...(providers || [])]));
                state.providers = list;
                const select = document.getElementById('providerSelect');
                select.innerHTML = '';
                list.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider;
                    option.textContent = provider;
                    select.appendChild(option);
                });
            }
            function handleProviders(message) {
                const scope = message.scope || 'global';
                const providers = message.providers || [];
                if (scope === 'model') {
                    const current = state.currentModelId || (document.getElementById('modelSelect')?.value || '');
                    if (message.modelId && message.modelId === current) {
                        updateProviders(providers);
                    }
                } else {
                    const current = state.currentModelId || (document.getElementById('modelSelect')?.value || '');
                    if (!current) {
                        updateProviders(providers);
                    }
                }
            }

            function showProgress() {
                document.getElementById('progressSection').style.display = 'block';
                document.getElementById('progressFill').style.width = '0%';
                document.getElementById('progressText').textContent = 'Starting test...';

                // Disable Run, enable Cancel
                const runBtn = document.getElementById('runTestBtn');
                if (runBtn) runBtn.setAttribute('disabled', 'true');
                const cancelBtn = document.getElementById('cancelTestBtn');
                if (cancelBtn) cancelBtn.removeAttribute('disabled');
            }

            function updateProgress(progress) {
                document.getElementById('progressFill').style.width = (progress.percent ?? 0) + '%';
                document.getElementById('progressText').textContent = progress.message ?? '';
            }

            function hideProgress() {
                document.getElementById('progressSection').style.display = 'none';

                // Enable Run, disable Cancel
                const runBtn = document.getElementById('runTestBtn');
                if (runBtn) runBtn.removeAttribute('disabled');
                const cancelBtn = document.getElementById('cancelTestBtn');
                if (cancelBtn) cancelBtn.setAttribute('disabled', 'true');
            }

            // Suite-specific progress indicator inside the Suite section
            function showSuiteProgress() {
                const el = document.getElementById('suiteRun');
                if (!el) return;
                el.style.display = 'block';
                const fill = document.getElementById('suiteRunFill');
                if (fill) fill.style.width = '0%';
                const txt = document.getElementById('suiteRunText');
                if (txt) txt.textContent = 'Starting suite...';
                const btn = document.getElementById('runSuiteBtn');
                if (btn) btn.setAttribute('disabled', 'true');
            }

            function updateSuiteProgress(progress) {
                const el = document.getElementById('suiteRun');
                if (!el) return;
                const pct = Math.max(0, Math.min(100,
                    (typeof progress?.percent === 'number')
                        ? progress.percent
                        : Math.round(((progress?.step || 0) / Math.max(1, progress?.total || 1)) * 100)
                ));
                const fill = document.getElementById('suiteRunFill');
                if (fill) fill.style.width = pct + '%';
                const txt = document.getElementById('suiteRunText');
                if (txt) {
                    const step = progress?.step ?? 0;
                    const total = progress?.total ?? 0;
                    const msg = progress?.message || 'Running...';
                    txt.textContent = msg + ' (' + step + '/' + total + ')';
                }
            }

            function hideSuiteProgress() {
                const el = document.getElementById('suiteRun');
                if (!el) return;
                el.style.display = 'none';
                const btn = document.getElementById('runSuiteBtn');
                if (btn) btn.removeAttribute('disabled');
            }

            function showResult(result) {
                const html = \`
                    <h3>\${result.model}</h3>
                    <div class="metrics">
                        <div class="metric">
                            <span class="metric-value">\${result.tokensPerSecond.toFixed(1)}</span>
                            <span class="metric-label">Tokens/sec</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">\${result.totalTime.toFixed(2)}s</span>
                            <span class="metric-label">Total Time</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">$\${result.cost.toFixed(4)}</span>
                            <span class="metric-label">Cost</span>
                        </div>
                    </div>
                \`;
                
                document.getElementById('currentResult').innerHTML = html;
                document.getElementById('currentResult').style.display = 'block';
            }

            function updateHistory(history) {
                state.history = history || [];
                const container = document.getElementById('resultHistory');
                if (!history || history.length === 0) {
                    container.innerHTML = '<p class="empty-state">No test results yet. Run a test to see results here.</p>';
                    return;
                }
                
                container.innerHTML = history.map(result => \`
                    <div class="history-item">
                        <strong>\${result.model}</strong> - \${result.tokensPerSecond.toFixed(1)} TPS - \${new Date(result.timestamp).toLocaleString()}
                    </div>
                \`).join('');
            }

            function updateSuites(suites) {
                state.suites = suites || [];
                const select = document.getElementById('suiteSelect');
                if (!select) return;
                if (!state.suites.length) {
                    select.innerHTML = '<option value="">No suites available</option>';
                    return;
                }
                select.innerHTML = '';
                state.suites.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.id;
                    option.textContent = s.name;
                    select.appendChild(option);
                });
            }

            function runSuite() {
                const suiteId = document.getElementById('suiteSelect').value;
                const iterations = parseInt(document.getElementById('suiteIterations').value) || 1;
                const model = document.getElementById('modelSelect').value;
                const provider = document.getElementById('providerSelect').value;

                if (!suiteId) {
                    showError('Please select a suite');
                    return;
                }
                if (!model) {
                    showError('Please select a model');
                    return;
                }

                // Reset last summary and disable export until done
                const exportBtn = document.getElementById('exportReportBtn');
                if (exportBtn) exportBtn.setAttribute('disabled', 'true');
                const exportCsvBtn = document.getElementById('exportCsvBtn');
                if (exportCsvBtn) exportCsvBtn.setAttribute('disabled', 'true');
                const exportPdfBtn = document.getElementById('exportPdfBtn');
                if (exportPdfBtn) exportPdfBtn.setAttribute('disabled', 'true');
                document.getElementById('suiteSummary').innerHTML = '';
                showSuiteProgress();
                updateSuiteProgress({ percent: 0, step: 0, total: 1, message: 'Starting suite...' });
                
                vscode.postMessage({
                    command: 'runSuite',
                    payload: {
                        suiteId,
                        model,
                        provider,
                        iterations
                    }
                });
            }

            function updateSuiteSummary(result) {
                if (!result) return;
                const el = document.getElementById('suiteSummary');
                const html = \`
                    <h3>Suite: \${result.suiteId}</h3>
                    <p class="help-text" style="margin:6px 0 10px 0;">Model: \${result.model} (Provider: \${result.provider})</p>
                    <div class="metrics">
                        <div class="metric">
                            <span class="metric-value">\${result.aggregates.meanTokensPerSecond.toFixed(2)}</span>
                            <span class="metric-label">Mean TPS</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">\${result.aggregates.meanTTFB.toFixed(2)}s</span>
                            <span class="metric-label">Mean TTFB</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">\${result.aggregates.meanTotalTime.toFixed(2)}s</span>
                            <span class="metric-label">Mean Total</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">$\${result.aggregates.meanCost.toFixed(4)}</span>
                            <span class="metric-label">Mean Cost</span>
                        </div>
                    </div>\`;
                el.innerHTML = html;
            }

            // Quick canvas-based TPS bar chart
            function renderSuiteChart(result) {
                const canvas = document.getElementById('suiteChart');
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                // Responsive canvas sizing for crisp rendering (pure JS; no TS casts)
                const dpr = window.devicePixelRatio || 1;
                const canvasEl = canvas;
                const cssWidth = canvasEl.clientWidth || canvasEl.width;
                const cssHeight = 260;
                if (canvasEl.width !== Math.floor(cssWidth * dpr) || canvasEl.height !== Math.floor(cssHeight * dpr)) {
                    canvasEl.width = Math.floor(cssWidth * dpr);
                    canvasEl.height = Math.floor(cssHeight * dpr);
                }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                // Aggregate stats per case (mean TPS, std, success rate)
                const map = new Map();
                const okCount = new Map();
                const totalCount = new Map();
                (result.results || []).forEach(r => {
                    const cid = r.caseId;
                    totalCount.set(cid, (totalCount.get(cid) || 0) + 1);
                    if (r.ok && r.result && typeof r.result.tokensPerSecond === 'number') {
                        okCount.set(cid, (okCount.get(cid) || 0) + 1);
                        const arr = map.get(cid) || [];
                        arr.push(r.result.tokensPerSecond);
                        map.set(cid, arr);
                    }
                });
                const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
                const std = (arr) => {
                    if (!arr || arr.length < 2) return 0;
                    const m = mean(arr);
                    const v = arr.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / (arr.length - 1);
                    return Math.sqrt(v);
                };
                const data = Array.from(map.entries()).map(([caseId, arr]) => {
                    const m = mean(arr);
                    const s = std(arr);
                    const ok = okCount.get(caseId) || 0;
                    const tot = totalCount.get(caseId) || arr.length || 1;
                    const sr = ok / Math.max(1, tot);
                    return { caseId, mean: m, sd: s, successRate: sr };
                }).sort((a, b) => b.mean - a.mean);

                const items = data.slice(0, Math.min(12, data.length));

                // Canvas dimensions
                const width = cssWidth;
                const height = cssHeight;
                const padding = 40;
                const chartW = width - padding * 2;
                const chartH = height - padding * 2;

                // Clear
                ctx.clearRect(0, 0, width, height);

                // Background grid
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 1;
                const gridLines = 4;
                for (let i = 0; i <= gridLines; i++) {
                    const y = padding + (chartH * i) / gridLines;
                    ctx.beginPath();
                    ctx.moveTo(padding, y);
                    ctx.lineTo(padding + chartW, y);
                    ctx.stroke();
                }

                // Axes
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(padding, padding);
                ctx.lineTo(padding, padding + chartH);
                ctx.lineTo(padding + chartW, padding + chartH);
                ctx.stroke();

                const maxVal = items.length ? Math.max(...items.map(d => d.mean + (d.sd || 0))) : 1;

                // Bars
                const n = Math.max(items.length, 1);
                const slot = chartW / n;
                const barW = Math.max(12, Math.min(40, slot * 0.6));
                const barColor = getComputedStyle(document.body).getPropertyValue('--vscode-charts-green') || '#2ea043';
                ctx.fillStyle = barColor.trim() || '#2ea043';

                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                for (let i = 0; i < items.length; i++) {
                    const d = items[i];
                    const xCenter = padding + slot * i + slot / 2;
                    const barH = maxVal > 0 ? (d.mean / maxVal) * (chartH - 20) : 0;
                    const x = xCenter - barW / 2;
                    const y = padding + chartH - barH;

                    // Bar with subtle gradient for depth
                    const altColor = (getComputedStyle(document.body).getPropertyValue('--vscode-charts-blue') || '#58a6ff').trim() || '#58a6ff';
                    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
                    grad.addColorStop(0, (barColor.trim() || '#2ea043'));
                    grad.addColorStop(1, altColor);
                    ctx.fillStyle = grad;
                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0.25)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetY = 2;
                    ctx.fillRect(x, y, barW, barH);
                    ctx.restore();

                    // Error whisker (±1 sd) drawn above bar
                    const whiskerH = maxVal > 0 ? ((d.sd || 0) / maxVal) * (chartH - 20) : 0;
                    if (whiskerH > 0) {
                        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(xCenter, y);
                        ctx.lineTo(xCenter, y - whiskerH);
                        ctx.stroke();
                        // small cap
                        ctx.beginPath();
                        ctx.moveTo(xCenter - barW * 0.25, y - whiskerH);
                        ctx.lineTo(xCenter + barW * 0.25, y - whiskerH);
                        ctx.stroke();
                    }

                    // Reliability outline color by success rate
                    const sr = d.successRate ?? 1;
                    let outline = '#2ea043'; // green
                    if (sr < 0.6) outline = '#f85149'; // red
                    else if (sr < 0.99) outline = '#d29922'; // amber
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = outline;
                    ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, barH - 1);

                    // Value label
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.fillText(d.mean.toFixed(1), xCenter, y - 16);

                    // CaseId label (trim)
                    const label = String(d.caseId).length > 12 ? (String(d.caseId).slice(0, 11) + '…') : String(d.caseId);
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.fillText(label, xCenter, padding + chartH + 4);

                    // Reset bar color
                    ctx.fillStyle = barColor.trim() || '#2ea043';
                }

                // Y-axis ticks
                ctx.fillStyle = 'rgba(255,255,255,0.65)';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                for (let i = 0; i <= gridLines; i++) {
                    const val = (maxVal * (1 - i / gridLines));
                    const y = padding + (chartH * i) / gridLines;
                    ctx.fillText(val.toFixed(1), padding - 8, y);
                }
            }

            // Chart.js helpers
            function getCssVar(name, fallback) {
                const v = getComputedStyle(document.body).getPropertyValue(name);
                return (v && v.trim()) || fallback;
            }

            // Scatter: TTFB vs TPS per case (means)
            function renderScatterChart(result) {
                const canvas = document.getElementById('scatterChart');
                const ctx = canvas ? canvas.getContext('2d') : null;
                if (!canvas || !ctx) return;

                // Ensure crisp rendering and enough height for labels
                try { canvas.style.setProperty('height', '320px', 'important'); } catch {}
                // Force a reflow so Chart picks up the new CSS height
                void canvas.offsetHeight;

                // Destroy previous
                if (state.charts.scatter) {
                    try { state.charts.scatter.destroy(); } catch {}
                    state.charts.scatter = null;
                }

                // Aggregate per-case: means and reliability/cost
                const perCase = new Map();
                const okCount = new Map();
                const totalCount = new Map();
                (result.results || []).forEach(r => {
                    const cid = r.caseId;
                    totalCount.set(cid, (totalCount.get(cid) || 0) + 1);
                    if (r.ok && r.result) {
                        okCount.set(cid, (okCount.get(cid) || 0) + 1);
                        const arr = perCase.get(cid) || [];
                        arr.push({
                            tps: r.result.tokensPerSecond,
                            ttfb: r.result.timeToFirstToken,
                            total: r.result.totalTime,
                            cost: r.result.cost
                        });
                        perCase.set(cid, arr);
                    }
                });
                const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
                let tempPoints = Array.from(perCase.entries()).map(([caseId, arr]) => {
                    const tpsMean = mean(arr.map(x => x.tps));
                    const ttfbMean = mean(arr.map(x => x.ttfb));
                    const totalMean = mean(arr.map(x => x.total));
                    const costMean = mean(arr.map(x => x.cost));
                    const sr = (okCount.get(caseId) || 0) / Math.max(1, totalCount.get(caseId) || arr.length || 1);
                    return { caseId, x: ttfbMean, y: tpsMean, total: totalMean, cost: costMean, sr };
                });
                const maxCost = Math.max(0.00001, ...tempPoints.map(p => p.cost || 0.00001));
                const points = tempPoints.map(p => {
                    // radius 4..12 scaled by cost (soft scale)
                    const r = Math.max(4, Math.min(12, 4 + 8 * ((p.cost || 0) / maxCost)));
                    return { ...p, r };
                });

                if (!points.length) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('No data to display', (canvas.width || 800) / 2, (canvas.height || 260) / 2);
                    return;
                }
                const colorForSR = (sr) => {
                    if (sr < 0.6) return '#f85149'; // red
                    if (sr < 0.99) return '#d29922'; // amber
                    return '#2ea043'; // green
                };

                if (typeof Chart === 'undefined') {
                    // Fallback message if Chart.js is not available
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Charts module unavailable', (canvas.width || 800) / 2, (canvas.height || 260) / 2);
                    return;
                }

                try {
                    // Theme-aware Chart.js defaults
                    const __fg = getCssVar('--vscode-foreground', '#e6edf3');
                    const __grid = 'rgba(255,255,255,0.12)';
                    Chart.defaults.color = __fg;
                    Chart.defaults.font.family = 'Segoe UI, Roboto, Arial, sans-serif';
                    Chart.defaults.font.size = 13;
                    Chart.defaults.devicePixelRatio = Math.max(1, (window.devicePixelRatio || 1));
                    Chart.defaults.plugins.legend.labels.color = __fg;
                    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0,0,0,0.65)';
                    Chart.defaults.plugins.tooltip.borderColor = __grid;
                    Chart.defaults.plugins.tooltip.borderWidth = 1;
                    Chart.defaults.elements.point.borderWidth = 2;
                    Chart.defaults.elements.point.radius = 6;
                    Chart.defaults.elements.point.hoverRadius = 8;
                    Chart.defaults.elements.line.borderWidth = 2;
                    Chart.defaults.scale.grid.color = __grid;
                    Chart.defaults.scale.ticks.color = __fg;
                } catch {}
                state.charts.scatter = new Chart(ctx, {
                    type: 'scatter',
                    data: {
                        datasets: [{
                            label: 'TTFB vs TPS (per case)',
                            data: points,
                            parsing: false,
                            pointRadius: (ctx) => Math.max(6, Math.min(16, ctx.raw?.r || 6)),
                            pointBackgroundColor: (ctx) => colorForSR(ctx.raw?.sr ?? 1),
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointHoverBorderWidth: 2,
                            pointHoverBorderColor: '#ffffff',
                            showLine: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        devicePixelRatio: Math.max(1, (window.devicePixelRatio || 1)),
                        layout: { padding: { top: 22, right: 26, bottom: 26, left: 36 } },
                        plugins: {
                            legend: { display: true, position: 'bottom', labels: { color: getCssVar('--vscode-foreground', '#e6edf3'), padding: 12 } },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const p = ctx.raw;
                                        const srPct = ((p.sr ?? 0) * 100).toFixed(0) + '%';
                                        const costStr = (typeof p.cost === 'number') ? ('$' + p.cost.toFixed(4) + '/run') : '—';
                                        return [
                                            String(p.caseId),
                                            'TPS: ' + (p.y?.toFixed?.(2) ?? p.y),
                                            'TTFB: ' + (p.x?.toFixed?.(2) ?? p.x) + 's',
                                            'Total: ' + (p.total?.toFixed?.(2) ?? p.total) + 's',
                                            'Success: ' + srPct,
                                            'Cost: ' + costStr
                                        ];
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: 'TTFB (s)', color: getCssVar('--vscode-foreground', '#e6edf3'), font: { size: 13 } },
                                ticks: { color: getCssVar('--vscode-foreground', '#e6edf3'), font: { size: 12 }, padding: 6 },
                                grid: { color: 'rgba(255,255,255,0.12)' }
                            },
                            y: {
                                title: { display: true, text: 'Tokens/sec', color: getCssVar('--vscode-foreground', '#e6edf3'), font: { size: 13 } },
                                ticks: { color: getCssVar('--vscode-foreground', '#e6edf3'), font: { size: 12 }, padding: 6 },
                                grid: { color: 'rgba(255,255,255,0.12)' }
                            }
                        }
                    }
                });
            }

            // Radar: normalized aggregate metrics
            function renderRadarChart(result) {
                const canvas = document.getElementById('radarChart');
                const ctx = canvas ? canvas.getContext('2d') : null;
                if (!canvas || !ctx) return;

                // Ensure crisp rendering and enough height for labels
                try { canvas.style.setProperty('height', '320px', 'important'); } catch {}
                // Force a reflow so Chart picks up the new CSS height
                void canvas.offsetHeight;

                // Destroy previous
                if (state.charts.radar) {
                    try { state.charts.radar.destroy(); } catch {}
                    state.charts.radar = null;
                }

                const agg = result.aggregates || {};
                // Simple heuristic normalization to 0..100
                const clamp = (x) => Math.max(0, Math.min(100, x));
                const normUp = (x, scale) => clamp((x / (scale || 1)) * 100);
                const normDown = (x, scale) => 100 - normUp(x, scale);

                const speed = normUp(agg.meanTokensPerSecond || 0, 100);      // assume 100 TPS as strong
                const latency = normDown(agg.meanTTFB || 0, 5);                // 0..5s -> 100..0
                const cost = normDown(agg.meanCost || 0, 0.05);                // $0..$0.05 per run avg -> 100..0
                const consistency = normDown(agg.stdTokensPerSecond || 0, 50); // lower std is better
                const reliability = clamp((agg.successRate || 0) * 100);      // 0..100

                if (typeof Chart === 'undefined') {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Charts module unavailable', (canvas.width || 800) / 2, (canvas.height || 260) / 2);
                    return;
                }

                state.charts.radar = new Chart(ctx, {
                    type: 'radar',
                    data: {
                        labels: ['Speed', 'Latency', 'Cost', 'Consistency', 'Reliability'],
                        datasets: [{
                            label: 'Run Profile',
                            data: [speed, latency, cost, consistency, reliability],
                            backgroundColor: 'rgba(88,166,255,0.25)',
                            borderColor: getCssVar('--vscode-charts-blue', '#58a6ff'),
                            borderWidth: 2,
                            pointBackgroundColor: getCssVar('--vscode-charts-blue', '#58a6ff'),
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        devicePixelRatio: Math.max(1, (window.devicePixelRatio || 1)),
                        layout: { padding: { top: 24, right: 24, bottom: 24, left: 24 } },
                        plugins: {
                            legend: { display: true, position: 'bottom', labels: { color: getCssVar('--vscode-foreground', '#e6edf3'), padding: 12 } }
                        },
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(255,255,255,0.12)' },
                                grid: { color: 'rgba(255,255,255,0.12)' },
                                suggestedMin: 0,
                                suggestedMax: 100,
                                pointLabels: { color: getCssVar('--vscode-foreground', '#e6edf3'), font: { size: 12 }, padding: 8 },
                                ticks: { display: false }
                            }
                        }
                    }
                });
            }

            function exportReport() {
                if (!state.lastSuiteResult) {
                    showError('No suite result to export');
                    return;
                }
                vscode.postMessage({ command: 'exportDocument', payload: state.lastSuiteResult });
            }

            function exportCsv() {
                if (!state.lastSuiteResult) {
                    showError('No suite result to export');
                    return;
                }
                vscode.postMessage({ command: 'exportSuiteCsv', payload: state.lastSuiteResult });
            }

            // Optional PDF - requires jsPDF UMD bundled locally
            function exportPdf() {
                if (!state.lastSuiteResult) {
                    showError('No suite result to export');
                    return;
                }
                const hasJsPdf = typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined';
                if (!hasJsPdf) {
                    showError('PDF export not available. Ensure jsPDF (node_modules/jspdf/dist/jspdf.umd.min.js) is bundled');
                    return;
                }
                try {
                    const JSPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
                    const doc = new JSPDF({ unit: 'pt', format: 'a4' });
                    const margin = 40;
                    let y = margin;

                    doc.setFontSize(16);
                    doc.text('ORPT Benchmark Report', margin, y); y += 20;
                    doc.setFontSize(11);
                    const r = state.lastSuiteResult;
                    const lines = [
                        \`Date: \${new Date().toLocaleString()}\`,
                        \`Suite: \${r.suiteId}\`,
                        \`Model: \${r.model}\`,
                        \`Provider: \${r.provider}\`,
                        \`Runs: \${r.results.length}\`,
                        \`Mean TPS: \${r.aggregates.meanTokensPerSecond.toFixed(2)}\`,
                        \`Mean TTFB: \${r.aggregates.meanTTFB.toFixed(2)}s\`,
                        \`Mean Total: \${r.aggregates.meanTotalTime.toFixed(2)}s\`,
                        \`Mean Cost: $\${r.aggregates.meanCost.toFixed(4)}\`
                    ];
                    lines.forEach(line => { doc.text(line, margin, y); y += 14; });

                    // Capture canvases (if present)
                    const addCanvas = (id, title) => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        const dataUrl = el.toDataURL('image/png');
                        y += 10;
                        doc.setFontSize(12);
                        doc.text(title, margin, y); y += 6;
                        const imgW = 515; // A4 width minus margins
                        const imgH = (imgW / el.width) * el.height;
                        if (y + imgH > 800) { doc.addPage(); y = margin; }
                        doc.addImage(dataUrl, 'PNG', margin, y, imgW, imgH);
                        y += imgH + 6;
                    };
                    addCanvas('suiteChart', 'Per-case Mean TPS (Quick Chart)');
                    addCanvas('scatterChart', 'Scatter: TTFB vs TPS (per case)');
                    addCanvas('radarChart', 'Radar: Normalized Aggregates');

                    doc.save('orpt-report.pdf');
                } catch (e) {
                    showError('Failed to export PDF: ' + (e?.message || e));
                }
            }

            // Recommendation wizard
            function runRecommendation() {
                const provider = document.getElementById('providerSelect').value || 'auto';
                const budgetPer1k = parseFloat(document.getElementById('wizardBudget').value);
                const maxTTFB = parseFloat(document.getElementById('wizardMaxTtfb').value);
                const minTPS = parseFloat(document.getElementById('wizardMinTps').value);
                const weights = {
                    speed: parseFloat(document.getElementById('wSpeed').value || '0.4'),
                    latency: parseFloat(document.getElementById('wLatency').value || '0.3'),
                    cost: parseFloat(document.getElementById('wCost').value || '0.3')
                };

                const wsel = document.getElementById('wizardModelSelect');
                let modelIds = [];
                if (wsel && wsel.selectedOptions && wsel.selectedOptions.length) {
                    modelIds = Array.from(wsel.selectedOptions).map(o => o.value);
                } else {
                    modelIds = (state.models || []).map(m => m.id);
                }
                if (!modelIds.length) {
                    showError('No models selected or loaded. Save an API key first.');
                    return;
                }

                document.getElementById('wizardResults').innerHTML = '';
                updateWizardProgress({ message: 'Starting recommendation...' });

                const runBtn = document.getElementById('runRecommendBtn');
                if (runBtn) runBtn.setAttribute('disabled', 'true');
                const cancelBtn = document.getElementById('cancelRecommendBtn');
                if (cancelBtn) cancelBtn.removeAttribute('disabled');

                vscode.postMessage({
                    command: 'recommendModels',
                    payload: {
                        modelIds,
                        provider,
                        constraints: {
                            budgetPer1k: isFinite(budgetPer1k) ? budgetPer1k : undefined,
                            maxTTFB: isFinite(maxTTFB) ? maxTTFB : undefined,
                            minTPS: isFinite(minTPS) ? minTPS : undefined,
                            weights
                        }
                    }
                });
            }

            function updateWizardProgress(progress) {
                const el = document.getElementById('wizardProgress');
                if (!el) return;
                el.style.display = 'block';
                const pct = Math.max(0, Math.min(100,
                    (typeof progress?.percent === 'number')
                        ? progress.percent
                        : Math.round(((progress?.step || 0) / Math.max(1, progress?.total || 1)) * 100)
                ));
                const fill = document.getElementById('wizardRunFill');
                if (fill) fill.style.width = pct + '%';
                const txt = document.getElementById('wizardRunText');
                if (txt) txt.textContent = progress?.message || 'Running...';
                if (progress && progress.cancelled) {
                    const runBtn = document.getElementById('runRecommendBtn');
                    if (runBtn) runBtn.removeAttribute('disabled');
                    const cancelBtn = document.getElementById('cancelRecommendBtn');
                    if (cancelBtn) cancelBtn.setAttribute('disabled', 'true');
                }
            }

            function renderRecommendations(payload) {
                const el = document.getElementById('wizardResults');
                const prog = document.getElementById('wizardProgress');
                if (prog) prog.style.display = 'none';
                if (!el) return;

                const list = payload?.candidates || [];
                if (!list.length) {
                    el.innerHTML = '<p class="empty-state">No candidates to recommend.</p>';
                    return;
                }

                const html = list.map((c, idx) => {
                    const agg = c.aggregates || {};
                    const cost1k = (typeof c.costPer1k === 'number') ? ('$' + c.costPer1k.toFixed(4) + '/1k') : '—';
                    return \`
                        <div class="history-item">
                            <strong>#\${idx + 1} \${c.modelId}</strong> (Provider: \${c.provider})
                            <div class="metrics">
                                <div class="metric"><span class="metric-value">\${(agg.meanTokensPerSecond ?? 0).toFixed(2)}</span><span class="metric-label">TPS</span></div>
                                <div class="metric"><span class="metric-value">\${(agg.meanTTFB ?? 0).toFixed(2)}s</span><span class="metric-label">TTFB</span></div>
                                <div class="metric"><span class="metric-value">\${(agg.meanTotalTime ?? 0).toFixed(2)}s</span><span class="metric-label">Total</span></div>
                                <div class="metric"><span class="metric-value">\${cost1k}</span><span class="metric-label">Est. Cost</span></div>
                            </div>
                        </div>
                    \`;
                }).join('');
                el.innerHTML = html;
            }

            // Suite Builder helpers
            function newSuiteTemplate() {
                const id = 'custom-' + Date.now();
                const template = {
                    id,
                    name: 'New Custom Suite',
                    description: 'Describe your suite',
                    iterations: 2,
                    cases: [
                        { id: id + '-1', name: 'Case 1', prompt: 'Write a haiku about the ocean.', params: { max_tokens: 128 } }
                    ]
                };
                const editor = document.getElementById('suiteEditor');
                editor.value = JSON.stringify(template, null, 2);
            }
            function wizardSelectAllModels() {
                const wsel = document.getElementById('wizardModelSelect');
                if (!wsel) return;
                Array.from(wsel.options).forEach(o => { o.selected = true; });
            }
            function wizardSelectNoneModels() {
                const wsel = document.getElementById('wizardModelSelect');
                if (!wsel) return;
                Array.from(wsel.options).forEach(o => { o.selected = false; });
            }

            function loadSelectedSuiteToEditor() {
                const sel = document.getElementById('suiteSelect').value;
                if (!sel) {
                    showError('Select a suite first');
                    return;
                }
                const suite = (state.suites || []).find(s => s.id === sel);
                if (!suite) {
                    showError('Suite not found');
                    return;
                }
                document.getElementById('suiteEditor').value = JSON.stringify(suite, null, 2);
            }

            function deleteSelectedSuite() {
                const sel = document.getElementById('suiteSelect').value;
                if (!sel) {
                    showError('Select a suite to delete');
                    return;
                }
                vscode.postMessage({ command: 'deleteCustomSuite', suiteId: sel });
            }

            function saveSuiteJson() {
                const txt = document.getElementById('suiteEditor').value;
                if (!txt.trim()) {
                    showError('Nothing to save. Paste or create a suite JSON first.');
                    return;
                }
                try {
                    const suite = JSON.parse(txt);
                    if (!suite?.id || !suite?.name || !Array.isArray(suite?.cases)) {
                        showError('Invalid suite JSON. Require id, name, cases[].');
                        return;
                    }
                    vscode.postMessage({ command: 'saveCustomSuite', suite });
                } catch (e) {
                    showError('Invalid JSON: ' + e.message);
                }
            }

            function showError(message) {
                console.error(message);
            }

            function showSuccess(message) {
                console.log(message);
            }
        </script>
    </body>
    </html>`;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
