import { NextResponse } from 'next/server';

export const revalidate = 0;

export interface ProviderDiagnostic {
  provider: string;
  name: string;
  isConfigured: boolean;
  status: 'ONLINE' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'ERROR' | 'NOT_CONFIGURED';
  statusCode: number | null;
  latencyMs: number;
  errorMessage?: string;
  details?: Record<string, any>;
  modelsTested: {
    model: string;
    status: 'OK' | 'RATE_LIMITED' | 'ERROR';
    statusCode: number | null;
    latencyMs: number;
    errorMsg?: string;
  }[];
}

export async function GET() {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
  const githubPat = process.env.GITHUB_PAT || '';

  const results: ProviderDiagnostic[] = [];

  // 1. OpenRouter Diagnostics
  if (openrouterApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    let details: Record<string, any> = {};
    const modelsTested: ProviderDiagnostic['modelsTested'] = [];

    try {
      // Key verification
      const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${openrouterApiKey}` },
        cache: 'no-store',
      });
      statusCode = authRes.status;

      if (authRes.ok) {
        const authData = await authRes.json();
        details = {
          label: authData.data?.label || 'API Key',
          usageUSD: authData.data?.usage || 0,
          limitUSD: authData.data?.limit || null,
          isFreeTier: authData.data?.is_free_tier ?? true,
          rateLimit: authData.data?.rate_limit || null,
        };
      } else if (authRes.status === 429) {
        status = 'RATE_LIMITED';
        errorMessage = 'Batas Kuota / Rate Limit OpenRouter Terlampaui (429)';
      } else if (authRes.status === 401) {
        status = 'UNAUTHORIZED';
        errorMessage = 'API Key OpenRouter tidak valid (401)';
      } else {
        status = 'ERROR';
        errorMessage = `HTTP Status ${authRes.status}`;
      }

      // Ping test model
      const modelStartTime = Date.now();
      try {
        const pingRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b:free',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
          cache: 'no-store',
        });
        const modelLatency = Date.now() - modelStartTime;
        if (pingRes.ok) {
          modelsTested.push({
            model: 'openai/gpt-oss-20b:free',
            status: 'OK',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
          });
        } else {
          const errJson = await pingRes.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
          if (pingRes.status === 429) {
            status = 'RATE_LIMITED';
            errorMessage = `Model limit: ${errMsg}`;
          }
          modelsTested.push({
            model: 'openai/gpt-oss-20b:free',
            status: pingRes.status === 429 ? 'RATE_LIMITED' : 'ERROR',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
            errorMsg: errMsg,
          });
        }
      } catch (e: any) {
        modelsTested.push({
          model: 'openai/gpt-oss-20b:free',
          status: 'ERROR',
          statusCode: 500,
          latencyMs: Date.now() - modelStartTime,
          errorMsg: e.message,
        });
      }
    } catch (err: any) {
      status = 'ERROR';
      errorMessage = err.message || 'Koneksi gagal';
    }

    results.push({
      provider: 'openrouter',
      name: 'OpenRouter AI',
      isConfigured: true,
      status,
      statusCode,
      latencyMs: Date.now() - startTime,
      errorMessage,
      details,
      modelsTested,
    });
  } else {
    results.push({
      provider: 'openrouter',
      name: 'OpenRouter AI',
      isConfigured: false,
      status: 'NOT_CONFIGURED',
      statusCode: null,
      latencyMs: 0,
      errorMessage: 'OPENROUTER_API_KEY belum diset di .env',
      modelsTested: [],
    });
  }

  // 2. Groq Diagnostics
  if (groqApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    const modelsTested: ProviderDiagnostic['modelsTested'] = [];

    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groqApiKey}` },
        cache: 'no-store',
      });
      statusCode = modelsRes.status;

      if (!modelsRes.ok) {
        if (modelsRes.status === 429) {
          status = 'RATE_LIMITED';
          errorMessage = 'Rate Limit Groq terlampaui (429)';
        } else if (modelsRes.status === 401) {
          status = 'UNAUTHORIZED';
          errorMessage = 'API Key Groq tidak valid (401)';
        } else {
          status = 'ERROR';
          errorMessage = `HTTP Status ${modelsRes.status}`;
        }
      }

      // Ping test
      const modelStartTime = Date.now();
      try {
        const pingRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
          cache: 'no-store',
        });
        const modelLatency = Date.now() - modelStartTime;
        if (pingRes.ok) {
          modelsTested.push({
            model: 'llama-3.3-70b-versatile',
            status: 'OK',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
          });
        } else {
          const errJson = await pingRes.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
          if (pingRes.status === 429) {
            status = 'RATE_LIMITED';
            errorMessage = `Groq rate limit: ${errMsg}`;
          }
          modelsTested.push({
            model: 'llama-3.3-70b-versatile',
            status: pingRes.status === 429 ? 'RATE_LIMITED' : 'ERROR',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
            errorMsg: errMsg,
          });
        }
      } catch (e: any) {
        modelsTested.push({
          model: 'llama-3.3-70b-versatile',
          status: 'ERROR',
          statusCode: 500,
          latencyMs: Date.now() - modelStartTime,
          errorMsg: e.message,
        });
      }
    } catch (err: any) {
      status = 'ERROR';
      errorMessage = err.message || 'Koneksi gagal';
    }

    results.push({
      provider: 'groq',
      name: 'Groq AI Cloud',
      isConfigured: true,
      status,
      statusCode,
      latencyMs: Date.now() - startTime,
      errorMessage,
      modelsTested,
    });
  } else {
    results.push({
      provider: 'groq',
      name: 'Groq AI Cloud',
      isConfigured: false,
      status: 'NOT_CONFIGURED',
      statusCode: null,
      latencyMs: 0,
      errorMessage: 'GROQ_API_KEY belum diset di .env',
      modelsTested: [],
    });
  }

  // 3. Google Gemini Diagnostics
  if (googleApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    const modelsTested: ProviderDiagnostic['modelsTested'] = [];

    try {
      const modelStartTime = Date.now();
      const pingRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
          cache: 'no-store',
        }
      );
      statusCode = pingRes.status;
      const modelLatency = Date.now() - modelStartTime;

      if (pingRes.ok) {
        modelsTested.push({
          model: 'gemini-2.5-flash',
          status: 'OK',
          statusCode: pingRes.status,
          latencyMs: modelLatency,
        });
      } else {
        const errJson = await pingRes.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
        if (pingRes.status === 429) {
          status = 'RATE_LIMITED';
          errorMessage = 'Quota / Rate Limit Google Gemini Terlampaui (429)';
        } else if (pingRes.status === 400 || pingRes.status === 403 || pingRes.status === 401) {
          status = 'UNAUTHORIZED';
          errorMessage = `Gemini Key Error: ${errMsg}`;
        } else {
          status = 'ERROR';
          errorMessage = errMsg;
        }

        modelsTested.push({
          model: 'gemini-2.5-flash',
          status: pingRes.status === 429 ? 'RATE_LIMITED' : 'ERROR',
          statusCode: pingRes.status,
          latencyMs: modelLatency,
          errorMsg: errMsg,
        });
      }
    } catch (err: any) {
      status = 'ERROR';
      errorMessage = err.message || 'Koneksi gagal';
    }

    results.push({
      provider: 'google',
      name: 'Google Gemini AI',
      isConfigured: true,
      status,
      statusCode,
      latencyMs: Date.now() - startTime,
      errorMessage,
      modelsTested,
    });
  } else {
    results.push({
      provider: 'google',
      name: 'Google Gemini AI',
      isConfigured: false,
      status: 'NOT_CONFIGURED',
      statusCode: null,
      latencyMs: 0,
      errorMessage: 'GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY belum diset',
      modelsTested: [],
    });
  }

  // 4. GitHub Models PAT Diagnostics
  if (githubPat) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;

    try {
      const pingRes = await fetch('https://models.inference.ai.azure.com/models', {
        headers: { Authorization: `Bearer ${githubPat}` },
        cache: 'no-store',
      });
      statusCode = pingRes.status;
      if (!pingRes.ok) {
        if (pingRes.status === 429) {
          status = 'RATE_LIMITED';
          errorMessage = 'GitHub PAT Rate Limit Exceeded (429)';
        } else if (pingRes.status === 401) {
          status = 'UNAUTHORIZED';
          errorMessage = 'GitHub PAT Invalid (401)';
        } else {
          status = 'ERROR';
          errorMessage = `HTTP ${pingRes.status}`;
        }
      }
    } catch (err: any) {
      status = 'ERROR';
      errorMessage = err.message;
    }

    results.push({
      provider: 'github',
      name: 'GitHub Models PAT',
      isConfigured: true,
      status,
      statusCode,
      latencyMs: Date.now() - startTime,
      errorMessage,
      modelsTested: [],
    });
  }

  // Compute Overall Health
  const configuredProviders = results.filter((r) => r.isConfigured);
  const onlineProviders = configuredProviders.filter((r) => r.status === 'ONLINE');
  const rateLimitedProviders = configuredProviders.filter((r) => r.status === 'RATE_LIMITED');

  let overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
  if (configuredProviders.length === 0 || onlineProviders.length === 0) {
    overallHealth = 'CRITICAL';
  } else if (rateLimitedProviders.length > 0 || onlineProviders.length < configuredProviders.length) {
    overallHealth = 'DEGRADED';
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    overallHealth,
    configuredCount: configuredProviders.length,
    onlineCount: onlineProviders.length,
    rateLimitedCount: rateLimitedProviders.length,
    providers: results,
  });
}
