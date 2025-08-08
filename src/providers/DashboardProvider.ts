import * as vscode from 'vscode';
import { getWebviewContent } from '../webview/webviewContent';
import { OpenRouterClient } from '../api/OpenRouterClient';
import { TestConfig, TestResult, TestSuite, TestCase, SuiteRunResult, CaseResult } from '../types';

export class DashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'orpt.dashboard';
    private _view?: vscode.WebviewView;
    private _openRouterClient?: OpenRouterClient;

    // Built-in suites loaded from media/suites.json (cached)
    private _suites?: TestSuite[];
    private _wizardCancelled: boolean = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getWebviewContent(webviewView.webview, this._extensionUri);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'saveApiKey':
                        await this.saveApiKey(message.apiKey);
                        break;
                    case 'getApiKey':
                        await this.sendApiKey();
                        break;
                    case 'runTest':
                        await this.runTest(message.config);
                        break;
                    case 'getHistory':
                        await this.sendHistory();
                        break;
                    case 'clearHistory':
                        await this.clearHistory();
                        break;
                    case 'exportResults':
                        await this.exportResults(message.results);
                        break;
                    case 'clearApiKey':
                        await this.clearApiKey();
                        break;
                    case 'cancelTest':
                        this.cancelTest();
                        break;
                    case 'getSuites':
                        await this.sendSuites();
                        break;
                    case 'runSuite':
                        await this.runSuite(message.payload);
                        break;
                    case 'exportDocument':
                        await this.exportDocument(message.payload);
                        break;
                    case 'exportSuiteCsv':
                        await this.exportSuiteCsv(message.payload);
                        break;
                    case 'recommendModels':
                        await this.runRecommendation(message.payload);
                        break;
                    case 'getProvidersForModel':
                        await this.sendProvidersForModel(message.modelId);
                        break;
                    case 'getAllProviders':
                        await this.sendAllProviders();
                        break;
                    case 'cancelRecommendation':
                        this._wizardCancelled = true;
                        try { this._openRouterClient?.cancelCurrentRequest?.(); } catch {}
                        break;

                    // Suite Builder (custom suites) commands
                    case 'saveCustomSuite':
                        await this.saveCustomSuite(message.suite);
                        break;
                    case 'deleteCustomSuite':
                        await this.deleteCustomSuite(message.suiteId);
                        break;
                    case 'importSuitesJson':
                        await this.importSuitesJson();
                        break;
                    case 'exportSuitesJson':
                        await this.exportSuitesJson();
                        break;

                    case 'log':
                        console.log('Webview:', message.text);
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );

        // Watch configuration changes for history settings
        this._context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                if (
                    e.affectsConfiguration('orpt.saveTestHistory') ||
                    e.affectsConfiguration('orpt.maxHistoryItems') ||
                    e.affectsConfiguration('orpt')
                ) {
                    const cfg = vscode.workspace.getConfiguration('orpt');
                    const save = cfg.get<boolean>('saveTestHistory', true);
                    const limit = Math.max(1, (cfg.get<number>('maxHistoryItems', 100) ?? 100));
                    let history = this.getHistoryFromStorage();

                    if (!save) {
                        history = [];
                        await this._context.globalState.update('orpt.history', history);
                        this.postMessage({ command: 'historyCleared' });
                    } else if (history.length > limit) {
                        history = history.slice(0, limit);
                        await this._context.globalState.update('orpt.history', history);
                    }

                    this.postMessage({ command: 'history', history });
                }
            })
        );

        // Initialize the webview
        this.initializeWebview();
    }

    private async initializeWebview() {
        // Send initial data to webview
        await this.sendApiKey();
        await this.sendHistory();
        await this.sendModels();
        // Suites are requested on-demand by the webview via getSuites
    }

    private async saveApiKey(apiKey: string) {
        await this._context.secrets.store('orpt.apiKey', apiKey);
        this._openRouterClient = new OpenRouterClient(apiKey);
        try {
            const timeout = vscode.workspace.getConfiguration('orpt').get<number>('requestTimeoutMs', 120000);
            this._openRouterClient.setRequestTimeoutMs?.(timeout);
        } catch {}
        this.postMessage({ command: 'apiKeySaved', success: true });
        await this.sendModels();
        await this.sendAllProviders();
    }

    private async clearApiKey() {
        await this._context.secrets.delete('orpt.apiKey');
        this._openRouterClient = undefined;
        this.postMessage({ 
            command: 'apiKey', 
            hasKey: false,
            masked: '' 
        });
    }

    private cancelTest() {
        try {
            this._openRouterClient?.cancelCurrentRequest?.();
        } finally {
            // Notify webview; reuse testError channel for backwards compatibility
            this.postMessage({ command: 'testError', error: 'Test cancelled' });
        }
    }

    private async sendApiKey() {
        const apiKey = await this._context.secrets.get('orpt.apiKey');
        this.postMessage({ 
            command: 'apiKey', 
            hasKey: !!apiKey,
            masked: apiKey ? `sk-or-v1-${'*'.repeat(20)}` : ''
        });
        
        if (apiKey) {
            this._openRouterClient = new OpenRouterClient(apiKey);
            try {
                const timeout = vscode.workspace.getConfiguration('orpt').get<number>('requestTimeoutMs', 120000);
                this._openRouterClient.setRequestTimeoutMs?.(timeout);
            } catch {}
            await this.sendModels();
            await this.sendAllProviders();
        }
    }

    private async runTest(config: TestConfig) {
        if (!this._openRouterClient) {
            this.postMessage({ 
                command: 'testError', 
                error: 'Please set your API key first' 
            });
            return;
        }

        try {
            this.postMessage({ command: 'testStarted' });
            
            try {
                const timeout = vscode.workspace.getConfiguration('orpt').get<number>('requestTimeoutMs', 120000);
                this._openRouterClient.setRequestTimeoutMs?.(timeout);
            } catch {}
            const result = await this._openRouterClient.runPerformanceTest(
                config,
                (progress) => {
                    this.postMessage({ 
                        command: 'testProgress', 
                        progress 
                    });
                }
            );

            // Save to history based on settings
            const cfg = vscode.workspace.getConfiguration('orpt');
            const save = cfg.get<boolean>('saveTestHistory', true);
            const limit = Math.max(1, (cfg.get<number>('maxHistoryItems', 100) ?? 100));
            if (save) {
                const history = this.getHistoryFromStorage();
                history.unshift(result);
                if (history.length > limit) {
                    history.length = limit;
                }
                await this._context.globalState.update('orpt.history', history);
            }

            this.postMessage({ 
                command: 'testCompleted', 
                result 
            });
        } catch (error: any) {
            this.postMessage({ 
                command: 'testError', 
                error: error.message 
            });
        }
    }

    private async sendHistory() {
        const history = this.getHistoryFromStorage();
        this.postMessage({ 
            command: 'history', 
            history 
        });
    }

    private getHistoryFromStorage(): TestResult[] {
        return this._context.globalState.get('orpt.history', []);
    }

    private async clearHistory() {
        await this._context.globalState.update('orpt.history', []);
        this.postMessage({ command: 'historyCleared' });
    }

    private async exportResults(results: TestResult[]) {
        const json = JSON.stringify(results, null, 2);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('orpt-test-results.json'),
            filters: {
                'JSON': ['json']
            }
        });
        
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(json));
            vscode.window.showInformationMessage('Results exported successfully!');
        }
    }

    private async sendModels() {
        // Try to load models dynamically from OpenRouter; fallback to static list on failure
        const fallback = [
            { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
            { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
            { id: 'google/gemini-pro', name: 'Gemini Pro', provider: 'Google' },
            { id: 'meta-llama/llama-3-70b', name: 'Llama 3 70B', provider: 'Meta' },
            { id: 'mistralai/mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'Mistral' },
        ];

        if (!this._openRouterClient) {
            this.postMessage({ command: 'models', models: fallback });
            return;
        }

        try {
            const models = await this._openRouterClient.listModels();
            if (models && models.length) {
                this.postMessage({ command: 'models', models });
            } else {
                this.postMessage({ command: 'models', models: fallback });
            }
        } catch {
            this.postMessage({ command: 'models', models: fallback });
        }
    }

    // Fallback static providers (used when API not available)
    private sendProviders() {
        const providers = [
            'auto',
            'OpenAI',
            'Anthropic',
            'Google',
            'Together',
            'Replicate',
            'Perplexity',
            'Fireworks'
        ];
        this.postMessage({ command: 'providers', providers });
    }

    private async sendAllProviders() {
        if (!this._openRouterClient) {
            this.postMessage({ command: 'providers', scope: 'global', providers: ['auto'] });
            return;
        }
        try {
            const providers = await this._openRouterClient.listProviders();
            const list = ['auto', ...Array.from(new Set(providers))];
            this.postMessage({ command: 'providers', scope: 'global', providers: list });
        } catch {
            this.postMessage({ command: 'providers', scope: 'global', providers: ['auto'] });
        }
    }

    private async sendProvidersForModel(modelId: string) {
        if (!this._openRouterClient || !modelId) {
            await this.sendAllProviders();
            return;
        }
        try {
            // Prefer detailed endpoints for richer labels in the UI
            let endpointsDetailed: any[] | undefined;
            try {
                endpointsDetailed = await (this._openRouterClient as any).listModelEndpointsDetailed?.(modelId);
            } catch {}
            if (endpointsDetailed && endpointsDetailed.length) {
                const slugs = Array.from(new Set(endpointsDetailed
                    .map(e => e?.provider_name || e?.provider || e?.name || e?.id)
                    .filter(Boolean)));
                const meta: Record<string, any> = {};
                for (const e of endpointsDetailed) {
                    const slug = e?.provider_name || e?.provider || e?.name || e?.id;
                    if (slug) meta[slug] = e;
                }
                const list = ['auto', ...slugs];
                this.postMessage({ command: 'providers', scope: 'model', modelId, providers: list, meta });
                return;
            }

            // Fallback to simple provider list
            const endpoints = await this._openRouterClient.listModelEndpoints(modelId);
            let specific: string[] = Array.from(new Set(endpoints || [])).filter(Boolean);
            if (!specific.length) {
                specific = this.guessProvidersFromModelId(modelId);
            }
            const list = ['auto', ...specific];
            this.postMessage({ command: 'providers', scope: 'model', modelId, providers: list });
        } catch {
            const list = ['auto', ...this.guessProvidersFromModelId(modelId)];
            this.postMessage({ command: 'providers', scope: 'model', modelId, providers: list });
        }
    }

    // Load built-in suites (cached)
    private async loadSuites(): Promise<void> {
        if (this._suites) return;
        try {
            const uri = vscode.Uri.joinPath(this._extensionUri, 'media', 'suites.json');
            const data = await vscode.workspace.fs.readFile(uri);
            const json = JSON.parse(Buffer.from(data).toString('utf8'));
            if (json && Array.isArray(json.suites)) {
                this._suites = json.suites as TestSuite[];
            } else {
                this._suites = [];
            }
        } catch (e) {
            console.error('Failed to load suites:', e);
            this._suites = [];
        }
    }

    // Custom suites (user-managed)
    private getCustomSuitesFromStorage(): TestSuite[] {
        return this._context.globalState.get<TestSuite[]>('orpt.customSuites', []);
    }

    private async setCustomSuitesToStorage(suites: TestSuite[]): Promise<void> {
        await this._context.globalState.update('orpt.customSuites', suites);
    }

    private async getAllSuites(): Promise<TestSuite[]> {
        await this.loadSuites();
        const builtIn = this._suites ?? [];
        const custom = this.getCustomSuitesFromStorage();

        // Merge by id; custom overrides built-in
        const map = new Map<string, TestSuite>();
        for (const s of builtIn) map.set(s.id, s);
        for (const s of custom) map.set(s.id, s);

        return Array.from(map.values());
    }

    private async sendSuites() {
        const all = await this.getAllSuites();
        this.postMessage({ command: 'suites', suites: all });
    }

    private async runSuite(payload: {
        suiteId: string;
        model: string;
        provider: string;
        iterations?: number;
        params?: { temperature?: number; top_p?: number; max_tokens?: number };
    }) {
        if (!this._openRouterClient) {
            this.postMessage({ command: 'suiteError', error: 'Please set your API key first' });
            return;
        }
        try {
            const timeout = vscode.workspace.getConfiguration('orpt').get<number>('requestTimeoutMs', 120000);
            this._openRouterClient.setRequestTimeoutMs?.(timeout);
        } catch {}
        const allSuites = await this.getAllSuites();
        const suite = allSuites.find(s => s.id === payload.suiteId);
        if (!suite) {
            this.postMessage({ command: 'suiteError', error: `Suite not found: ${payload.suiteId}` });
            return;
        }

        const startedAt = new Date().toISOString();
        const results: CaseResult[] = [];
        const iterations = Math.max(1, payload.iterations ?? suite.iterations ?? 1);
        const totalSteps = suite.cases.length * iterations;
        let step = 0;

        for (const testCase of suite.cases) {
            for (let it = 1; it <= iterations; it++) {
                step++;
                this.postMessage({
                    command: 'suiteProgress',
                    progress: {
                        suiteId: suite.id,
                        step,
                        total: totalSteps,
                        message: `Running ${testCase.name} (iteration ${it}/${iterations})`
                    }
                });

                const maxTokens =
                    payload.params?.max_tokens ??
                    testCase.params?.max_tokens ??
                    512;

                const temperature =
                    payload.params?.temperature ??
                    testCase.params?.temperature;

                const topP =
                    payload.params?.top_p ??
                    testCase.params?.top_p;

                try {
                    const result = await this._openRouterClient.runPerformanceTest(
                        {
                            model: payload.model,
                            provider: payload.provider,
                            prompt: testCase.prompt,
                            maxTokens,
                            temperature,
                            topP
                        },
                        // Per-request progress can be verbose; omit to keep suite progress clean
                        () => {}
                    );

                    results.push({
                        caseId: testCase.id,
                        iteration: it,
                        ok: true,
                        result
                    });
                } catch (e: any) {
                    results.push({
                        caseId: testCase.id,
                        iteration: it,
                        ok: false,
                        error: e?.message ?? String(e)
                    });
                }
            }
        }

        const finishedAt = new Date().toISOString();
        const aggregates = this.computeAggregates(results);
        const runResult: SuiteRunResult = {
            suiteId: suite.id,
            model: payload.model,
            provider: payload.provider,
            startedAt,
            finishedAt,
            results,
            aggregates
        };

        this.postMessage({ command: 'suiteCompleted', result: runResult });
    }

    private computeAggregates(results: CaseResult[]): SuiteRunResult['aggregates'] {
        const okResults = results.filter(r => r.ok && r.result?.tokensPerSecond != null) as Array<CaseResult & { result: TestResult }>;
        const tps = okResults.map(r => r.result.tokensPerSecond);
        const ttfb = okResults.map(r => r.result.timeToFirstToken);
        const total = okResults.map(r => r.result.totalTime);
        const cost = okResults.map(r => r.result.cost);
        const totalPrompt = okResults.reduce((acc, r) => acc + (r.result.promptTokens ?? 0), 0);
        const totalCompletion = okResults.reduce((acc, r) => acc + (r.result.completionTokens ?? r.result.outputTokens ?? 0), 0);

        const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const std = (arr: number[]) => {
            if (arr.length < 2) return 0;
            const m = mean(arr);
            const v = arr.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / (arr.length - 1);
            return Math.sqrt(v);
        };

        return {
            meanTokensPerSecond: mean(tps),
            meanTTFB: mean(ttfb),
            meanTotalTime: mean(total),
            meanCost: mean(cost),
            stdTokensPerSecond: std(tps),
            stdTTFB: std(ttfb),
            stdTotalTime: std(total),
            stdCost: std(cost),
            successRate: results.length ? okResults.length / results.length : 0,
            totalPromptTokens: totalPrompt,
            totalCompletionTokens: totalCompletion
        };
    }

    private async exportDocument(payload: SuiteRunResult) {
        // Simple executive-style Markdown export
        const lines: string[] = [];
        lines.push(`# ORPT Benchmark Report`);
        lines.push('');
        lines.push(`- Date: ${new Date().toLocaleString()}`);
        lines.push(`- Suite: ${payload.suiteId}`);
        lines.push(`- Model: ${payload.model}`);
        lines.push(`- Provider: ${payload.provider}`);
        lines.push(`- Runs: ${payload.results.length}`);
        lines.push('');
        lines.push(`## Executive Summary`);
        lines.push(`- Mean Tokens/sec: ${payload.aggregates.meanTokensPerSecond.toFixed(2)}`);
        lines.push(`- Mean TTFB (s): ${payload.aggregates.meanTTFB.toFixed(2)}`);
        lines.push(`- Mean Total Time (s): ${payload.aggregates.meanTotalTime.toFixed(2)}`);
        lines.push(`- Mean Cost (USD): $${payload.aggregates.meanCost.toFixed(4)}`);
        lines.push(`- Success Rate: ${(payload.aggregates.successRate * 100).toFixed(1)}%`);
        lines.push('');
        lines.push(`## Detailed Results`);
        lines.push(`| Case ID | Iter | TPS | TTFB (s) | Total (s) | Cost (USD) | Prompt Toks | Completion Toks | Error |`);
        lines.push(`|---|---:|---:|---:|---:|---:|---:|---:|---|`);
        for (const r of payload.results) {
            const res = r.result;
            if (r.ok && res) {
                lines.push(`| ${r.caseId} | ${r.iteration} | ${res.tokensPerSecond.toFixed(2)} | ${res.timeToFirstToken.toFixed(2)} | ${res.totalTime.toFixed(2)} | $${res.cost.toFixed(4)} | ${res.promptTokens ?? ''} | ${res.completionTokens ?? res.outputTokens ?? ''} | |`);
            } else {
                lines.push(`| ${r.caseId} | ${r.iteration} |  |  |  |  |  |  | ${r.error ?? 'Error'} |`);
            }
        }
        lines.push('');
        lines.push(`## Aggregates`);
        lines.push(`- Tokens/sec: mean=${payload.aggregates.meanTokensPerSecond.toFixed(2)}, std=${(payload.aggregates.stdTokensPerSecond ?? 0).toFixed(2)}`);
        lines.push(`- TTFB: mean=${payload.aggregates.meanTTFB.toFixed(2)}, std=${(payload.aggregates.stdTTFB ?? 0).toFixed(2)}`);
        lines.push(`- Total Time: mean=${payload.aggregates.meanTotalTime.toFixed(2)}, std=${(payload.aggregates.stdTotalTime ?? 0).toFixed(2)}`);
        lines.push(`- Cost: mean=$${payload.aggregates.meanCost.toFixed(4)}, std=$${(payload.aggregates.stdCost ?? 0).toFixed(4)}`);
        lines.push(`- Total Prompt Tokens: ${payload.aggregates.totalPromptTokens ?? 0}`);
        lines.push(`- Total Completion Tokens: ${payload.aggregates.totalCompletionTokens ?? 0}`);

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('orpt-report.md'),
            filters: { 'Markdown': ['md'] }
        });
        if (!uri) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join('\n'), 'utf8'));
        vscode.window.showInformationMessage('Executive report exported (Markdown)');
    }

    private async exportSuiteCsv(payload: SuiteRunResult) {
        try {
            const header = [
                'caseId',
                'iteration',
                'ok',
                'tokensPerSecond',
                'timeToFirstToken',
                'totalTime',
                'cost',
                'promptTokens',
                'completionTokens',
                'error'
            ];
            const rows: string[] = [];
            rows.push(header.join(','));

            for (const r of payload.results) {
                const res = r.result;
                const cells = [
                    r.caseId,
                    String(r.iteration),
                    r.ok ? 'true' : 'false',
                    res ? String(res.tokensPerSecond ?? '') : '',
                    res ? String(res.timeToFirstToken ?? '') : '',
                    res ? String(res.totalTime ?? '') : '',
                    res ? String(res.cost ?? '') : '',
                    res ? String(res.promptTokens ?? '') : '',
                    res ? String(res.completionTokens ?? res.outputTokens ?? '') : '',
                    r.ok ? '' : (r.error ?? 'Error')
                ];
                const esc = (v: string) => {
                    const s = v ?? '';
                    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                        return '"' + s.replace(/"/g, '""') + '"';
                    }
                    return s;
                };
                rows.push(cells.map(x => esc(String(x))).join(','));
            }

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('orpt-results.csv'),
                filters: { 'CSV': ['csv'] },
                saveLabel: 'Save Results CSV'
            });
            if (!uri) return;

            await vscode.workspace.fs.writeFile(uri, Buffer.from(rows.join('\n'), 'utf8'));
            vscode.window.showInformationMessage('Suite results exported (CSV)');
        } catch (e: any) {
            vscode.window.showErrorMessage(`CSV export failed: ${e?.message ?? String(e)}`);
        }
    }

    // Recommendation engine: quick compare across selected models using a small subset of a suite
    private async runRecommendation(payload: {
        modelIds: string[];
        suiteId?: string;
        provider?: string; // default 'auto'
        constraints?: {
            budgetPer1k?: number;
            maxTTFB?: number;
            minTPS?: number;
            allowProviders?: string[];
            weights?: { speed: number; latency: number; cost: number; quality?: number };
        };
    }) {
        if (!this._openRouterClient) {
            this.postMessage({ command: 'suiteError', error: 'Please set your API key first' });
            return;
        }
        this._wizardCancelled = false;
        try {
            const timeout = vscode.workspace.getConfiguration('orpt').get<number>('requestTimeoutMs', 120000);
            this._openRouterClient.setRequestTimeoutMs?.(timeout);
        } catch {}

        const suites = await this.getAllSuites();
        const suite = suites.find(s => s.id === (payload.suiteId || 'general-purpose-v1')) || suites[0];
        if (!suite) {
            this.postMessage({ command: 'suiteError', error: 'No suites available for recommendation' });
            return;
        }

        const provider = payload.provider ?? 'auto';
        const miniCases = suite.cases.slice(0, Math.min(3, suite.cases.length));
        const candidates: any[] = [];
        const totalSteps = (payload.modelIds?.length || 0) * miniCases.length;
        let step = 0;

        for (const modelId of payload.modelIds || []) {
            const caseResults: CaseResult[] = [];

            for (const testCase of miniCases) {
                if (this._wizardCancelled) {
                    this.postMessage({
                        command: 'wizardProgress',
                        progress: { step, total: totalSteps, message: 'Recommendation cancelled', cancelled: true }
                    });
                    return;
                }
                step++;
                this.postMessage({
                    command: 'wizardProgress',
                    progress: {
                        step,
                        total: totalSteps,
                        message: `Testing ${modelId} • ${testCase.name}`
                    }
                });

                const maxTokens = testCase.params?.max_tokens ?? 256;
                const temperature = testCase.params?.temperature;
                const topP = testCase.params?.top_p;

                try {
                    const result = await this._openRouterClient.runPerformanceTest(
                        {
                            model: modelId,
                            provider,
                            prompt: testCase.prompt,
                            maxTokens,
                            temperature,
                            topP
                        },
                        () => {}
                    );

                    caseResults.push({
                        caseId: testCase.id,
                        iteration: 1,
                        ok: true,
                        result
                    });
                } catch (e: any) {
                    caseResults.push({
                        caseId: testCase.id,
                        iteration: 1,
                        ok: false,
                        error: e?.message ?? String(e)
                    });
                }
            }

            const aggregates = this.computeAggregates(caseResults);
            // Approximate cost per 1k tokens from aggregates
            const totalTokens = (aggregates.totalPromptTokens ?? 0) + (aggregates.totalCompletionTokens ?? 0);
            const avgTokens = miniCases.length ? totalTokens / miniCases.length : 0;
            const costPer1k = avgTokens > 0 ? (aggregates.meanCost / (avgTokens / 1000)) : undefined;

            candidates.push({
                modelId,
                provider,
                aggregates,
                costPer1k
            });
        }

        // Apply constraints and scoring
        const weights = payload.constraints?.weights ?? { speed: 0.4, latency: 0.3, cost: 0.3, quality: 0.0 };
        const maxTTFB = payload.constraints?.maxTTFB;
        const minTPS = payload.constraints?.minTPS;
        const budgetPer1k = payload.constraints?.budgetPer1k;

        // Filter
        let filtered = candidates.filter(c => {
            const passTTFB = typeof maxTTFB === 'number' ? (c.aggregates.meanTTFB <= maxTTFB) : true;
            const passTPS = typeof minTPS === 'number' ? (c.aggregates.meanTokensPerSecond >= minTPS) : true;
            const passBudget = typeof budgetPer1k === 'number' ? ((c.costPer1k ?? Number.POSITIVE_INFINITY) <= budgetPer1k) : true;
            return passTTFB && passTPS && passBudget;
        });

        if (filtered.length === 0) {
            filtered = candidates; // if all filtered out, show something
        }

        // Compute z-scores
        const arrTPS = filtered.map(c => c.aggregates.meanTokensPerSecond);
        const arrTTFB = filtered.map(c => c.aggregates.meanTTFB);
        const arrCost1k = filtered.map(c => (c.costPer1k ?? c.aggregates.meanCost)); // fallback
        const z = (arr: number[], x: number) => {
            const m = arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
            const v = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length || 1);
            const s = Math.sqrt(v) || 1;
            return (x - m) / s;
        };

        filtered.forEach(c => {
            const zSpeed = z(arrTPS, c.aggregates.meanTokensPerSecond);   // higher is better
            const zLatency = z(arrTTFB, c.aggregates.meanTTFB);           // lower is better
            const zCost = z(arrCost1k, (c.costPer1k ?? c.aggregates.meanCost)); // lower is better
            const quality = 0; // placeholder for future quality score
            c.score = (weights.speed * zSpeed) + (weights.latency * -zLatency) + (weights.cost * -zCost) + (weights.quality ?? 0) * quality;
        });

        filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        if (this._wizardCancelled) {
            this.postMessage({
                command: 'wizardProgress',
                progress: { step: totalSteps, total: totalSteps, message: 'Recommendation cancelled', cancelled: true }
            });
            this._wizardCancelled = false;
            return;
        }

        this.postMessage({
            command: 'wizardRecommendation',
            payload: {
                suiteId: suite.id,
                provider,
                candidates: filtered
            }
        });
        this._wizardCancelled = false;
    }

    // Custom suites CRUD + Import/Export

    private validateSuiteShape(s: any): s is TestSuite {
        return !!s && typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.cases);
    }

    private normalizeSuite(s: TestSuite): TestSuite {
        // Remove undefined fields to keep storage compact; ensure required fields exist
        const cases = (s.cases || []).map(c => ({
            id: c.id,
            name: c.name,
            prompt: c.prompt,
            reference: c.reference,
            tags: c.tags,
            params: c.params,
            weight: c.weight
        }));
        return {
            id: s.id,
            name: s.name,
            description: s.description,
            iterations: s.iterations,
            version: s.version,
            cases
        };
    }

    private async saveCustomSuite(suite: any) {
        try {
            if (!this.validateSuiteShape(suite)) {
                vscode.window.showErrorMessage('Invalid suite JSON: require id, name, cases[]');
                return;
            }
            const normalized = this.normalizeSuite(suite as TestSuite);
            const custom = this.getCustomSuitesFromStorage();
            const idx = custom.findIndex(s => s.id === normalized.id);
            if (idx >= 0) {
                custom[idx] = normalized;
            } else {
                custom.push(normalized);
            }
            await this.setCustomSuitesToStorage(custom);
            await this.sendSuites();
            vscode.window.showInformationMessage(`Saved custom suite "${normalized.name}"`);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to save suite: ${e?.message ?? String(e)}`);
        }
    }

    private async deleteCustomSuite(suiteId: string) {
        if (!suiteId) {
            vscode.window.showErrorMessage('No suiteId provided');
            return;
        }
        const custom = this.getCustomSuitesFromStorage();
        const idx = custom.findIndex(s => s.id === suiteId);
        if (idx < 0) {
            vscode.window.showWarningMessage('Selected suite is not a custom suite or does not exist');
            return;
        }
        custom.splice(idx, 1);
        await this.setCustomSuitesToStorage(custom);
        await this.sendSuites();
        vscode.window.showInformationMessage(`Deleted custom suite "${suiteId}"`);
    }

    private async importSuitesJson() {
        try {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'JSON': ['json'] },
                openLabel: 'Import Suites JSON'
            });
            if (!uris || !uris[0]) return;

            const data = await vscode.workspace.fs.readFile(uris[0]);
            const text = Buffer.from(data).toString('utf8');
            let json: any;
            try {
                json = JSON.parse(text);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Invalid JSON: ${e?.message ?? String(e)}`);
                return;
            }

            let incoming: any[] = [];
            if (Array.isArray(json)) {
                incoming = json;
            } else if (Array.isArray(json?.suites)) {
                incoming = json.suites;
            } else if (json && typeof json === 'object' && this.validateSuiteShape(json)) {
                incoming = [json];
            } else {
                vscode.window.showErrorMessage('No suites found in JSON');
                return;
            }

            const valid: TestSuite[] = [];
            for (const s of incoming) {
                if (this.validateSuiteShape(s)) {
                    valid.push(this.normalizeSuite(s));
                }
            }
            if (!valid.length) {
                vscode.window.showWarningMessage('No valid suites to import');
                return;
            }

            // Merge into custom (override by id)
            const custom = this.getCustomSuitesFromStorage();
            const map = new Map<string, TestSuite>();
            for (const s of custom) map.set(s.id, s);
            for (const s of valid) map.set(s.id, s);
            const merged = Array.from(map.values());

            await this.setCustomSuitesToStorage(merged);
            await this.sendSuites();

            vscode.window.showInformationMessage(`Imported ${valid.length} suite(s)`);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Import failed: ${e?.message ?? String(e)}`);
        }
    }

    private async exportSuitesJson() {
        try {
            const custom = this.getCustomSuitesFromStorage();
            const payload = { suites: custom };
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('orpt-custom-suites.json'),
                filters: { 'JSON': ['json'] },
                saveLabel: 'Export Suites JSON'
            });
            if (!uri) return;
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
            vscode.window.showInformationMessage(`Exported ${custom.length} custom suite(s)`);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Export failed: ${e?.message ?? String(e)}`);
        }
    }

    private guessProvidersFromModelId(modelId: string): string[] {
        const prefix = (modelId.split('/')[0] || '').toLowerCase();
        switch (prefix) {
            case 'openai': return ['OpenAI'];
            case 'anthropic': return ['Anthropic'];
            case 'google': return ['Google'];
            case 'meta-llama': return ['Meta'];
            case 'mistral':
            case 'mistralai': return ['Mistral'];
            case 'x-ai': return ['xAI'];
            case 'groq': return ['Groq'];
            case 'together': return ['Together'];
            case 'perplexity': return ['Perplexity'];
            case 'fireworks': return ['Fireworks'];
            case 'cohere': return ['Cohere'];
            case 'ai21': return ['AI21'];
            default: return [];
        }
    }

    private postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
}
