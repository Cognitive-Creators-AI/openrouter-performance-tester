import * as https from 'https';
import type { ClientRequest } from 'http';
import { TestConfig, TestResult, Model } from '../types';

export class OpenRouterClient {
    private apiKey: string;
    private baseUrl = 'openrouter.ai';
    private currentRequest?: ClientRequest;
    private cancelled = false;
    private cachedModels?: Model[];

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async runPerformanceTest(
        config: TestConfig,
        onProgress: (progress: { percent: number; message: string }) => void
    ): Promise<TestResult> {
        const startTime = Date.now();
        
        onProgress({ percent: 10, message: 'Connecting to OpenRouter...' });
        this.cancelled = false;

        return new Promise((resolve, reject) => {
            const body: any = {
                model: config.model,
                messages: [
                    {
                        role: 'user',
                        content: config.prompt
                    }
                ],
                max_tokens: config.maxTokens,
                stream: true,
                provider: config.provider === 'auto' ? undefined : { order: [config.provider] }
            };
            if (typeof config.temperature === 'number') {
                body.temperature = config.temperature;
            }
            if (typeof config.topP === 'number') {
                body.top_p = config.topP;
            }
            const postData = JSON.stringify(body);

            const options = {
                hostname: this.baseUrl,
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Content-Length': Buffer.byteLength(postData),
                    'HTTP-Referer': 'https://github.com/Cognitive-Creators-AI/openrouter-performance-tester',
                    'X-Title': 'ORPT Performance Test',
                    'User-Agent': 'ORPT'
                }
            };

            const req = https.request(options, (res) => {
                if (res.statusCode !== 200) {
                    let errBody = '';
                    res.on('data', (chunk) => { errBody += chunk.toString(); });
                    res.on('end', () => {
                    this.currentRequest = undefined;
                    this.cancelled = false;
                        reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage}${errBody ? ' - ' + errBody.slice(0, 500) : ''}`));
                    });
                    res.on('error', (error) => {
                        reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage} - ${error.message}`));
                    });
                    return;
                }

                onProgress({ percent: 30, message: 'Receiving response...' });

                let outputTokens = 0;
                let firstTokenTime: number | null = null;
                let output = '';
                let buffer = '';
                let usageCompletionTokens: number | undefined;
                let usagePromptTokens: number | undefined;

                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const json = JSON.parse(data);

                                if (json.usage) {
                                    if (typeof json.usage.completion_tokens === 'number') {
                                        usageCompletionTokens = json.usage.completion_tokens;
                                    }
                                    if (typeof json.usage.prompt_tokens === 'number') {
                                        usagePromptTokens = json.usage.prompt_tokens;
                                    }
                                }

                                const deltaContent: string | undefined = json.choices?.[0]?.delta?.content;
                                if (deltaContent) {
                                    if (!firstTokenTime) {
                                        firstTokenTime = Date.now();
                                    }
                                    output += deltaContent;

                                    // Approximate tokens from characters if usage is not yet available
                                    const approx = Math.ceil(deltaContent.length / 4);
                                    outputTokens += approx;

                                    const progress = Math.min(30 + (outputTokens / Math.max(1, config.maxTokens)) * 60, 99);
                                    onProgress({ 
                                        percent: progress, 
                                        message: `Generating... ~${outputTokens} tokens` 
                                    });
                                }
                            } catch (e) {
                                // Ignore parsing errors
                            }
                        }
                    }
                });

                res.on('end', () => {
                    const endTime = Date.now();
                    const totalTime = Math.max(0.001, (endTime - startTime) / 1000);
                    const timeToFirstToken = firstTokenTime ? (firstTokenTime - startTime) / 1000 : 0;

                    const finalCompletionTokens = typeof usageCompletionTokens === 'number' ? usageCompletionTokens : outputTokens;
                    const finalPromptTokens = typeof usagePromptTokens === 'number' ? usagePromptTokens : undefined;
                    const tokensPerSecond = finalCompletionTokens / totalTime;

                    onProgress({ percent: 100, message: 'Test completed!' });

                    // Compute cost using cached pricing if available; fallback heuristic otherwise
                    const pricing = this.getModelPricing(config.model);
                    const inputCost = pricing.input ? ((finalPromptTokens ?? 0) / 1000) * pricing.input : 0;
                    const outputCost = pricing.output ? (finalCompletionTokens / 1000) * pricing.output : 0;
                    const estimatedCost = (inputCost + outputCost) || ((finalCompletionTokens / 1000) * 0.002);

                    resolve({
                        model: config.model,
                        provider: config.provider,
                        prompt: config.prompt,
                        output,
                        outputTokens: finalCompletionTokens,
                        completionTokens: finalCompletionTokens,
                        promptTokens: finalPromptTokens,
                        totalTime,
                        timeToFirstToken,
                        tokensPerSecond,
                        cost: estimatedCost,
                        timestamp: new Date().toISOString()
                    });
                });

                res.on('error', (error) => {
                    this.currentRequest = undefined;
                    if (this.cancelled) {
                        this.cancelled = false;
                        reject(new Error('Request cancelled'));
                    } else {
                        reject(new Error(`Stream error: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                this.currentRequest = undefined;
                if (this.cancelled) {
                    this.cancelled = false;
                    reject(new Error('Request cancelled'));
                } else {
                    reject(new Error(`Request failed: ${error.message}`));
                }
            });

            // Timeout to avoid hanging requests
            req.setTimeout(60000, () => {
                req.destroy(new Error('Request timed out'));
            });

            this.currentRequest = req;
            req.write(postData);
            req.end();
        });
    }

    public cancelCurrentRequest(): void {
        this.cancelled = true;
        try {
            this.currentRequest?.destroy(new Error('Cancelled'));
        } finally {
            // cleanup handled by error listeners
        }
    }

    public async listModels(): Promise<Model[]> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                path: '/api/v1/models',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'ORPT'
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Models API Error: ${res.statusCode} ${res.statusMessage}${body ? ' - ' + body.slice(0, 500) : ''}`));
                    }
                    try {
                        const json = JSON.parse(body);
                        const arr = Array.isArray(json)
                            ? json
                            : (Array.isArray(json.data) ? json.data : (Array.isArray(json.models) ? json.models : []));
                        const models: Model[] = arr.map((m: any) => {
                            const id: string = m.id || '';
                            const name: string = m.name || id;
                            const provider = (() => {
                                const prefix = (id.split('/')[0] || '').toLowerCase();
                                switch (prefix) {
                                    case 'openai': return 'OpenAI';
                                    case 'anthropic': return 'Anthropic';
                                    case 'google': return 'Google';
                                    case 'meta-llama': return 'Meta';
                                    case 'mistralai':
                                    case 'mistral': return 'Mistral';
                                    case 'together': return 'Together';
                                    case 'perplexity': return 'Perplexity';
                                    case 'fireworks': return 'Fireworks';
                                    default: return m.provider || prefix || 'Unknown';
                                }
                            })();
                            const pricingRaw = m.pricing || {};
                            const pricing = (pricingRaw && (pricingRaw.input || pricingRaw.output || pricingRaw.prompt || pricingRaw.completion)) ? {
                                input: typeof pricingRaw.input === 'number' ? pricingRaw.input : (typeof pricingRaw.prompt === 'number' ? pricingRaw.prompt : undefined),
                                output: typeof pricingRaw.output === 'number' ? pricingRaw.output : (typeof pricingRaw.completion === 'number' ? pricingRaw.completion : undefined),
                            } : undefined;
                            const contextLength: number | undefined = m.context_length || m.contextLength || undefined;
                            return { id, name, provider, contextLength, pricing };
                        });
                        this.cachedModels = models;
                        resolve(models);
                    } catch (e: any) {
                        reject(new Error(`Failed to parse models response: ${e.message}`));
                    }
                });
                res.on('error', (err) => reject(new Error(`Models response error: ${err.message}`)));
            });

            req.on('error', (err) => reject(new Error(`Models request failed: ${err.message}`)));

            req.setTimeout(15000, () => {
                req.destroy(new Error('Models request timed out'));
            });

            req.end();
        });
    }

    private getModelPricing(modelId: string): { input?: number; output?: number } {
        const models = this.cachedModels;
        if (!models || !models.length) return {};
        const exact = models.find(m => m.id === modelId);
        if (exact?.pricing) return { input: exact.pricing.input, output: exact.pricing.output };
        const lower = modelId.toLowerCase();
        const loose = models.find(m => m.id.toLowerCase() === lower || m.name.toLowerCase() === lower);
        return loose?.pricing ?? {};
    }

    public async listModelEndpoints(modelId: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                path: `/api/v1/models/${encodeURIComponent(modelId)}/endpoints`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'ORPT'
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Endpoints API Error: ${res.statusCode} ${res.statusMessage}${body ? ' - ' + body.slice(0, 500) : ''}`));
                    }
                    try {
                        const json = JSON.parse(body);
                        const arr = Array.isArray(json)
                            ? json
                            : (Array.isArray(json.data) ? json.data : (Array.isArray(json.endpoints) ? json.endpoints : []));
                        const providers: string[] = arr.map((e: any) => e?.provider || e?.name || e?.id).filter((x: any) => !!x);
                        resolve(Array.from(new Set(providers)));
                    } catch (e: any) {
                        reject(new Error(`Failed to parse endpoints response: ${e.message}`));
                    }
                });
                res.on('error', (err) => reject(new Error(`Endpoints response error: ${err.message}`)));
            });

            req.on('error', (err) => reject(new Error(`Endpoints request failed: ${err.message}`)));
            req.setTimeout(15000, () => {
                req.destroy(new Error('Endpoints request timed out'));
            });
            req.end();
        });
    }

    public async listProviders(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                path: '/api/v1/providers',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'ORPT'
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Providers API Error: ${res.statusCode} ${res.statusMessage}${body ? ' - ' + body.slice(0, 500) : ''}`));
                    }
                    try {
                        const json = JSON.parse(body);
                        const arr = Array.isArray(json)
                            ? json
                            : (Array.isArray(json.data) ? json.data : (Array.isArray(json.providers) ? json.providers : []));
                        const providers: string[] = arr.map((p: any) => p?.id || p?.name || p?.provider).filter((x: any) => !!x);
                        resolve(Array.from(new Set(providers)));
                    } catch (e: any) {
                        reject(new Error(`Failed to parse providers response: ${e.message}`));
                    }
                });
                res.on('error', (err) => reject(new Error(`Providers response error: ${err.message}`)));
            });

            req.on('error', (err) => reject(new Error(`Providers request failed: ${err.message}`)));
            req.setTimeout(15000, () => {
                req.destroy(new Error('Providers request timed out'));
            });
            req.end();
        });
    }

    async validateApiKey(): Promise<boolean> {
        return new Promise((resolve) => {
            const options = {
                hostname: this.baseUrl,
                path: '/api/v1/models',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'ORPT'
                }
            };

            const req = https.request(options, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }
}
