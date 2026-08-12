'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Zap, 
  Cpu, 
  Clock, 
  ShieldAlert, 
  Send, 
  Database, 
  BarChart3, 
  TrendingUp, 
  CreditCard,
  Timer,
  Check,
  AlertCircle,
  Server,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie
} from 'recharts';

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

interface DiagnosticData {
  timestamp: string;
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  configuredCount: number;
  onlineCount: number;
  rateLimitedCount: number;
  providers: {
    provider: string;
    name: string;
    isConfigured: boolean;
    status: 'ONLINE' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'ERROR' | 'NOT_CONFIGURED';
    statusCode: number | null;
    latencyMs: number;
    errorMessage?: string;
    details?: Record<string, any>;
    modelsTested: ModelQuotaStatus[];
  }[];
}

interface LatencyHistoryPoint {
  time: string;
  openrouter?: number;
  groq?: number;
  google?: number;
  github?: number;
  [key: string]: any;
}

// Subcomponent: Live Countdown Timer for Recovery
function RecoveryCountdown({ initialSeconds, estimatedReadyAt }: { initialSeconds: number; estimatedReadyAt: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    if (initialSeconds <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [initialSeconds, estimatedReadyAt]);

  if (secondsLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
        <Check className="w-3 h-3 text-emerald-500" /> Siap Digunakan (Ready)
      </span>
    );
  }

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;

  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-xs border border-amber-200 animate-pulse">
      <Timer className="w-3.5 h-3.5 text-amber-600 animate-spin" /> Pulih dalam {timeStr}
    </span>
  );
}

export default function AiStatusMonitor() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [latencyHistory, setLatencyHistory] = useState<LatencyHistoryPoint[]>([]);

  // Micro Chat Tester state
  const [testPrompt, setTestPrompt] = useState<string>('Halo, apakah sistem AI responsif?');
  const [testResponse, setTestResponse] = useState<string>('');
  const [testSending, setTestSending] = useState<boolean>(false);
  const [testError, setTestError] = useState<string>('');

  const fetchDiagnostics = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/ai-status', { cache: 'no-store' });
      if (res.ok) {
        const json: DiagnosticData = await res.json();
        setData(json);
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastChecked(timeStr);

        // Record history point for real-time chart
        const historyPoint: LatencyHistoryPoint = { time: timeStr };
        json.providers.forEach((p) => {
          if (p.isConfigured && p.status === 'ONLINE') {
            historyPoint[p.provider as keyof LatencyHistoryPoint] = p.latencyMs as any;
          }
        });

        setLatencyHistory((prev) => {
          const next = [...prev, historyPoint];
          return next.slice(-10); // Keep last 10 points
        });
      }
    } catch (err) {
      console.error('Failed to fetch AI diagnostics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 35000); // auto re-check every 35s
    return () => clearInterval(interval);
  }, []);

  const handleSendTestPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPrompt.trim() || testSending) return;

    setTestSending(true);
    setTestResponse('');
    setTestError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'ai_status_live_test',
          messages: [{ role: 'user', content: testPrompt.trim() }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        setTestError(`Error ${res.status}: ${errText.substring(0, 150)}`);
      } else {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
            setTestResponse(fullText);
          }
        }
      }
    } catch (err: any) {
      setTestError(`Gagal mengirim tes: ${err.message}`);
    } finally {
      setTestSending(false);
      fetchDiagnostics();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Memeriksa sisa kuota model AI & waktu pemulihan...</p>
      </div>
    );
  }

  const overall = data?.overallHealth || 'CRITICAL';

  // Aggregate all models tested across all providers
  const allModels: ModelQuotaStatus[] = [];
  data?.providers.forEach((p) => {
    if (p.modelsTested && p.modelsTested.length > 0) {
      allModels.push(...p.modelsTested);
    }
  });

  // Chart 1 Data: Latency Comparison (Bar Chart)
  const latencyChartData = (data?.providers || []).map((p) => ({
    name: p.name,
    latensi: p.isConfigured && p.status === 'ONLINE' ? p.latencyMs : 0,
    status: p.status,
  }));

  // OpenRouter Account Details
  const openrouterProvider = data?.providers.find((p) => p.provider === 'openrouter');
  const openrouterDetails = openrouterProvider?.details || {};

  const openrouterUsageData = [
    { name: 'Hari Ini', usage: openrouterDetails.usageDailyUSD || 0 },
    { name: 'Minggu Ini', usage: openrouterDetails.usageWeeklyUSD || 0 },
    { name: 'Bulan Ini', usage: openrouterDetails.usageMonthlyUSD || 0 },
  ];

  // Groq Details
  const groqProvider = data?.providers.find((p) => p.provider === 'groq');
  const groqDetails = groqProvider?.details || {};
  const groqReqRemaining = groqDetails.requestsRemaining || 30;
  const groqReqLimit = groqDetails.requestsLimitPerMin || 30;
  const groqReqUsed = Math.max(0, groqReqLimit - groqReqRemaining);

  const groqQuotaData = [
    { name: 'Sisa Request (RPM)', value: groqReqRemaining, fill: '#10b981' },
    { name: 'Terpakai (RPM)', value: groqReqUsed, fill: '#f59e0b' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
      case 'OK':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> ONLINE (100% READY)</span>;
      case 'RATE_LIMITED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-500" /> RATE LIMITED (429)</span>;
      case 'UNAUTHORIZED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5"><XCircle className="w-3 h-3 text-rose-500" /> KEY INVALID (401)</span>;
      case 'NOT_CONFIGURED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">BELUM DIKONFIGURASI</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">ERROR</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Sisa Kuota Model AI & Waktu Pemulihan</h1>
              <p className="text-xs text-slate-500">
                Pantau kapasitas tersisa per model AI & hitung mundur waktu pemulihan (recovery countdown) secara realtime.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {lastChecked && (
            <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
              Diperbarui: {lastChecked}
            </span>
          )}
          <Button
            onClick={fetchDiagnostics}
            disabled={refreshing}
            variant="outline"
            className="h-10 text-xs font-semibold gap-2 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Memeriksa...' : 'Tes Diagnostik Ulang'}
          </Button>
        </div>
      </div>

      {/* Overall Health Status Hero */}
      <div className={`p-6 rounded-2xl border transition-all ${
        overall === 'HEALTHY' 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950'
          : overall === 'DEGRADED'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-950'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              overall === 'HEALTHY' 
                ? 'bg-emerald-500 text-white' 
                : overall === 'DEGRADED' 
                ? 'bg-amber-500 text-white' 
                : 'bg-rose-500 text-white'
            }`}>
              {overall === 'HEALTHY' && <CheckCircle2 className="w-7 h-7" />}
              {overall === 'DEGRADED' && <AlertTriangle className="w-7 h-7" />}
              {overall === 'CRITICAL' && <ShieldAlert className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">
                  {overall === 'HEALTHY' && 'Sistem AI Normal & Seluruh Model Siap Digunakan'}
                  {overall === 'DEGRADED' && 'Sebagian Model AI Terkena Rate Limit (Sedang Pemulihan/Recovery)'}
                  {overall === 'CRITICAL' && 'Semua Provider AI Mengalami Masalah / Belum Dikonfigurasi'}
                </h2>
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    overall === 'HEALTHY' ? 'bg-emerald-400' : overall === 'DEGRADED' ? 'bg-amber-400' : 'bg-rose-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    overall === 'HEALTHY' ? 'bg-emerald-500' : overall === 'DEGRADED' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}></span>
                </span>
              </div>
              <p className="text-xs opacity-80 mt-1 leading-relaxed">
                {overall === 'HEALTHY' && 'Seluruh model AI dari Gemini, Groq, dan OpenRouter memiliki sisa kuota aman tanpa kendala.'}
                {overall === 'DEGRADED' && 'Sistem otomatis mengalihkan (fallback) ke model cadangan yang masih memiliki kuota aktif.'}
                {overall === 'CRITICAL' && 'Periksa file .env Anda dan masukkan OPENROUTER_API_KEY, GROQ_API_KEY, atau GEMINI_API_KEY.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: MODEL-BY-MODEL QUOTA & RECOVERY COUNTDOWN CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4.5 h-4.5 text-indigo-600" /> Sisa Kuota Per Model & Hitung Mundur Pemulihan (Recovery)
          </h2>
          <span className="text-xs text-slate-400 font-mono">{allModels.length} Model Teruji</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allModels.map((m) => {
            const isOk = m.status === 'OK';
            const isRateLimit = m.status === 'RATE_LIMITED';
            const percent = m.usagePercent;

            return (
              <Card key={m.model} className="border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mb-1 inline-block">
                        {m.provider}
                      </span>
                      <CardTitle className="text-sm font-bold text-slate-900 leading-snug">{m.modelName}</CardTitle>
                      <CardDescription className="text-[11px] font-mono text-slate-400 mt-0.5 truncate max-w-[200px]">
                        {m.model}
                      </CardDescription>
                    </div>

                    <div className="shrink-0">
                      <span className={`w-3 h-3 rounded-full inline-block ${
                        isOk ? 'bg-emerald-500 shadow-sm shadow-emerald-300' : isRateLimit ? 'bg-amber-500 animate-ping' : 'bg-rose-500'
                      }`} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* Progress Bar Kuota Tersisa */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Sisa Kuota:</span>
                      <span className={percent > 50 ? 'text-emerald-600 font-bold' : percent > 15 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold'}>
                        {m.remainingQuota} / {m.totalQuota} {m.quotaUnit}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          percent > 50 ? 'bg-emerald-500' : percent > 15 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                  </div>

                  {/* Latensi & Error Msg */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Latensi:
                    </span>
                    <span className="font-mono font-bold text-slate-800">{m.latencyMs} ms</span>
                  </div>

                  {m.errorMsg && (
                    <div className="p-2 bg-rose-50 border border-rose-100 rounded text-[11px] text-rose-700 font-mono break-all">
                      ⚠️ {m.errorMsg}
                    </div>
                  )}

                  {/* Status Pemulihan / Recovery Countdown */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Status Pemulihan:</span>
                    <RecoveryCountdown 
                      initialSeconds={m.recoverySeconds} 
                      estimatedReadyAt={m.estimatedReadyAt} 
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: TOP METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Provider Aktif</p>
              <p className="text-2xl font-bold text-slate-900">
                {data?.onlineCount} <span className="text-xs font-normal text-slate-400">/ {data?.configuredCount} Online</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Model Rate Limited (429)</p>
              <p className={`text-2xl font-bold ${data?.rateLimitedCount ? 'text-amber-600' : 'text-emerald-600'}`}>
                {data?.rateLimitedCount || 0} <span className="text-xs font-normal text-slate-400">Model Sedang Recovering</span>
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              data?.rateLimitedCount ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">OpenRouter Usage</p>
              <p className="text-2xl font-bold text-slate-900">
                ${openrouterDetails.usageUSD !== undefined ? Number(openrouterDetails.usageUSD).toFixed(6) : '0.00'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Latensi Respon Tercepat</p>
              <p className="text-2xl font-bold text-slate-900">
                {Math.min(...(data?.providers.filter(p => p.status === 'ONLINE').map(p => p.latencyMs) || [0]))} <span className="text-xs font-normal text-slate-400">ms</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3: GRAFIK INTERAKTIF RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Latensi Respon Provider AI (Bar Chart) */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" /> Perbandingan Latensi Provider (ms)
              </span>
              <span className="text-[10px] font-normal text-slate-400">Semakin kecil semakin cepat</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Kecepatan waktu respon langsung dari server API dalam milidetik.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="h-[220px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip 
                    formatter={(value: any) => [`${value} ms`, 'Latensi']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="latensi" radius={[6, 6, 0, 0]}>
                    {latencyChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.status === 'ONLINE' ? (index === 0 ? '#3b82f6' : index === 1 ? '#a855f7' : '#10b981') : '#f43f5e'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* CHART 2: Trend Latensi Realtime (Area Chart) */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Trend Fluktuasi Latensi (Realtime Log)
              </span>
              <span className="text-[10px] font-normal text-slate-400">10 Uji Diagnostik Terakhir</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Merekam kestabilan waktu respon setiap kali diagnostik dijalankan.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="h-[220px] w-full pt-4">
              {latencyHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="google" name="Gemini AI" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="openrouter" name="OpenRouter" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="groq" name="Groq AI" stroke="#a855f7" fill="#a855f7" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Menunggu data sejarah diagnostik...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: REAL API DATA BREAKDOWN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OpenRouter Real API Account Stats */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" /> Real Data Akun OpenRouter (Official API)
            </CardTitle>
            <CardDescription className="text-xs">
              Data langsung dari endpoint `/api/v1/auth/key`
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold">Tipe Akun API</span>
                <span className="font-bold text-slate-800 text-sm">{openrouterDetails.isFreeTier ? 'Free Tier Key' : 'Paid Key'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Biaya (USD)</span>
                <span className="font-bold text-slate-800 text-sm">${openrouterDetails.usageUSD || '0.0000'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold">Penggunaan Hari Ini</span>
                <span className="font-bold text-slate-800 text-sm">${openrouterDetails.usageDailyUSD || '0.0000'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold">Penggunaan Bulan Ini</span>
                <span className="font-bold text-slate-800 text-sm">${openrouterDetails.usageMonthlyUSD || '0.0000'}</span>
              </div>
            </div>

            {/* Usage Bar Chart */}
            <div className="space-y-1.5 pt-2">
              <p className="text-[11px] font-bold text-slate-700">Rincian Penggunaan Pengeluaran (USD):</p>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={openrouterUsageData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val: any) => [`$${val}`, 'Penggunaan']} />
                    <Bar dataKey="usage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Groq Real Rate Limit & Quota Headers */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600" /> Real Rate-Limit Headers Groq API
            </CardTitle>
            <CardDescription className="text-xs">
              Header kuota mentah `x-ratelimit-*` langsung dari respon server Groq
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <span className="text-[10px] text-purple-600 block font-semibold">Sisa Request / Menit (RPM)</span>
                <span className="font-bold text-purple-950 text-sm">
                  {groqDetails.requestsRemaining || 30} / {groqDetails.requestsLimitPerMin || 30}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-600 block font-semibold">Sisa Token / Menit (TPM)</span>
                <span className="font-bold text-emerald-950 text-sm">
                  {groqDetails.tokensRemaining || 14400} / {groqDetails.tokensLimitPerMin || 14400}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Reset Counter Window:</span>
                <span className="font-bold text-slate-800">{groqDetails.resetRequestsTime || '0s'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Quota RPM:</span>
                <span className="font-bold text-emerald-600">Aman ({Math.round(((groqDetails.requestsRemaining || 30) / (groqDetails.requestsLimitPerMin || 30)) * 100)}%)</span>
              </div>
            </div>

            {/* Quota Donut / Pie Chart */}
            <div className="flex items-center justify-between pt-2">
              <div className="h-[120px] w-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={groqQuotaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={45}>
                      {groqQuotaData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600 text-[11px]">Sisa Request (RPM)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600 text-[11px]">Request Terpakai</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 5: INTERACTIVE MICRO TEST CONSOLE */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-5">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" /> Uji Coba Respons AI Langsung (Live Chat Test)
          </CardTitle>
          <CardDescription className="text-xs">
            Kirimkan satu baris pesan cepat untuk memastikan bahwa AI dalam aplikasi dapat merespon streaming data secara langsung saat ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <form onSubmit={handleSendTestPrompt} className="flex gap-2">
            <Input
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Ketik pesan tes..."
              className="h-10 text-xs border-slate-200"
              disabled={testSending}
            />
            <Button
              type="submit"
              disabled={testSending || !testPrompt.trim()}
              className="h-10 text-xs font-semibold px-4 gap-2 bg-slate-900 text-white hover:bg-slate-800 shrink-0"
            >
              {testSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {testSending ? 'Menguji...' : 'Kirim Tes'}
            </Button>
          </form>

          {testError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-mono">
              ❌ {testError}
            </div>
          )}

          {testResponse && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-2 font-mono leading-relaxed border border-slate-800 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[10px] text-slate-400">
                <span>🟢 Respon Streaming AI (Live):</span>
                <span>OK 200</span>
              </div>
              <p className="whitespace-pre-wrap">{testResponse}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
