'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Calendar, Smartphone, Sparkles, Loader2 } from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  targetAmount: number;
  date: string;
  description: string;
  isCompleted: boolean;
  value: number;
}

interface RoadmapData {
  showRoadmap: boolean;
  targetName: string;
  targetPrice: number;
  currentBalance: number;
  progressPercent: number;
  milestones: Milestone[];
}

export default function RoadmapTimelineWidget() {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRoadmap() {
      try {
        const res = await fetch('/api/roadmap');
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
        console.error('Failed to fetch roadmap:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRoadmap();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 flex items-center justify-center min-h-[200px] shadow-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-black" />
          <span className="text-xs font-semibold">Memuat peta jalan target iPhone...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.showRoadmap) {
    return null; // Don't show anything if profile is not 'yoga'
  }

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-xs relative overflow-hidden">
      {/* Visual background sparkles */}
      <div className="absolute -right-12 -top-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#e2e8f0]">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-black" />
            <h3 className="text-sm font-bold text-black uppercase tracking-wider">Target Roadmap Gamifikasi</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Rencana finansial terpadu Yoga membeli <strong className="text-black">{data.targetName}</strong> seharga <strong className="text-black">Rp {data.targetPrice.toLocaleString('id-ID')}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] font-bold text-[#45464d] uppercase block">Progres Tabungan</span>
            <span className="text-xl font-bold font-mono text-black">{data.progressPercent}%</span>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center bg-black/5">
            <Sparkles className="h-4.5 w-4.5 text-black" />
          </div>
        </div>
      </div>

      {/* Dynamic progress bar */}
      <div className="w-full bg-slate-100 h-2.5 rounded-full mb-8 overflow-hidden relative border border-slate-200/50">
        <motion.div 
          className="bg-black h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${data.progressPercent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* Vertical Gamified Timeline */}
      <div className="relative pl-6 sm:pl-8 space-y-6">
        {/* Central connecting line */}
        <div className="absolute left-2.5 sm:left-3.5 top-2.5 bottom-2.5 w-0.5 bg-[#e2e8f0]" />

        {data.milestones.map((milestone, idx) => {
          return (
            <motion.div 
              key={milestone.id}
              className="relative flex gap-4 sm:gap-6 items-start group"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
            >
              {/* Bullet point / Status circle */}
              <div className="absolute -left-[29px] sm:-left-[35px] top-1 z-10 flex items-center justify-center bg-white rounded-full p-0.5">
                {milestone.isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-black fill-black text-white stroke-[2.5]" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 stroke-[2.5] fill-white" />
                )}
              </div>

              {/* Card layout */}
              <div className={`flex-1 border rounded-xl p-4 transition-all duration-200 ${
                milestone.isCompleted 
                  ? 'bg-[#f8fafc]/70 border-[#e2e8f0] shadow-2xs' 
                  : 'bg-white border-[#e2e8f0]/60 opacity-60'
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-1 mb-1.5">
                  <h4 className={`text-xs font-bold ${milestone.isCompleted ? 'text-black' : 'text-slate-500'}`}>
                    {milestone.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                    <Calendar className="h-3 w-3" />
                    <span>{milestone.date}</span>
                  </div>
                </div>
                
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-medium">
                  {milestone.description}
                </p>

                {/* Amount / Budget display */}
                <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200/60 flex justify-between items-center text-[10px] sm:text-xs">
                  <span className="text-slate-400 font-bold">ALOKASI SALDO</span>
                  <span className={`font-bold font-mono ${
                    milestone.value > 0 ? 'text-[#009668]' : 'text-[#ba1a1a]'
                  }`}>
                    {milestone.value > 0 ? '+' : ''}Rp {milestone.value.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
