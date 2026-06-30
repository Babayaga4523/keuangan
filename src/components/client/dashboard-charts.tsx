'use client';

import { useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { formatRupiah } from '@/utils/format';

interface NetWorthItem {
  date: string;
  displayDate: string;
  balance: number;
}

interface AllocationItem {
  name: string;
  percentage: string;
  fraction: number;
  balance: number;
  color: string;
}

interface ForecastItem {
  name: string;
  inflow: number;
  outflow: number;
}

export function NetWorthChart({ data }: { data: NetWorthItem[] }) {
  return (
    <div className="h-44 w-full mt-4">
      {data.length === 0 ? (
        <div className="h-full flex items-center justify-center text-slate-400 text-xs">
          Belum ada riwayat transaksi.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="gradient-networth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#000000" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#000000" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="displayDate" 
              tickLine={false} 
              axisLine={false} 
              stroke="#64748b" 
              fontSize={9} 
              tickMargin={6} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              stroke="#64748b" 
              fontSize={9} 
              tickFormatter={(v) => `Rp ${(v / 1000000).toFixed(0)}jt`} 
              tickMargin={6} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              labelFormatter={(label, items) => {
                const item = items[0]?.payload as NetWorthItem;
                return item ? `Tanggal: ${item.date}` : label;
              }}
              formatter={(value: any) => [formatRupiah(value), 'Kekayaan Bersih']}
            />
            <Area 
              type="monotone" 
              dataKey="balance" 
              stroke="#000000" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#gradient-networth)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function AllocationChart({ allocations }: { allocations: AllocationItem[] }) {
  const data = allocations.map(a => ({
    name: a.name,
    value: a.balance,
    percentage: a.percentage,
    color: a.color
  }));

  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center px-2">
          <span className="text-base font-bold text-black leading-none">
            {data[activeIndex]?.percentage || data[0]?.percentage || '0'}%
          </span>
          <span className="text-[8px] text-[#45464d] uppercase font-bold tracking-tight mt-0.5 max-w-[80px] truncate">
            {data[activeIndex]?.name || data[0]?.name || 'Saldo'}
          </span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="space-y-1.5 mt-5 w-full">
        {allocations.map((alloc, idx) => (
          <div 
            key={idx} 
            className={`flex justify-between items-center text-xs p-1.5 rounded transition-all duration-150 cursor-pointer ${activeIndex === idx ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50'}`}
            onMouseEnter={() => setActiveIndex(idx)}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full block shrink-0" style={{ backgroundColor: alloc.color }} />
              <span className="text-slate-600 font-medium truncate max-w-[125px]">{alloc.name}</span>
            </div>
            <span className="font-bold text-slate-800 font-mono text-[11px] shrink-0">{alloc.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ForecastChart({ data }: { data: ForecastItem[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            tickLine={false} 
            axisLine={false} 
            stroke="#64748b" 
            fontSize={9} 
            tickMargin={6} 
          />
          <YAxis 
            tickLine={false} 
            axisLine={false} 
            stroke="#64748b" 
            fontSize={9} 
            tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}rb`} 
            tickMargin={6} 
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            formatter={(value: any, name: any) => [
              formatRupiah(value), 
              name === 'inflow' ? 'Pemasukan' : 'Pengeluaran'
            ]}
          />
          <Bar dataKey="inflow" fill="#000000" radius={[2, 2, 0, 0]} name="inflow" />
          <Bar dataKey="outflow" fill="#76777d" radius={[2, 2, 0, 0]} name="outflow" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
