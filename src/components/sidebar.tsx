'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Receipt, 
  Target, 
  BarChart3, 
  Settings, 
  Landmark 
} from 'lucide-react';
import { Button } from './ui/button';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transaksi', href: '/transaksi', icon: Receipt },
  { name: 'Target Tabungan', href: '/tabungan', icon: Target },
  { name: 'Laporan', href: '/laporan', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b border-[#c6c6cd] bg-[#f7f9fb] px-4 text-[#191c1e] md:hidden fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-black flex items-center justify-center rounded-lg text-white">
            <Landmark className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-sans text-base font-bold tracking-tight text-black">Amanah Finance</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-[#191c1e] hover:bg-[#eceef0]"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed bottom-0 top-16 z-40 flex w-64 flex-col border-r border-[#c6c6cd] bg-[#f7f9fb] text-[#191c1e] transition-transform duration-300 md:top-0 md:h-screen md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header (Desktop Only) */}
        <div className="hidden h-20 items-center px-6 md:flex border-b border-[#c6c6cd]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-black flex items-center justify-center rounded-lg text-white">
              <Landmark className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-sans text-base font-bold tracking-tight leading-tight text-black">Amanah Finance</h1>
              <span className="text-[10px] text-[#45464d] font-semibold">Wealth Management</span>
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-grow mt-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center px-4 py-3 rounded-lg transition-all duration-200 group
                  ${isActive 
                    ? 'text-black font-bold border-r-2 border-black bg-[#f2f4f6]' 
                    : 'text-[#45464d] hover:text-black hover:bg-[#eceef0]/80'
                  }
                `}
              >
                <Icon className={`mr-3 h-5 w-5 transition-transform duration-250 group-hover:scale-105 ${isActive ? 'text-black' : 'text-[#45464d]'}`} />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Area with Profile */}
        <div className="p-4 border-t border-[#c6c6cd] bg-[#f7f9fb]">
          <div className="flex items-center p-2.5 rounded-lg hover:bg-[#eceef0] transition-colors cursor-pointer justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center uppercase shrink-0">
                AR
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-xs font-bold text-black truncate leading-tight">A. Rahman</p>
                <p className="text-[10px] text-[#45464d] font-medium truncate">Private Client</p>
              </div>
            </div>
            <Settings className="h-4 w-4 text-[#45464d] hover:text-black hover:rotate-45 transition-transform duration-200" />
          </div>
        </div>
      </aside>

      {/* Spacing for mobile layout */}
      <div className="h-16 md:hidden w-full" />
    </>
  );
}
