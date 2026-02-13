import React, { useMemo, useState } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Search, 
  Filter,
  Download,
  ArrowRight,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { OperationalManifest, TransferCycle, TransferPendencyType } from '../types';
import { Card, KPICard } from './ui/Card';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { PDFService } from '../services/pdfService';
import { AnalysisService } from '../services/analysisService';

interface RomaneiosTabProps {
  manifests: OperationalManifest[];
}

const COLORS = ['#955251', '#EAB308', '#F97316', '#DC2626'];

const RomaneiosTab: React.FC<RomaneiosTabProps> = ({ manifests }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendencyFilter, setPendencyFilter] = useState<'ALL' | TransferPendencyType>('ALL');

  // --- Cycles Analysis ---
  const cycles = useMemo(() => AnalysisService.getTransferCycles(manifests), [manifests]);

  const kpis = useMemo(() => {
    const total = cycles.length;
    const pending = cycles.filter(c => c.statusGeral !== 'CONCLUIDA');
    const critical = cycles.filter(c => c.statusGeral === 'PEND_DIVERGENCIA');
    const oldestDays = pending.length > 0 ? Math.max(...pending.map(c => Math.floor(c.agingHours / 24))) : 0;

    return { total, pending: pending.length, critical: critical.length, oldestDays };
  }, [cycles]);

  const chartsData = useMemo(() => {
    const active = cycles.filter(c => c.statusGeral !== 'CONCLUIDA');
    
    // 1. Pending by Filial Origem (Differentiated by Type)
    const filialMap: Record<string, { total: number, origem: number, destino: number, divergencia: number }> = {};
    active.forEach(c => {
      const f = c.filialOrigem || 'N/A';
      if (!filialMap[f]) filialMap[f] = { total: 0, origem: 0, destino: 0, divergencia: 0 };
      
      filialMap[f].total++;
      if (c.statusGeral === 'PEND_ORIGEM') filialMap[f].origem++;
      if (c.statusGeral === 'PEND_DESTINO') filialMap[f].destino++;
      if (c.statusGeral === 'PEND_DIVERGENCIA') filialMap[f].divergencia++;
    });

    const byFilial = Object.entries(filialMap)
      .map(([name, stats]) => ({ 
        name, 
        value: stats.total,
        origem: stats.origem,
        destino: stats.destino,
        divergencia: stats.divergencia 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 2. Aging Buckets (Using hours to be more precise)
    const agingMap = {
      '0-12h': 0,
      '12-24h': 0,
      '24-48h': 0,
      '48h+': 0
    };

    active.forEach(c => {
      if (c.agingHours < 12) agingMap['0-12h']++;
      else if (c.agingHours < 24) agingMap['12-24h']++;
      else if (c.agingHours < 48) agingMap['24-48h']++;
      else agingMap['48h+']++;
    });

    const agingData = Object.entries(agingMap).map(([name, value]) => ({ name, value }));

    return { byFilial, agingData };
  }, [cycles]);

  // --- Table Filtering ---
  const filteredList = useMemo(() => {
    return cycles.filter(c => {
      if (pendencyFilter !== 'ALL' && c.statusGeral !== pendencyFilter) return false;

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          c.id.toLowerCase().includes(s) ||
          c.motorista.toLowerCase().includes(s) ||
          c.filialOrigem.toLowerCase().includes(s) ||
          c.filialDestino.toLowerCase().includes(s)
        );
      }
      return true;
    }).sort((a, b) => {
      // Prioridade: DIVERGENCIA > DESTINO > ORIGEM > Aging
      const priority = { 'PEND_DIVERGENCIA': 3, 'PEND_DESTINO': 2, 'PEND_ORIGEM': 1, 'CONCLUIDA': 0 };
      if (priority[a.statusGeral] !== priority[b.statusGeral]) {
         return priority[b.statusGeral] - priority[a.statusGeral];
      }
      return b.agingHours - a.agingHours;
    });
  }, [cycles, searchTerm, pendencyFilter]);

  const getStatusBadge = (status: TransferPendencyType) => {
    switch(status) {
      case 'PEND_DIVERGENCIA':
        return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 border border-red-200"><AlertTriangle size={10} /> Divergência</span>;
      case 'PEND_DESTINO':
        return <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 border border-orange-200">Aguard. Descarga</span>;
      case 'PEND_ORIGEM':
        return <span className="bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 border border-yellow-200">Aguard. Origem</span>;
      case 'CONCLUIDA':
        return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 border border-green-200">Concluída</span>;
    }
  };

  const getStepStatus = (manifest?: OperationalManifest) => {
    if (!manifest) return <div className="w-3 h-3 rounded-full bg-gray-200" title="Não iniciado" />;
    if (manifest.status === 'CONFERIDO') return <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-200" title="Conferido" />;
    if (manifest.status === 'DIVERGENTE') return <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" title="Divergente" />;
    return <div className="w-3 h-3 rounded-full bg-yellow-400" title="Pendente" />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-3 shadow-xl rounded-xl border border-gray-100 dark:border-gray-700">
           <p className="text-xs font-black text-gray-800 dark:text-white mb-2 uppercase tracking-widest">{data.name}</p>
           <div className="space-y-1">
              <p className="text-[10px] text-red-600 font-bold">Divergências: {data.divergencia}</p>
              <p className="text-[10px] text-orange-600 font-bold">Aguard. Descarga: {data.destino}</p>
              <p className="text-[10px] text-yellow-600 font-bold">Aguard. Origem: {data.origem}</p>
              <div className="pt-1 mt-1 border-t border-gray-50 dark:border-gray-700">
                 <p className="text-xs font-black">Total Ciclos: {data.value}</p>
              </div>
           </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
             <FileSpreadsheet className="text-marsala-600" />
             Radar Operacional (Ciclos)
           </h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
             Monitoramento de <strong>transferências entre filiais</strong> e ciclos completos.
           </p>
        </div>
        <button 
          onClick={() => PDFService.generateRomaneiosPDF(manifests)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Relatório PDF</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Ciclos" value={kpis.total} icon={<FileSpreadsheet />} subtext="Transferências" />
        <KPICard title="Em Aberto" value={kpis.pending} icon={<Clock />} subtext="Aguardando fechamento" />
        <KPICard title="Divergentes" value={kpis.critical} icon={<AlertOctagon />} subtext="Ação urgente" trend={{ value: 0, direction: kpis.critical > 0 ? 'down' : 'stable' }} />
        <KPICard title="Aging Máximo" value={`${kpis.oldestDays} dias`} icon={<Clock />} subtext="Tempo de abertura" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8" title="Pendências por Origem" subtitle="Volume de ciclos abertos por filial carregadora">
           <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartsData.byFilial} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fontWeight: 700}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                    <Bar dataKey="value" fill="#955251" radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </Card>

        <Card className="lg:col-span-4" title="Aging Operacional" subtitle="Tempo de ciclo ativo">
           <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                       data={chartsData.agingData}
                       cx="50%"
                       cy="50%"
                       innerRadius={50}
                       outerRadius={70}
                       paddingAngle={5}
                       dataKey="value"
                    >
                       {chartsData.agingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" layout="horizontal" wrapperStyle={{fontSize: '10px', fontWeight: 700}} />
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </Card>
      </div>

      {/* Table Section */}
      <div className="space-y-4">
         <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
               <input 
                  type="text" 
                  placeholder="Busca: Romaneio, Motorista, Filial..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white py-2 text-sm"
               />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
               <Filter size={16} className="text-gray-400" />
               {(['ALL', 'PEND_DIVERGENCIA', 'PEND_DESTINO', 'PEND_ORIGEM', 'CONCLUIDA'] as const).map(f => (
                  <button 
                    key={f}
                    onClick={() => setPendencyFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${pendencyFilter === f ? 'bg-marsala-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'}`}
                  >
                    {f === 'ALL' ? 'Todos' : f.replace('PEND_', '').replace('_', ' ')}
                  </button>
               ))}
            </div>
         </div>

         <Card title={`Listagem Detalhada de Ciclos (${filteredList.length})`} noPadding>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] uppercase text-gray-400 font-black">
                     <tr>
                        <th className="p-4">Classificação</th>
                        <th className="p-4">Ciclo / Romaneio</th>
                        <th className="p-4">Fluxo (Origem ➜ Destino)</th>
                        <th className="p-4 text-center">Carga | Desc.</th>
                        <th className="p-4">Aging</th>
                        <th className="p-4 text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                     {filteredList.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-gray-400">Nenhum ciclo encontrado para os filtros selecionados.</td></tr>
                     ) : (
                        filteredList.map(cycle => (
                           <tr key={`${cycle.filialOrigem}_${cycle.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                              <td className="p-4">
                                 {getStatusBadge(cycle.statusGeral)}
                              </td>
                              <td className="p-4">
                                 <div className="font-black text-gray-900 dark:text-white font-mono">{cycle.id}</div>
                                 <div className="text-[10px] text-gray-400 font-bold">{cycle.motorista}</div>
                              </td>
                              <td className="p-4">
                                 <div className="flex items-center gap-2">
                                     <span className="font-bold text-xs text-marsala-600">{cycle.filialOrigem}</span>
                                     <ArrowRight size={12} className="text-gray-300" />
                                     <span className="font-bold text-xs text-gray-500">{cycle.filialDestino}</span>
                                 </div>
                              </td>
                              <td className="p-4">
                                 <div className="flex items-center justify-center gap-3">
                                    {getStepStatus(cycle.carregamento)}
                                    <div className="w-4 h-[1px] bg-gray-200" />
                                    {getStepStatus(cycle.descarga)}
                                 </div>
                              </td>
                              <td className="p-4">
                                 <div className="flex flex-col">
                                    <span className={`text-xs font-black ${cycle.agingHours > 48 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                       {cycle.agingHours}h 
                                       <span className="text-[10px] font-medium text-gray-400 ml-1">({Math.floor(cycle.agingHours / 24)}d)</span>
                                    </span>
                                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">Aberto em {new Date(cycle.dataCriacao).toLocaleDateString('pt-BR')}</span>
                                 </div>
                              </td>
                              <td className="p-4 text-right">
                                 <button className="p-2 text-gray-300 hover:text-marsala-600 transition-colors">
                                    <ChevronRight size={18} />
                                 </button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </Card>
      </div>
    </div>
  );
};

export default RomaneiosTab;