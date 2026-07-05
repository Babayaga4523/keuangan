import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center space-y-6 py-12">
      <div className="relative flex items-center justify-center">
        {/* Premium Glow effect in background */}
        <div className="absolute w-16 h-16 bg-[#0052cc]/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute w-24 h-24 bg-[#10b981]/5 rounded-full blur-2xl animate-pulse delay-100" />
        
        {/* Main Spinner */}
        <Loader2 className="h-10 w-10 animate-spin text-black stroke-[2.5]" />
      </div>
      
      <div className="flex flex-col items-center space-y-2 text-center">
        <h3 className="text-xs font-bold text-black tracking-widest uppercase animate-pulse">
          Menyiapkan Data
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wide">
          Mensinkronisasi saldo, transaksi, dan anggaran...
        </p>
      </div>
    </div>
  );
}
