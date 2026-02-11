import React, { useMemo, useState } from 'react';
import { ETrackRecord, DrillDownType } from '../types';
import { Card, KPICard } from './ui/Card';
import { 
  LayoutDashboard, Users, MapPin, Package, Download, 
  UserCheck, Activity, ClipboardList, Calendar, 
  Zap, ChevronRight, BarChart3, Tv
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, AreaChart, Area
} from 'recharts';
import { PDFService } from '../services/pdfService';
import { AnalysisService } from '../services/analysisService';
import DrillDownModal from './DrillDownModal';

interface DashboardTabProps {
  data: ETrackRecord[];
  isMeetingMode: boolean;
  onToggleMeetingMode: () => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ data, isMeetingMode, onToggleMeetingMode }) => {
  const [drillDownType, setDrillDownType] = useState<DrillDownType | null>(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const filteredData = useMemo(() => {
    if (!dateStart && !dateEnd) return data;
    return data.filter(d => {
      const rowDate = new Date(d.conferenciaData).toISOString().split('T')[0];
      if (dateStart && rowDate < dateStart) return false;
      if (dateEnd && rowDate > dateEnd) return false;
      return true;
    });
  }, [data, dateStart, dateEnd]);

  const score = useMemo(() => AnalysisService.calculateScore(filteredData), [filteredData]);
  const insights = useMemo(() => AnalysisService.getInsights(filteredData), [filteredData]);
  const comparison = useMemo(() => AnalysisService.getComparison(filteredData), [filteredData]);

  const kpis = useMemo(() => {
    const totalNfs = filteredData.reduce((acc, curr) => acc + curr.nfColetadas, 0);
    const uniqueDrivers = new Set(filteredData.map(d => d.motorista)).size;
    const uniqueFiliais = new Set(filteredData.map(d => d.filial)).size;
    const activeInspectors = new Set(filteredData.map(d => d.conferidoPor).filter(c => c && c !== 'N/A')).size;
    return { count: filteredData.length, totalNfs, uniqueDrivers, uniqueFiliais, activeInspectors };
  }, [filteredData]);

  const timeSeriesData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(d => {
      const date = new Date(d.conferenciaData).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      map[date] = (map[date] || 0) + d.nfColetadas;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).slice(-15);
  }, [filteredData]);

  const topDrivers = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(d => map[d.motorista] = (map[d.motorista] || 0) + d.nfColetadas);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredData]);

  const topInspectors = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(d => {
      if (d.conferidoPor && d.conferidoPor !== 'N/A') {
        map[d.conferidoPor] = (map[d.conferidoPor] || 0) + d.nfColetadas;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredData]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 animate-fadeIn">
        <div className="w-20 h-20 bg-marsala-50 dark:bg-marsala-900/10 rounded-3xl flex items-center justify-center text-marsala-600 mb-8 shadow-inner">
           <Zap size={40} />
        </div>
        <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">
          Transforme seus dados brutos <br/> em clareza operacional.
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-10 leading-relaxed text-lg">
          O LogiCheck analisa seus romaneios do E-track e gera insights inteligentes para sua tomada de decisão.
        </p>
        <button 
          onClick={() => window.location.hash = '#dados'}
          className="px-8 py-4 bg-marsala-600 text-white rounded-2xl font-bold shadow-xl shadow-marsala-200 dark:shadow-none hover:bg-marsala-700 transition-all transform hover:scale-105 flex items-center gap-2"
        >
          <ClipboardList size={20} />
          Começar Importação
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-8 animate-fadeIn ${isMeetingMode ? 'max-w-full px-4' : ''}`}>
        
        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 items-center justify-center text-marsala-600">
               <LayoutDashboard size={28} />
            </div>
            <div>
               <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">Dashboard</h2>
               <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-2">Visão Geral da Operação</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                <Calendar size={16} className="text-gray-400 ml-2" />
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-transparent border-none text-xs font-bold dark:text-white focus:ring-0" />
                <span className="text-gray-300">|</span>
                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-transparent border-none text-xs font-bold dark:text-white focus:ring-0" />
             </div>

             <button 
                onClick={onToggleMeetingMode}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${isMeetingMode ? 'bg-marsala-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 shadow-soft hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
             >
                <Tv size={18} />
                <span className="hidden sm:inline">{isMeetingMode ? 'Sair do Modo Reunião' : 'Modo Reunião'}</span>
             </button>

             <button 
                onClick={() => PDFService.generateDashboardPDF(filteredData)}
                className="flex items-center gap-2 px-5 py-3 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-black transition-all"
             >
                <Download size={18} />
                <span className="hidden sm:inline">Exportar PDF</span>
             </button>
          </div>
        </div>

        {/* Intelligence Layer */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* LogiCheck Score */}
          <Card className="xl:col-span-4 flex flex-col justify-center items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <BarChart3 size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Índice LogiCheck</p>
              <div className="relative inline-flex items-center justify-center mb-6">
                 <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100 dark:text-gray-700" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * score.score) / 100} className={score.color} strokeLinecap="round" />
                 </svg>
                 <span className="absolute text-3xl font-black dark:text-white">{score.score}</span>
              </div>
              <h4 className={`text-xl font-bold ${score.color} mb-1`}>{score.label}</h4>
              <p className="text-sm text-gray-500 max-w-[200px]">Baseado na distribuição de conferência e volumetria.</p>
            </div>
          </Card>

          {/* Insights Cards */}
          <div className="xl:col-span-8 flex flex-col gap-4">
             <div className="flex items-center gap-2 mb-2">
                <Zap size={18} className="text-marsala-500" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Insights Inteligentes</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                {insights.map((insight, idx) => (
                  <Card key={idx} className="flex-1 border-l-4 border-l-marsala-500/50">
                    <h5 className="text-xs font-black text-marsala-600 dark:text-marsala-400 uppercase mb-2">{insight.title}</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-snug">{insight.description}</p>
                    <button 
                      onClick={() => insight.drillDown && setDrillDownType(insight.drillDown)}
                      className="mt-4 flex items-center text-marsala-500 font-bold text-xs gap-1 group cursor-pointer bg-transparent border-none p-0 outline-none"
                    >
                       Ver detalhe <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Card>
                ))}
             </div>
          </div>
        </div>

        {/* Main KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Romaneios" value={kpis.count} icon={<ClipboardList />} 
            trend={{ value: comparison.diff, direction: comparison.trend as any }}
            onClick={() => setDrillDownType('ROMANEIOS')}
          />
          <KPICard title="Volume NFs" value={kpis.totalNfs.toLocaleString()} icon={<Package />} onClick={() => setDrillDownType('NFS')} />
          <KPICard title="Motoristas" value={kpis.uniqueDrivers} icon={<Users />} onClick={() => setDrillDownType('MOTORISTAS')} />
          <KPICard title="Filiais" value={kpis.uniqueFiliais} icon={<MapPin />} onClick={() => setDrillDownType('FILIAIS')} />
        </div>

        {/* Charts Row - Main Evolution */}
        <div className="grid grid-cols-1 gap-8">
          <Card title="Evolução de Volumetria" subtitle="Total de NFs processadas nos últimos dias">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#955251" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#955251" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#999'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#999'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#955251" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" isAnimationActive={true} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Charts Row - Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Ranking Top Motoristas */}
          <Card title="Top Motoristas" subtitle="Líderes de volumetria no período">
            <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topDrivers} margin={{ left: -20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#666'}} width={100} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                      cursor={{fill: 'rgba(0,0,0,0.02)'}}
                    />
                    <Bar dataKey="value" fill="#1F2937" radius={[0, 8, 8, 0]} barSize={24} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </Card>

          {/* Ranking Top Conferentes */}
          <Card title="Ranking de Conferentes" subtitle="Performance da equipe por volume de NFs">
            <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topInspectors} margin={{ left: -20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#666'}} width={100} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{fill: 'rgba(0,0,0,0.02)'}}
                    />
                    <Bar dataKey="value" fill="#955251" radius={[0, 8, 8, 0]} barSize={24} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </Card>
        </div>

      </div>

      <DrillDownModal 
        isOpen={!!drillDownType}
        type={drillDownType}
        data={filteredData}
        onClose={() => setDrillDownType(null)}
      />
    </>
  );
};

export default DashboardTab;