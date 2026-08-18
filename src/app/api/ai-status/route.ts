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
  usagePercent: number;
  recoverySeconds: number;
  recoveryTimeFormatted: string;
  estimatedReadyAt: string | null;
  errorMsg?: string;
  tokenLimit?: number;
  tokenRemaining?: number;
  tokenResetSeconds?: number;
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

function parseResetTimeToSeconds(resetStr: string | null): number {
  if (!resetStr) return 0;
  let totalSec = 0;
  const minMatch = resetStr.match(/(\d+)m/);
  const secMatch = resetStr.match(/([\d\.]+)s/);
  if (minMatch) totalSec += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSec += Math.ceil(parseFloat(secMatch[1]));
  if (!minMatch && !secMatch) {
    const plain = parseFloat(resetStr);
    if (!isNaN(plain)) totalSec = Math.ceil(plain);
  }
  return totalSec;
}

function formatRecoveryTime(seconds: number): string {
  if (seconds <= 0) return 'Siap Digunakan (Ready)';
  if (seconds < 60) return `${seconds} Detik Lagi`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} Menit ${s > 0 ? s + ' Detik' : ''} Lagi`;
}

function extractRateLimitHeaders(res: Response) {
  return {
    limitRequests: parseInt(res.headers.get('x-ratelimit-limit-requests') || '0', 10) || 0,
    remainingRequests: parseInt(res.headers.get('x-ratelimit-remaining-requests') || '0', 10) || 0,
    limitTokens: parseInt(res.headers.get('x-ratelimit-limit-tokens') || '0', 10) || 0,
    remainingTokens: parseInt(res.headers.get('x-ratelimit-remaining-tokens') || '0', 10) || 0,
    resetRequests: res.headers.get('x-ratelimit-reset-requests'),
    resetTokens: res.headers.get('x-ratelimit-reset-tokens'),
    retryAfter: res.headers.get('retry-after'),
  };
}

export async function GET() {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
  const githubPat = process.env.GITHUB_PAT || '';

  const results: ProviderDiagnostic[] = [];

  // ── 1. OPENROUTER ──────────────────────────────────────────────────
  if (openrouterApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    let details: Record<string, any> = {};
    const modelsTested: ModelQuotaStatus[] = [];

    try {
      // Real account-level usage from /auth/key
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
          usageUSD: typeof d.usage === 'number' ? d.usage : 0,
          limitUSD: typeof d.limit === 'number' ? d.limit : null,
          limitRemainingUSD: typeof d.limit_remaining === 'number' ? d.limit_remaining : null,
          isFreeTier: d.is_free_tier ?? true,
          rateLimit: d.rate_limit || null,
        };
      } else if (authRes.status === 429) {
        status = 'RATE_LIMITED';
        errorMessage = 'OpenRouter Rate Limit Exceeded (429)';
      } else if (authRes.status === 401 || authRes.status === 403) {
        status = 'UNAUTHORIZED';
        errorMessage = 'API Key OpenRouter tidak valid';
      } else {
        status = 'ERROR';
        errorMessage = `HTTP Status ${authRes.status}`;
      }

      // Per-model real rate limit from chat/completions headers
      const modelsToTest = [
        { id: 'openai/gpt-oss-20b:free', name: 'OpenRouter GPT-OSS 20B (Free)' },
        { id: 'google/gemma-4-26b-a4b-it:free', name: 'OpenRouter Gemma 4 26B (Free)' },
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
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 1,
            }),
            cache: 'no-store',
          });
          const modelLatency = Date.now() - modelStartTime;
          const rl = extractRateLimitHeaders(pingRes);
          const isRateLimited = pingRes.status === 429;

          let errMsg: string | undefined = undefined;
          let recoverySec = 0;

          if (!pingRes.ok) {
            const errJson = await pingRes.json().catch(() => ({}));
            errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
            if (isRateLimited) {
              recoverySec = rl.retryAfter
                ? Math.ceil(parseFloat(rl.retryAfter))
                : parseResetTimeToSeconds(rl.resetRequests) || 60;
            }
          }

          const totalReqs = rl.limitRequests > 0 ? rl.limitRequests : (details.isFreeTier ? 20 : 200);
          const remainingReqs = isRateLimited ? 0 : (rl.remainingRequests > 0 ? rl.remainingRequests : totalReqs);
          const usagePercent = totalReqs > 0 ? Math.round((remainingReqs / totalReqs) * 100) : 0;
          const readyTime = recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null;

          modelsTested.push({
            model: mObj.id,
            modelName: mObj.name,
            provider: 'OpenRouter',
            status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
            remainingQuota: remainingReqs,
            totalQuota: totalReqs,
            quotaUnit: rl.limitRequests > 0 ? `RPM (${rl.limitRequests} Req/Min)` : 'RPM (Est.)',
            usagePercent,
            recoverySeconds: recoverySec,
            recoveryTimeFormatted: formatRecoveryTime(recoverySec),
            estimatedReadyAt: readyTime,
            errorMsg: errMsg,
            tokenLimit: rl.limitTokens || undefined,
            tokenRemaining: rl.remainingTokens || undefined,
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
            totalQuota: 20,
            quotaUnit: 'RPM (Est.)',
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

  // ── 2. GROQ ────────────────────────────────────────────────────────
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
        if (modelsRes.status === 429) { status = 'RATE_LIMITED'; errorMessage = 'Rate Limit Groq terlampaui (429)'; }
        else if (modelsRes.status === 401) { status = 'UNAUTHORIZED'; errorMessage = 'API Key Groq tidak valid (401)'; }
        else { status = 'ERROR'; errorMessage = `HTTP Status ${modelsRes.status}`; }
      }

      const groqModelsToTest = [
        { id: 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
        { id: 'openai/gpt-oss-20b', name: 'Groq GPT-OSS 20B' },
        { id: 'qwen/qwen3.6-27b', name: 'Groq Qwen 3.6 27B' },
      ];

      for (const mObj of groqModelsToTest) {
        const modelStartTime = Date.now();
        try {
          const pingRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: mObj.id, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
            cache: 'no-store',
          });
          const modelLatency = Date.now() - modelStartTime;

          // All 6 real Groq rate-limit headers
          const rl = extractRateLimitHeaders(pingRes);
          const reqLimit = rl.limitRequests;
          const reqRemaining = rl.remainingRequests;
          const reqResetSec = parseResetTimeToSeconds(rl.resetRequests);
          const tokenLimit = rl.limitTokens;
          const tokenRemaining = rl.remainingTokens;
          const tokenResetSec = parseResetTimeToSeconds(rl.resetTokens);

          const isRateLimited = pingRes.status === 429;
          let errMsg: string | undefined = undefined;
          let recoverySec = 0;

          if (!pingRes.ok) {
            const errJson = await pingRes.json().catch(() => ({}));
            errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
            if (isRateLimited) {
              status = 'RATE_LIMITED';
              const retryAfter = pingRes.headers.get('retry-after');
              recoverySec = retryAfter ? Math.ceil(parseFloat(retryAfter)) : reqResetSec || 60;
            }
          }

          const effectiveRemaining = isRateLimited ? 0 : reqRemaining;
          const usagePercent = reqLimit > 0
            ? Math.round((effectiveRemaining / reqLimit) * 100)
            : (isRateLimited ? 0 : 100);
          const readyTime = (isRateLimited && recoverySec > 0)
            ? new Date(Date.now() + recoverySec * 1000).toISOString() : null;

          modelsTested.push({
            model: mObj.id,
            modelName: mObj.name,
            provider: 'Groq AI',
            status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
            statusCode: pingRes.status,
            latencyMs: modelLatency,
            remainingQuota: effectiveRemaining,
            totalQuota: reqLimit,
            quotaUnit: reqLimit > 0 ? `RPD (${reqLimit} Req/Day)` : 'RPD',
            usagePercent: isNaN(usagePercent) ? 100 : usagePercent,
            recoverySeconds: isRateLimited ? recoverySec : 0,
            recoveryTimeFormatted: isRateLimited ? formatRecoveryTime(recoverySec) : formatRecoveryTime(0),
            estimatedReadyAt: readyTime,
            errorMsg: errMsg,
            tokenLimit: tokenLimit || undefined,
            tokenRemaining: tokenRemaining || undefined,
            tokenResetSeconds: tokenResetSec || undefined,
          });

          if (mObj.id === 'llama-3.3-70b-versatile') {
            details = {
              requestsLimitPerDay: reqLimit,
              requestsRemaining: reqRemaining,
              resetRequestsTime: rl.resetRequests || '0s',
              tokensLimitPerMin: tokenLimit,
              tokensRemaining: tokenRemaining,
              resetTokensTime: rl.resetTokens || '0s',
            };
          }
        } catch (e: any) {
          modelsTested.push({
            model: mObj.id, modelName: mObj.name, provider: 'Groq AI',
            status: 'ERROR', statusCode: 500, latencyMs: Date.now() - modelStartTime,
            remainingQuota: 0, totalQuota: 0, quotaUnit: 'RPD',
            usagePercent: 0, recoverySeconds: 60,
            recoveryTimeFormatted: formatRecoveryTime(60),
            estimatedReadyAt: new Date(Date.now() + 60000).toISOString(),
            errorMsg: e.message,
          });
        }
      }
    } catch (err: any) {
      status = 'ERROR'; errorMessage = err.message || 'Koneksi gagal';
    }

    results.push({
      provider: 'groq', name: 'Groq AI Cloud', isConfigured: true,
      status, statusCode, latencyMs: Date.now() - startTime,
      errorMessage, details, modelsTested,
    });
  } else {
    results.push({
      provider: 'groq', name: 'Groq AI Cloud', isConfigured: false,
      status: 'NOT_CONFIGURED', statusCode: null, latencyMs: 0,
      errorMessage: 'GROQ_API_KEY belum diset di .env', modelsTested: [],
    });
  }

  // ── 3. GOOGLE GEMINI ───────────────────────────────────────────────
  if (googleApiKey) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    const modelsTested: ModelQuotaStatus[] = [];
    let geminiDetails: Record<string, any> = {};

    try {
      const modelStartTime = Date.now();
      const pingRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
          cache: 'no-store',
        }
      );
      statusCode = pingRes.status;
      const modelLatency = Date.now() - modelStartTime;

      const isRateLimited = pingRes.status === 429;
      let recoverySec = 0;
      let errMsg: string | undefined = undefined;
      let quotaMetric = '';

      if (!pingRes.ok) {
        const errJson = await pingRes.json().catch(() => ({}));
        errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;

        if (isRateLimited) {
          status = 'RATE_LIMITED';
          errorMessage = 'Quota Google Gemini Terlampaui (429 RESOURCE_EXHAUSTED)';

          // Real retry-after header
          const retryAfter = pingRes.headers.get('retry-after');
          if (retryAfter) recoverySec = Math.ceil(parseFloat(retryAfter));

          // Parse error body for real quota violation details
          if (errJson.error?.details) {
            for (const detail of errJson.error.details) {
              if (detail.violations) {
                for (const v of detail.violations) {
                  quotaMetric = v.description || v.subject || '';
                }
              }
              if (detail.metadata?.quota_limit_value) geminiDetails.quotaLimitValue = detail.metadata.quota_limit_value;
              if (detail.metadata?.quota_metric) geminiDetails.quotaMetric = detail.metadata.quota_metric;
            }
          }

          if (recoverySec <= 0) recoverySec = 60;
        } else if ([400, 401, 403].includes(pingRes.status)) {
          status = 'UNAUTHORIZED';
          errorMessage = `Gemini Key Error: ${errMsg}`;
        } else {
          status = 'ERROR';
          errorMessage = errMsg;
        }
      } else {
        // Real token usage from successful response body
        const resJson = await pingRes.json().catch(() => ({}));
        if (resJson.usageMetadata) {
          geminiDetails = {
            promptTokenCount: resJson.usageMetadata.promptTokenCount || 0,
            candidatesTokenCount: resJson.usageMetadata.candidatesTokenCount || 0,
            totalTokenCount: resJson.usageMetadata.totalTokenCount || 0,
          };
        }
      }

      const readyTime = recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null;

      modelsTested.push({
        model: 'gemini-2.5-flash',
        modelName: 'Google Gemini 2.5 Flash',
        provider: 'Google AI',
        status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
        statusCode: pingRes.status,
        latencyMs: modelLatency,
        // Gemini does not expose x-ratelimit headers — -1 = no data from header
        remainingQuota: isRateLimited ? 0 : -1,
        totalQuota: -1,
        quotaUnit: isRateLimited
          ? `EXHAUSTED${quotaMetric ? ` (${quotaMetric})` : ''}`
          : 'Tersedia (No Header Data)',
        usagePercent: isRateLimited ? 0 : 100,
        recoverySeconds: recoverySec,
        recoveryTimeFormatted: formatRecoveryTime(recoverySec),
        estimatedReadyAt: readyTime,
        errorMsg: errMsg,
      });
    } catch (err: any) {
      status = 'ERROR'; errorMessage = err.message || 'Koneksi gagal';
    }

    results.push({
      provider: 'google', name: 'Google Gemini AI', isConfigured: true,
      status, statusCode, latencyMs: Date.now() - startTime,
      errorMessage, details: geminiDetails, modelsTested,
    });
  } else {
    results.push({
      provider: 'google', name: 'Google Gemini AI', isConfigured: false,
      status: 'NOT_CONFIGURED', statusCode: null, latencyMs: 0,
      errorMessage: 'GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY belum diset', modelsTested: [],
    });
  }

  // ── 4. GITHUB MODELS PAT ───────────────────────────────────────────
  if (githubPat) {
    const startTime = Date.now();
    let status: ProviderDiagnostic['status'] = 'ONLINE';
    let statusCode: number | null = null;
    let errorMessage: string | undefined = undefined;
    const modelsTested: ModelQuotaStatus[] = [];

    try {
      const pingRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${githubPat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
        cache: 'no-store',
      });
      statusCode = pingRes.status;
      const modelLatency = Date.now() - startTime;
      const rl = extractRateLimitHeaders(pingRes);
      const isRateLimited = pingRes.status === 429;

      let recoverySec = 0;
      let errMsg: string | undefined = undefined;

      if (!pingRes.ok) {
        if (isRateLimited) {
          status = 'RATE_LIMITED'; errorMessage = 'GitHub Models Rate Limit Exceeded (429)';
          const retryAfter = pingRes.headers.get('retry-after');
          recoverySec = retryAfter
            ? Math.ceil(parseFloat(retryAfter))
            : parseResetTimeToSeconds(rl.resetRequests) || 60;
        } else if (pingRes.status === 401) {
          status = 'UNAUTHORIZED'; errorMessage = 'GitHub PAT Invalid (401)';
        } else {
          status = 'ERROR';
          const errJson = await pingRes.json().catch(() => ({}));
          errMsg = errJson.error?.message || `HTTP ${pingRes.status}`;
          errorMessage = errMsg;
        }
      }

      const totalReqs = rl.limitRequests > 0 ? rl.limitRequests : 15;
      const remainingReqs = isRateLimited ? 0 : (rl.remainingRequests > 0 ? rl.remainingRequests : totalReqs);
      const usagePercent = totalReqs > 0 ? Math.round((remainingReqs / totalReqs) * 100) : 0;

      modelsTested.push({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        modelName: 'GitHub Models Llama 3.3 70B',
        provider: 'GitHub PAT',
        status: pingRes.ok ? 'OK' : isRateLimited ? 'RATE_LIMITED' : 'ERROR',
        statusCode: pingRes.status,
        latencyMs: modelLatency,
        remainingQuota: remainingReqs,
        totalQuota: totalReqs,
        quotaUnit: rl.limitRequests > 0 ? `RPM (${rl.limitRequests} Req/Min)` : 'RPM (Est.)',
        usagePercent,
        recoverySeconds: recoverySec,
        recoveryTimeFormatted: formatRecoveryTime(recoverySec),
        estimatedReadyAt: recoverySec > 0 ? new Date(Date.now() + recoverySec * 1000).toISOString() : null,
        errorMsg: errMsg,
        tokenLimit: rl.limitTokens || undefined,
        tokenRemaining: rl.remainingTokens || undefined,
      });
    } catch (err: any) {
      status = 'ERROR'; errorMessage = err.message;
    }

    results.push({
      provider: 'github', name: 'GitHub Models PAT', isConfigured: true,
      status, statusCode, latencyMs: Date.now() - startTime,
      errorMessage, modelsTested,
    });
  }

  // ── OVERALL HEALTH ─────────────────────────────────────────────────
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
