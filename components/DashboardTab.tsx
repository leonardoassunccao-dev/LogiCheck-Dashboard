import React, { useMemo, useState } from 'react';
import { ETrackRecord, DrillDownType, OperationalManifest } from '../types';
import { Card, KPICard } from './ui/Card';
import { 
  LayoutDashboard, Users, MapPin, Package, Download, 
  Zap, ChevronRight, BarChart3, Tv, ClipboardList, Calendar,
  Siren, AlertTriangle, Info, CheckCircle2, Activity
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
  manifests: OperationalManifest[];
  isMeetingMode: boolean;
  onToggleMeetingMode: () => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ data, manifests, isMeetingMode, onToggleMeetingMode }) => {
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

  // Calculations
  // Pass both filteredData AND manifests to the new Score Calculation
  const score = useMemo(() => AnalysisService.calculateScore(filteredData, manifests), [filteredData, manifests]);
  const insights = useMemo(() => AnalysisService.getInsights(filteredData), [filteredData]);
  const comparison = useMemo(() => AnalysisService.getComparison(filteredData), [filteredData]);
  const radarAlert = useMemo(() => AnalysisService.getRadarAlert(manifests), [manifests]);

  // General Status Calculation
  const generalStatus = useMemo(() => 
    AnalysisService.getGeneralStatus(score.score, radarAlert.severityLevel), 
  [score, radarAlert]);

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

  // Helper to get Icon for Radar Alert
  const getRadarIcon = (severity: number) => {
      if (severity === 3) return <Siren size={32} />;
      if (severity === 2) return <AlertTriangle size={32} />;
      if (severity === 1) return <Info size={32} />;
      return <CheckCircle2 size={32} />;
  };

  if (data.length === 0 && manifests.length === 0) {
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
        
        {/* Status Strip */}
        <div className={`w-full py-2.5 px-6 ${generalStatus.color} ${generalStatus.textColor} rounded-xl shadow-md flex justify-between items-center transition-all duration-300`}>
             <div className="flex items-center gap-2">
                 <Activity size={18} className="animate-pulse" />
                 <span className="text-xs font-black uppercase tracking-widest opacity-90">Status Geral</span>
             </div>
             <div className="flex items-center gap-2">
                 <span className="text-sm font-bold">{generalStatus.status}</span>
                 <span className="text-xs opacity-80 hidden sm:inline border-l border-white/30 pl-2">{generalStatus.description}</span>
             </div>
        </div>

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

        {/* Intelligence Layer & Status */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* 1. LogiCheck Score (Expanded to 3 cols) */}
          <Card className="xl:col-span-3 flex flex-col justify-center items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <BarChart3 size={100} />
            </div>
            <div className="relative z-10 py-2">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Índice LogiCheck</p>
              <p className="text-[10px] font-bold text-marsala-600 dark:text-marsala-400 uppercase tracking-wider mb-4">Saúde Operacional</p>
              
              <div className="relative inline-flex items-center justify-center mb-4">
                 <svg className="w-28 h-28 transform -rotate-90">
                    <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100 dark:text-gray-700" />
                    <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={314} strokeDashoffset={314 - (314 * score.score) / 100} className={score.color} strokeLinecap="round" />
                 </svg>
                 <span className="absolute text-2xl font-black dark:text-white">{score.score}</span>
              </div>
              <h4 className={`text-lg font-bold ${score.color} mb-2 leading-none`}>{score.label}</h4>
              <p className="text-[10px] text-gray-400 px-4 leading-tight">Avalia equilíbrio de conferência, volumetria e pendências.</p>
            </div>
          </Card>

          {/* 2. SMART ALERT CARD (Radar Operacional) (3 cols) */}
          <div 
             onClick={() => window.location.hash = '#romaneios'}
             className={`xl:col-span-3 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700/50 p-6 flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group ${radarAlert.styleClass}`}
          >
             <div className="flex justify-between items-start z-10">
                 <div>
                    <h3 className="text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-wide">Radar Operacional</h3>
                    <p className={`text-xs font-bold mt-1 ${radarAlert.iconColor}`}>{radarAlert.statusText}</p>
                 </div>
                 <div className={`${radarAlert.iconColor}`}>
                    {getRadarIcon(radarAlert.severityLevel)}
                 </div>
             </div>
             
             <div className="mt-6 z-10">
                <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
                   {radarAlert.count}
                   <span className="text-sm text-gray-400 font-medium ml-2">pendentes</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium bg-white/50 dark:bg-black/20 inline-block px-2 py-1 rounded-md">
                   Mais antiga: <strong>{radarAlert.oldest} dias</strong>
                </div>
             </div>

             <ChevronRight size={16} className="absolute bottom-6 right-6 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* 3. Insights Cards (6 cols) */}
          <div className="xl:col-span-6 flex flex-col gap-4">
             <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-marsala-500" />
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Insights Inteligentes</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                {insights.map((insight, idx) => (
                  <Card key={idx} className="flex-1 border-l-4 border-l-marsala-500/50 flex flex-col justify-between">
                    <div>
                        <h5 className="text-[10px] font-black text-marsala-600 dark:text-marsala-400 uppercase mb-2">{insight.title}</h5>
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-snug">{insight.description}</p>
                    </div>
                    {insight.drillDown && (
                        <div className="mt-3 text-right">
                           <span 
                              onClick={() => setDrillDownType(insight.drillDown as DrillDownType)}
                              className="text-[10px] text-marsala-500 font-bold hover:underline cursor-pointer"
                           >
                              Ver detalhe →
                           </span>
                        </div>
                    )}
                  </Card>
                ))}
             </div>
          </div>
        </div>

        {/* Main KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Romaneios (Base)" value={kpis.count} icon={<ClipboardList />} 
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