import { NextResponse } from 'next/server';

export const revalidate = 0;

export interface ModelQuotaStatus {
  model: string;
  modelName: string;
  provider: string;
  status: 'OK' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'ERROR';
  statusCode: number | null;
  latencyMs: number;
  remainingQuota: number;
  totalQuota: number;
  quotaUnit: string;
  usagePercent: number; // 0 - 100%
  recoverySeconds: number;
  recoveryTimeFormatted: string;
  estimatedReadyAt: string | null;
  errorMsg?: string;
}

export interface ProviderDiagnostic {
  provider: string;
  name: string;
  isConfigured: boolean;
  status: 'ONLINE' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'ERROR' | 'NOT_CONFIGURED';
  statusCode: number | null;
  latencyMs: number;
  errorMessage?: string;
  details?: Record<string, any>;
  modelsTested: ModelQuotaStatus[];
}

// Helper to parse Groq header reset string like "1m23s" or "12.5s" to seconds
function parseResetTimeToSeconds(resetStr: string | null): number {
  if (!resetStr) return 0;
  let totalSec = 0;
  const minMatch = resetStr.match(/(\d+)m/);
  const secMatch = resetStr.match(/([\d\.]+)s/);
  if (minMatch) totalSec += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSec += Math.ceil(parseFloat(secMatch[1]));
  return totalSec;
}

function formatRecoveryTime(seconds: number): string {
  if (seconds <= 0) return 'Siap Digunakan (Ready)';
  if (seconds < 60) return `${seconds} Detik Lagi`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} Menit ${s > 0 ? s + ' Detik' : ''} Lagi`;
}

export async function GET() {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
  const githubPat = process.env.GITHUB_PAT || '';

  const results: ProviderDiagnostic[] = [];

  // 1. OpenRouter Diagnostics & Model Quotas
  if (openrouterApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    let details: Record<string, any> = {};
    const modelsTested: ModelQuotaStatus[] = [];

    try {
      // Key verification
      const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${openrouterApiKey}` },
        cache: 'no-store',
      });
      statusCode = authRes.status;

      if (authRes.ok) {
        const authData = await authRes.json();
        const d = authData.data || {};
        details = {
          label: d.label || 'API Key',
          usageUSD: d.usage || 0,
          usageDailyUSD: d.usage_daily || 0,
          usageWeeklyUSD: d.usage_weekly || 0,
          usageMonthlyUSD: d.usage_monthly || 0,
          limitUSD: d.limit || null,
          limitRemainingUSD: d.limit_remaining || null,
          isFreeTier: d.is_free_tier ?? true,
          rateLimit: d.rate_limit || null,
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

      // Test Model 1: GPT-OSS 20B Free
      const modelsToTest = [
        { id: 'openai/gpt-oss-20b:free', name: 'OpenRouter GPT-OSS 20B (Free)', maxQuota: 20 },
        { id: 'deepseek/deepseek-r1:free', name: 'OpenRouter DeepSeek R1 (Free)', maxQuota: 20 },
      ];

      for (const mObj of modelsToTest) {
        const modelStartTime = Date.now();
        try {
          const pingRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: mObj.id,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5,
            }),
            cache: 'no-store',
          });
          const modelLatency = Date.now() - modelStartTime;

          let recoverySec = 0;
          let isRateLimited = pingRes.status === 429;
          let errMsg: string | undefined = undefined;

          if (!pingRes.ok) {
            const errJson = await pingRes.json().catch(() => ({}));
            errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
            if (isRateLimited) {
              recoverySec = 60; // 60s reset window for free OpenRouter
              status = 'RATE_LIMITED';
            }
          }

          const readyTime = recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null;
          const remaining = isRateLimited ? 0 : mObj.maxQuota;
          const usagePercent = Math.round((remaining / mObj.maxQuota) * 100);

          modelsTested.push({
            model: mObj.id,
            modelName: mObj.name,
            provider: 'OpenRouter',
            status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
            remainingQuota: remaining,
            totalQuota: mObj.maxQuota,
            quotaUnit: 'RPM (Req/Min)',
            usagePercent,
            recoverySeconds: recoverySec,
            recoveryTimeFormatted: formatRecoveryTime(recoverySec),
            estimatedReadyAt: readyTime,
            errorMsg: errMsg,
          });
        } catch (e: any) {
          modelsTested.push({
            model: mObj.id,
            modelName: mObj.name,
            provider: 'OpenRouter',
            status: 'ERROR',
            statusCode: 500,
            latencyMs: Date.now() - modelStartTime,
            remainingQuota: 0,
            totalQuota: mObj.maxQuota,
            quotaUnit: 'RPM',
            usagePercent: 0,
            recoverySeconds: 60,
            recoveryTimeFormatted: formatRecoveryTime(60),
            estimatedReadyAt: new Date(Date.now() + 60000).toISOString(),
            errorMsg: e.message,
          });
        }
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

  // 2. Groq Diagnostics & Model Quotas
  if (groqApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    let details: Record<string, any> = {};
    const modelsTested: ModelQuotaStatus[] = [];

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

      const groqModelsToTest = [
        { id: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B Versatile', defaultQuota: 30 },
        { id: 'llama-3.1-8b-instant', name: 'Groq Llama 3.1 8B Instant', defaultQuota: 30 },
      ];

      for (const mObj of groqModelsToTest) {
        const modelStartTime = Date.now();
        try {
          const pingRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: mObj.id,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5,
            }),
            cache: 'no-store',
          });
          const modelLatency = Date.now() - modelStartTime;

          // Parse Groq rate limit headers
          const reqLimit = parseInt(pingRes.headers.get('x-ratelimit-limit-requests') || `${mObj.defaultQuota}`, 10);
          const reqRemaining = parseInt(pingRes.headers.get('x-ratelimit-remaining-requests') || `${mObj.defaultQuota}`, 10);
          const reqResetHeader = pingRes.headers.get('x-ratelimit-reset-requests');
          const recoverySec = parseResetTimeToSeconds(reqResetHeader);

          let isRateLimited = pingRes.status === 429;
          let errMsg: string | undefined = undefined;

          if (!pingRes.ok) {
            const errJson = await pingRes.json().catch(() => ({}));
            errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
            if (isRateLimited) {
              status = 'RATE_LIMITED';
            }
          }

          const readyTime = recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null;
          const usagePercent = Math.round((reqRemaining / reqLimit) * 100);

          modelsTested.push({
            model: mObj.id,
            modelName: mObj.name,
            provider: 'Groq AI',
            status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
            remainingQuota: reqRemaining,
            totalQuota: reqLimit,
            quotaUnit: 'RPM (Req/Min)',
            usagePercent: isNaN(usagePercent) ? 100 : usagePercent,
            recoverySeconds: recoverySec,
            recoveryTimeFormatted: formatRecoveryTime(recoverySec),
            estimatedReadyAt: readyTime,
            errorMsg: errMsg,
          });

          if (mObj.id === 'llama-3.3-70b-versatile') {
            details = {
              requestsLimitPerMin: reqLimit,
              requestsRemaining: reqRemaining,
              resetRequestsTime: reqResetHeader || '0s',
            };
          }
        } catch (e: any) {
          modelsTested.push({
            model: mObj.id,
            modelName: mObj.name,
            provider: 'Groq AI',
            status: 'ERROR',
            statusCode: 500,
            latencyMs: Date.now() - modelStartTime,
            remainingQuota: 0,
            totalQuota: mObj.defaultQuota,
            quotaUnit: 'RPM',
            usagePercent: 0,
            recoverySeconds: 60,
            recoveryTimeFormatted: formatRecoveryTime(60),
            estimatedReadyAt: new Date(Date.now() + 60000).toISOString(),
            errorMsg: e.message,
          });
        }
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
      details,
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

  // 3. Google Gemini Diagnostics & Model Quota
  if (googleApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    const modelsTested: ModelQuotaStatus[] = [];

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

      let isRateLimited = pingRes.status === 429;
      let recoverySec = isRateLimited ? 60 : 0;
      let errMsg: string | undefined = undefined;

      if (!pingRes.ok) {
        const errJson = await pingRes.json().catch(() => ({}));
        errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
        if (isRateLimited) {
          status = 'RATE_LIMITED';
          errorMessage = 'Quota / Rate Limit Google Gemini Terlampaui (429)';
        } else if (pingRes.status === 400 || pingRes.status === 403 || pingRes.status === 401) {
          status = 'UNAUTHORIZED';
          errorMessage = `Gemini Key Error: ${errMsg}`;
        } else {
          status = 'ERROR';
          errorMessage = errMsg;
        }
      }

      const totalRPM = 15; // Gemini 2.5 Flash Free Tier
      const remainingRPM = isRateLimited ? 0 : 15;
      const readyTime = recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null;

      modelsTested.push({
        model: 'gemini-2.5-flash',
        modelName: 'Google Gemini 2.5 Flash (Primary Multimodal)',
        provider: 'Google AI',
        status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
        statusCode: pingRes.status,
        latencyMs: modelLatency,
        remainingQuota: remainingRPM,
        totalQuota: totalRPM,
        quotaUnit: 'RPM (15 Req/Min)',
        usagePercent: isRateLimited ? 0 : 100,
        recoverySeconds: recoverySec,
        recoveryTimeFormatted: formatRecoveryTime(recoverySec),
        estimatedReadyAt: readyTime,
        errorMsg: errMsg,
      });
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
    const modelsTested: ModelQuotaStatus[] = [];

    try {
      const pingRes = await fetch('https://models.inference.ai.azure.com/models', {
        headers: { Authorization: `Bearer ${githubPat}` },
        cache: 'no-store',
      });
      statusCode = pingRes.status;
      let isRateLimited = pingRes.status === 429;
      let recoverySec = isRateLimited ? 60 : 0;

      if (!pingRes.ok) {
        if (isRateLimited) {
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

      modelsTested.push({
        model: 'meta-llama/llama-3.3-70b-instruct',
        modelName: 'GitHub Models Llama 3.3 70B',
        provider: 'GitHub PAT',
        status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
        statusCode: pingRes.status,
        latencyMs: Date.now() - startTime,
        remainingQuota: isRateLimited ? 0 : 15,
        totalQuota: 15,
        quotaUnit: 'RPM',
        usagePercent: isRateLimited ? 0 : 100,
        recoverySeconds: recoverySec,
        recoveryTimeFormatted: formatRecoveryTime(recoverySec),
        estimatedReadyAt: recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null,
      });
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
      modelsTested,
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
