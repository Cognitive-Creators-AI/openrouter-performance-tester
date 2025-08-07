export interface TestConfig {
    model: string;
    provider: string;
    prompt: string;
    maxTokens: number;
    // Optional sampling params (passed through to API if provided)
    temperature?: number;
    topP?: number; // maps to OpenRouter "top_p"
}

export interface TestResult {
    model: string;
    provider: string;
    prompt: string;
    output: string;
    // Token metrics
    outputTokens: number; // kept for backwards compatibility
    completionTokens?: number; // more explicit, preferred if available
    promptTokens?: number;
    // Timing metrics
    totalTime: number;
    timeToFirstToken: number;
    tokensPerSecond: number; // computed from completionTokens/totalTime when available
    // Cost metrics
    cost: number;
    timestamp: string;
}

export interface Model {
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
    pricing?: {
        input?: number;  // price per 1k input tokens (USD)
        output?: number; // price per 1k output tokens (USD)
    };
}

/**
 * Benchmarking types for suites
 */
export interface TestParams {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
}

export interface TestCase {
    id: string;
    name: string;
    prompt: string;
    reference?: string; // optional expected output for quality heuristics
    tags?: string[];    // e.g., ['code', 'summarization']
    params?: TestParams;
    weight?: number;    // optional weighting when aggregating
}

export interface TestSuite {
    id: string;
    name: string;
    description?: string;
    cases: TestCase[];
    iterations?: number; // default iterations per case
    version?: string;
}

export interface CaseResult {
    caseId: string;
    iteration: number;
    ok: boolean;
    error?: string;
    result?: TestResult;
    quality?: {
        score?: number; // placeholder for future quality scoring
        details?: string;
    };
}

export interface SuiteRunConfig {
    suiteId: string;
    model: string;
    provider: string;
    iterations: number;
    params?: TestParams;
}

export interface SuiteRunResult {
    suiteId: string;
    model: string;
    provider: string;
    startedAt: string;
    finishedAt: string;
    results: CaseResult[];
    aggregates: {
        meanTokensPerSecond: number;
        meanTTFB: number;
        meanTotalTime: number;
        meanCost: number;
        // simple variability measures
        stdTokensPerSecond?: number;
        stdTTFB?: number;
        stdTotalTime?: number;
        stdCost?: number;
        successRate: number;
        totalPromptTokens?: number;
        totalCompletionTokens?: number;
    };
}
