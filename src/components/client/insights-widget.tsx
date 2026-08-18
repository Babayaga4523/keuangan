'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, PiggyBank, CalendarRange, Loader2, CheckCircle, Info } from 'lucide-react';

interface Anomaly {
  categoryId: string;
  categoryName: string;
  currentSum: number;
  avgSum: number;
  zScore: number;
  severity: 'MEDIUM' | 'HIGH';
  message: string;
}

interface Prediction {
  currentBalance: number;
  dailyBurnRate: number;
  daysRemaining: number;
  projectedRemainingExpense: number;
  estimatedRemainingIncome: number;
  projectedEndBalance: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'AMAN' | 'MEPET' | 'DEFISIT';
}

interface InsightsData {
  anomalies: Anomaly[];
  prediction: Prediction;
}

export default function InsightsWidget() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/insights');
        if (res.ok) {
          const rawText = await res.text();
          if (rawText) {
            try {
              const result = JSON.parse(rawText);
              setData(result);
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch insights:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInsights();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 flex items-center justify-center min-h-[180px] shadow-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-black" />
          <span className="text-xs font-semibold">Memproses deteksi anomali & proyeksi saldo akhir...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { anomalies, prediction } = data;

  // Helpers for badge styles
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'AMAN': return 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]';
      case 'MEPET': return 'bg-[#fef7e0] text-[#b06000] border-[#feebc8]';
      case 'DEFISIT': return 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getConfidenceText = (conf: string) => {
    switch (conf) {
      case 'LOW': return 'Rendah (Awal Bulan)';
      case 'MEDIUM': return 'Sedang (Menengah)';
      case 'HIGH': return 'Tinggi (Stabil)';
      default: return conf;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ─────────────────────────────────────────────────────────────
          SECTION A: ANOMALY DETECTOR
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e2e8f0]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-black" />
              <h3 className="text-sm font-bold text-black uppercase tracking-wider">Deteksi Anomali Belanja</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Z-Score</span>
          </div>

          <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
            {anomalies.length === 0 ? (
              <div className="bg-[#e6f4ea]/40 border border-[#ceead6]/70 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#137333] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#137333] uppercase tracking-wider">Pengeluaran Wajar</h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                    Semua kategori pengeluaran Anda minggu ini berada dalam batas normal. Tidak terdeteksi lonjakan belanja yang signifikan!
                  </p>
                </div>
              </div>
            ) : (
              anomalies.map((a, idx) => (
                <motion.div 
                  key={a.categoryId}
                  className={`border rounded-xl p-4 flex items-start gap-3 transition-all ${
                    a.severity === 'HIGH' 
                      ? 'bg-red-50/50 border-red-200/80 text-red-800' 
                      : 'bg-amber-50/50 border-amber-200/80 text-amber-800'
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${
                    a.severity === 'HIGH' ? 'text-[#c5221f]' : 'text-amber-600'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${
                        a.severity === 'HIGH' ? 'text-red-900' : 'text-amber-900'
                      }`}>
                        Spike: {a.categoryName}
                      </h4>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        a.severity === 'HIGH' ? 'bg-[#fce8e6] text-[#c5221f]' : 'bg-[#fef7e0] text-[#b06000]'
                      }`}>
                        {a.severity}
                      </span>
                    </div>
                    <p className={`text-[11px] sm:text-xs mt-1.5 leading-relaxed font-medium ${
                      a.severity === 'HIGH' ? 'text-red-750' : 'text-amber-750'
                    }`}>
                      {a.message}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-4 pt-3 border-t border-[#e2e8f0]/60">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>Mengabaikan pengeluaran kecil di bawah Rp 20.000 untuk mencegah alarm palsu.</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION B: BALANCE PROJECTION
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e2e8f0]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-black" />
              <h3 className="text-sm font-bold text-black uppercase tracking-wider">Proyeksi Saldo Akhir Bulan</h3>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusStyle(prediction.status)}`}>
              {prediction.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">SALDO HARI INI</span>
              <span className="text-base sm:text-lg font-bold font-mono text-black">
                Rp {prediction.currentBalance.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 relative overflow-hidden">
              <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">PROYEKSI AKHIR BULAN</span>
              <span className={`text-base sm:text-lg font-bold font-mono ${
                prediction.projectedEndBalance < 0 ? 'text-[#c5221f]' : 'text-black'
              }`}>
                Rp {prediction.projectedEndBalance.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-semibold text-[#45464d] border-t border-[#e2e8f0]/60 pt-4">
            <div className="flex justify-between items-center py-1">
              <span className="flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4 text-slate-400" />
                Burn-Rate Harian Aktual
              </span>
              <span className="font-mono font-bold text-black">
                Rp {prediction.dailyBurnRate.toLocaleString('id-ID')}/hari
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4 text-slate-400" />
                Sisa Hari Bulan Ini
              </span>
              <span className="font-mono font-bold text-black">
                {prediction.daysRemaining} hari lagi
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="flex items-center gap-1.5">
                <PiggyBank className="h-4 w-4 text-slate-400" />
                Pendapatan Terjadwal Sisa Bulan
              </span>
              <span className="font-mono font-bold text-[#009668]">
                +Rp {prediction.estimatedRemainingIncome.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-[#e2e8f0]/60 text-[10px] sm:text-xs">
          <span className="text-slate-400 font-bold">AKURASI PROYEKSI</span>
          <span className={`font-bold uppercase ${
            prediction.confidence === 'HIGH' ? 'text-[#009668]' :
            prediction.confidence === 'MEDIUM' ? 'text-amber-600' : 'text-slate-400'
          }`}>
            {getConfidenceText(prediction.confidence)}
          </span>
        </div>
      </div>
    </div>
  );
}
