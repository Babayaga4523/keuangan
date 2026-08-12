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
  Key, 
  HelpCircle, 
  Sparkles,
  Server,
  Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    modelsTested: {
      model: string;
      status: 'OK' | 'RATE_LIMITED' | 'ERROR';
      statusCode: number | null;
      latencyMs: number;
      errorMsg?: string;
    }[];
  }[];
}

export default function AiStatusMonitor() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string>('');

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
        const json = await res.json();
        setData(json);
        setLastChecked(new Date().toLocaleTimeString('id-ID'));
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
    const interval = setInterval(fetchDiagnostics, 60000); // auto re-check every 60s
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
      // Auto re-check status after sending test prompt to capture fresh latency/quota
      fetchDiagnostics();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Memeriksa status & kuota API Key AI...</p>
      </div>
    );
  }

  const overall = data?.overallHealth || 'CRITICAL';

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
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Status & Limit Penggunaan AI</h1>
              <p className="text-xs text-slate-500">
                Pantau kesehatan API Key, batasan rate limit (429), dan kecepatan latensi AI secara realtime.
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
                  {overall === 'HEALTHY' && 'Sistem AI Normal & Berjalan Lancar'}
                  {overall === 'DEGRADED' && 'Sebagian AI Terkena Limit / Kuota Habis (Fallback Aktif)'}
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
                {overall === 'HEALTHY' && 'Seluruh API Key AI merespon dengan cepat tanpa kendala rate limit.'}
                {overall === 'DEGRADED' && 'Sistem otomatis mengalihkan (fallback) ke provider cadangan yang masih aktif saat provider utama terkena limit 429.'}
                {overall === 'CRITICAL' && 'Periksa file .env Anda dan masukkan OPENROUTER_API_KEY, GROQ_API_KEY, atau GEMINI_API_KEY.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
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
              <p className="text-xs font-semibold text-slate-500">Rate Limit (429) Detected</p>
              <p className={`text-2xl font-bold ${data?.rateLimitedCount ? 'text-amber-600' : 'text-emerald-600'}`}>
                {data?.rateLimitedCount || 0} <span className="text-xs font-normal text-slate-400">Provider</span>
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
                {data?.providers.find(p => p.provider === 'openrouter')?.details?.usageUSD !== undefined
                  ? `$${Number(data.providers.find(p => p.provider === 'openrouter')?.details?.usageUSD || 0).toFixed(4)}`
                  : 'N/A'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Respon Tercepat</p>
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

      {/* Provider Details Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-700" /> Detail Status API Provider AI
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.providers.map((p) => {
            const isOnline = p.status === 'ONLINE';
            const isLimit = p.status === 'RATE_LIMITED';
            const isNotSet = p.status === 'NOT_CONFIGURED';

            return (
              <Card key={p.provider} className="border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                        isOnline ? 'bg-emerald-100 text-emerald-800' :
                        isLimit ? 'bg-amber-100 text-amber-800' :
                        isNotSet ? 'bg-slate-100 text-slate-500' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {p.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-900">{p.name}</CardTitle>
                        <CardDescription className="text-[11px] text-slate-500 font-mono">
                          {p.isConfigured ? 'API Key Terpasang' : 'API Key Belum Ada'}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                        isOnline 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : isLimit 
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isNotSet
                          ? 'bg-slate-50 text-slate-500 border-slate-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isOnline && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        {isLimit && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        {!isOnline && !isLimit && <XCircle className="w-3 h-3" />}
                        {p.status}
                      </span>
                      {p.latencyMs > 0 && (
                        <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {p.latencyMs} ms
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  {p.errorMessage && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-mono break-all">
                      ⚠️ {p.errorMessage}
                    </div>
                  )}

                  {/* OpenRouter specific metadata */}
                  {p.details && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Tipe Akun</span>
                        <span className="font-semibold text-slate-700">{p.details.isFreeTier ? 'Free Tier' : 'Paid / Credit'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Batas Kuota</span>
                        <span className="font-semibold text-slate-700">{p.details.limitUSD ? `$${p.details.limitUSD}` : 'Tak Terbatas / Standard'}</span>
                      </div>
                    </div>
                  )}

                  {/* Models tested */}
                  {p.modelsTested.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uji Model Terakhir:</p>
                      {p.modelsTested.map((m) => (
                        <div key={m.model} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 border border-slate-100">
                          <span className="font-mono text-slate-700 text-[11px] truncate max-w-[180px]">{m.model}</span>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.status === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {m.status} ({m.statusCode || 500})
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{m.latencyMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Interactive Micro Test Console */}
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

      {/* Guidelines & Tips for Rate Limit (HTTP 429) */}
      <Card className="border-indigo-100 bg-indigo-50/40 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span>Panduan & Informasi Rate Limit (Limit AI)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Apa itu HTTP 429?
              </p>
              <p className="text-[11px] leading-relaxed">
                Error 429 terjadi ketika jumlah permintaan atau token (TPM/RPM) ke provider AI melebihi batas kuota gratis atau per-menit yang diizinkan.
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sistem Multi-Provider Fallback
              </p>
              <p className="text-[11px] leading-relaxed">
                Aplikasi ini dilengkapi sistem fallback otomatis. Jika Google Gemini terkena limit 429, sistem otomatis berpindah ke Groq atau OpenRouter.
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Cara Mengatasi Limit
              </p>
              <p className="text-[11px] leading-relaxed">
                Jika semua provider terbatas, Anda bisa menunggu 1-5 menit untuk reset window atau mengganti `OPENROUTER_API_KEY` / `GROQ_API_KEY` di file `.env`.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
