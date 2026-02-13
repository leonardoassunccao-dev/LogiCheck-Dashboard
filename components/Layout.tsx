import React, { useEffect, useState } from 'react';
import { Sun, Moon, Wifi, WifiOff, Box, Tv } from 'lucide-react';
import { Tab, Theme } from '../types';
import { TABS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  theme: Theme;
  onToggleTheme: () => void;
  isMeetingMode: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, activeTab, onTabChange, theme, onToggleTheme, isMeetingMode 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`min-h-screen flex flex-col transition-all duration-500 ${isMeetingMode ? 'bg-gray-50 dark:bg-slate-950' : 'bg-gray-50 dark:bg-slate-900'}`}>
      {/* Header - Hidden in Meeting Mode */}
      {!isMeetingMode && (
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 shadow-soft">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-marsala-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-marsala-100 dark:shadow-none">
                  <Box size={28} strokeWidth={2.5} />
                </div>
                <div>
                   <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">
                     LogiCheck
                   </h1>
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
                </div>

                <button 
                  type="button"
                  onClick={onToggleTheme}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 transition-all shadow-inner"
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </div>
            </div>

            <nav className="flex space-x-8 -mb-px overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                        onTabChange(tab.id);
                        window.location.hash = tab.id;
                    }}
                    className={`
                      group inline-flex items-center py-5 px-1 border-b-4 font-bold text-xs uppercase tracking-widest transition-all duration-300
                      ${isActive 
                        ? 'border-marsala-600 text-marsala-600 dark:text-marsala-400' 
                        : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200 dark:text-gray-500 dark:hover:text-gray-200'}
                    `}
                  >
                    <Icon className={`mr-2 h-4 w-4 ${isActive ? 'text-marsala-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 w-full mx-auto transition-all duration-500 ${isMeetingMode ? 'px-10 py-10 max-w-full' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-10'}`}>
        {children}
      </main>

      {/* Footer - Minimalist & Discreet */}
      {!isMeetingMode && (
        <footer className="bg-transparent border-t border-gray-100 dark:border-gray-800 py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 opacity-50 hover:opacity-100 transition-opacity duration-300">
            <div className="text-center md:text-left">
               <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <span className="font-black text-gray-900 dark:text-white">LogiCheck</span>
                 <span className="text-gray-300 dark:text-gray-700">|</span>
                 <span>NODO Studio • Tecnologia aplicada à logística</span>
               </p>
            </div>
            <div className="flex items-center gap-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
               <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[9px] text-gray-500">v1.0.1</span>
               <div className="flex flex-col items-end">
                 <span className="text-[8px] text-gray-400 font-black">BUILD STAMP: 2025-05-23 10:45</span>
                 <span className="text-[7px] text-gray-300 font-mono tracking-tighter">SHA: 8f921d7_prod</span>
               </div>
               <button className="hover:text-marsala-500 transition-colors">Suporte</button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};