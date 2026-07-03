'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function OptimizationEngineWidget() {
  const [recommendation, setRecommendation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchRecommendation() {
      try {
        const res = await fetch('/api/ai-advisor/recommendation?type=savings', {
          method: 'POST'
        });
        if (res.ok) {
          const data = await res.json();
          setRecommendation(data.recommendation);
        } else {
          setRecommendation('Gagal memuat rekomendasi otomatis. Pastikan Anda memiliki koneksi internet dan target tabungan aktif.');
        }
      } catch (err) {
        console.error('Error fetching savings recommendation:', err);
        setRecommendation('Terjadi gangguan jaringan saat memuat rekomendasi.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecommendation();
  }, []);

  return (
    <div className="bg-[#131b2e] text-white p-8 rounded-xl relative overflow-hidden mt-8 shadow-md">
      {/* Background glow effects */}
      <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-300 fill-amber-300" />
          <h3 className="text-base font-bold uppercase tracking-wider">Optimization Engine</h3>
        </div>
        
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="text-xs font-semibold">Opin sedang menganalisis rekening & pola pengeluaran bulanan Anda...</span>
          </div>
        ) : (
          <p className="text-xs md:text-sm max-w-2xl text-slate-300 leading-relaxed font-semibold">
            {recommendation}
          </p>
        )}
        
        <div className="pt-4 flex flex-wrap gap-3">
          <button className="bg-white hover:bg-white/90 text-[#131b2e] px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow active:scale-95">
            Terapkan Optimasi
          </button>
          <button className="border border-white/20 text-white hover:bg-white/10 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95">
            Tinjau Rincian
          </button>
        </div>
      </div>
    </div>
  );
}
