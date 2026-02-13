import React, { useMemo, useState } from 'react';
import { 
  FileSpreadsheet, 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter,
  Download,
  ArrowRight,
  TrendingDown,
  Activity,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { OperationalManifest, TransferCycle, TransferPendencyType } from '../types';
import { Card, KPICard } from './ui/Card';
import { PDFService } from '../services/pdfService';
import { AnalysisService } from '../services/analysisService';

interface RomaneiosTabProps {
  manifests: OperationalManifest[];
}

const RomaneiosTab: React.FC<RomaneiosTabProps> = ({ manifests }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendencyFilter, setPendencyFilter] = useState<'ALL' | TransferPendencyType>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedFilial, setSelectedFilial] = useState('ALL');

  // --- Lógica Principal de Ciclos ---
  const allCycles = useMemo(() => AnalysisService.getTransferCycles(manifests), [manifests]);

  const filteredCycles = useMemo(() => {
    return allCycles.filter(c => {
      const cycleDate = new Date(c.dataCriacao).toISOString().split('T')[0];
      if (dateStart && cycleDate < dateStart) return false;
      if (dateEnd && cycleDate > dateEnd) return false;
      if (selectedFilial !== 'ALL' && c.filialOrigem !== selectedFilial) return false;
      if (pendencyFilter !== 'ALL' && c.statusGeral !== pendencyFilter) return false;
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return c.id.toLowerCase().includes(s) || c.motorista.toLowerCase().includes(s);
      }
      return true;
    });
  }, [allCycles, dateStart, dateEnd, selectedFilial, pendencyFilter, searchTerm]);

  const statsFiliais = useMemo(() => AnalysisService.getFilialStats(filteredCycles), [filteredCycles]);
  const generalOpStatus = useMemo(() => AnalysisService.getGeneralOperationalStatus(filteredCycles), [filteredCycles]);

  const kpis = useMemo(() => {
    const total = filteredCycles.length;
    const pending = filteredCycles.filter(c => c.statusGeral !== 'OK');
    const concluidas = total - pending.length;
    const rate = total > 0 ? (concluidas / total) * 100 : 100;
    const avgAging = pending.length > 0 ? pending.reduce((a, b) => a + b.agingHours, 0) / pending.length : 0;
    const maxAging = pending.length > 0 ? Math.max(...pending.map(p => p.agingHours)) : 0;
    
    return {
      total,
      pendingCount: pending.length,
      concluidasRate: rate.toFixed(1),
      avgAging: Math.round(avgAging),
      maxAgingHours: maxAging,
      maxAgingDays: Math.floor(maxAging / 24),
      pOrigem: pending.filter(p => p.statusGeral === 'PEND_ORIGEM').length,
      pDestino: pending.filter(p => p.statusGeral === 'PEND_DESTINO').length,
      pDivergencia: pending.filter(p => p.statusGeral === 'PEND_DIVERGENCIA').length,
    };
  }, [filteredCycles]);

  const filiaisList = useMemo(() => Array.from(new Set(allCycles.map(c => c.filialOrigem))).sort(), [allCycles]);

  const getStatusBadge = (status: TransferPendencyType) => {
    const styles = {
      'PEND_DIVERGENCIA': 'bg-red-100 text-red-700 border-red-200',
      'PEND_DESTINO': 'bg-orange-100 text-orange-700 border-orange-200',
      'PEND_ORIGEM': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'OK': 'bg-green-100 text-green-700 border-green-200'
    };
    const labels = { 'PEND_DIVERGENCIA': 'Divergência', 'PEND_DESTINO': 'Aguard. Descarga', 'PEND_ORIGEM': 'Aguard. Origem', 'OK': 'Concluída' };
    return <span className={`${styles[status]} px-2 py-0.5 rounded text-[10px] font-black uppercase border`}>{labels[status]}</span>;
  };

  const getPriorityBadge = (p: string) => {
    if (p === 'ALTA') return <span className="text-red-600 font-black tracking-tighter flex items-center gap-1"><AlertCircle size={10}/> ALTA</span>;
    if (p === 'MEDIA') return <span className="text-orange-500 font-bold tracking-tighter">MÉDIA</span>;
    return <span className="text-gray-400 font-medium tracking-tighter">BAIXA</span>;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* Barra de Status Operacional Geral */}
      <div className={`w-full py-4 px-8 rounded-3xl shadow-xl ${generalOpStatus.color} text-white flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300`}>
        <div className="flex items-center gap-4">
          <Activity size={32} className="opacity-80 animate-pulse" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Rede de Transferência</p>
            <p className="text-2xl font-black tracking-tighter">{generalOpStatus.label}</p>
          </div>
        </div>
        <div className="text-center md:text-right">
           <p className="text-sm font-bold opacity-90 max-w-md">{generalOpStatus.desc}</p>
        </div>
      </div>

      {/* Header & Filtros */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-soft border border-gray-100 dark:border-gray-700 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-marsala-50 dark:bg-marsala-900/20 text-marsala-600 rounded-2xl">
                <Filter size={24} />
             </div>
             <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">Painel de Controle</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Filtros Operacionais</p>
             </div>
          </div>
          <button 
            onClick={() => PDFService.generateRadarFullPDF(filteredCycles, statsFiliais, dateStart, dateEnd)}
            className="flex items-center gap-2 px-8 py-4 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl font-bold shadow-2xl hover:bg-black transition-all transform hover:scale-[1.02]"
          >
            <Download size={20} />
            Exportar Relatório PDF
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Período de Análise</label>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-transparent border-none text-xs font-bold focus:ring-0 dark:text-white w-full" />
              <span className="text-gray-300">➜</span>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-transparent border-none text-xs font-bold focus:ring-0 dark:text-white w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Filial de Origem</label>
            <select value={selectedFilial} onChange={e => setSelectedFilial(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold dark:text-white appearance-none">
              <option value="ALL">Todas as Filiais</option>
              {filiaisList.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Status da Pendência</label>
            <select value={pendencyFilter} onChange={e => setPendencyFilter(e.target.value as any)} className="w-full bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold dark:text-white appearance-none">
              <option value="ALL">Todos os Ciclos</option>
              <option value="PEND_DIVERGENCIA">Divergências</option>
              <option value="PEND_DESTINO">Aguardando Descarga</option>
              <option value="PEND_ORIGEM">Aguardando Origem</option>
              <option value="OK">Concluídos</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Filtro Nominal</label>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-3.5 text-gray-400" />
              <input type="text" placeholder="Romaneio ou Motorista..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 w-full bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold dark:text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs — Visão do Resumo Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <KPICard title="Transferências" value={kpis.total} icon={<FileSpreadsheet />} subtext="Total ciclos" />
        <KPICard title="% Concluídas" value={`${kpis.concluidasRate}%`} icon={<CheckCircle2 />} trend={{ value: 0, direction: 'stable' }} />
        <KPICard title="Total Pendentes" value={kpis.pendingCount} icon={<Clock />} subtext="Ciclos abertos" />
        <KPICard title="Pendências" value={kpis.pOrigem + kpis.pDestino} icon={<TrendingDown />} subtext="Origem + Destino" />
        <KPICard title="Divergências" value={kpis.pDivergencia} icon={<AlertTriangle />} subtext="Prioridade Máxima" />
        <KPICard title="Aging Médio" value={`${kpis.avgAging}h`} icon={<Clock />} subtext="Tempo médio" />
      </div>

      {/* Tabela "Por Filial (Origem)" */}
      <Card title="Análise de Saúde por Unidade (Origem)" subtitle="Monitoramento da eficiência de carregamento e divergências por filial">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900 text-[10px] font-black uppercase text-gray-400">
              <tr>
                <th className="p-4">Filial Origem</th>
                <th className="p-4 text-center">Transfer.</th>
                <th className="p-4 text-center">Concl.</th>
                <th className="p-4 text-center">Pend. Total</th>
                <th className="p-4 text-center">P. Origem</th>
                <th className="p-4 text-center">P. Destino</th>
                <th className="p-4 text-center">P. Diverg.</th>
                <th className="p-4 text-center">Saúde</th>
                <th className="p-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs font-bold">
              {statsFiliais.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-gray-400 italic">Sem dados para as filiais selecionadas.</td></tr>
              ) : (
                statsFiliais.map(s => (
                  <tr key={s.filial} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 text-gray-900 dark:text-white flex items-center gap-2">
                       <MapPin size={14} className="text-marsala-400" />
                       {s.filial}
                    </td>
                    <td className="p-4 text-center">{s.total}</td>
                    <td className="p-4 text-center text-green-600">{s.concluidas}</td>
                    <td className="p-4 text-center text-gray-500">{s.pendentes}</td>
                    <td className="p-4 text-center text-yellow-600">{s.pOrigem}</td>
                    <td className="p-4 text-center text-orange-600">{s.pDestino}</td>
                    <td className="p-4 text-center text-red-600">{s.pDivergencia}</td>
                    <td className="p-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className={`text-[10px] font-black ${s.saude > 80 ? 'text-green-600' : s.saude > 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                             {s.saude} pts
                          </span>
                          <div className="w-16 bg-gray-100 dark:bg-gray-700 h-1 rounded-full mt-1 overflow-hidden">
                             <div className={`h-full ${s.saude > 80 ? 'bg-green-500' : s.saude > 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${s.saude}%` }} />
                          </div>
                       </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black tracking-widest border ${s.status === 'ESTÁVEL' ? 'bg-green-50 text-green-700 border-green-100' : s.status === 'ATENÇÃO' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tabela "Transferências Críticas" */}
      <Card title="Listagem de Transferências Críticas" subtitle="Monitoramento individual de ciclos com prioridade alta ou divergência ativa">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400">
              <tr>
                <th className="p-4">Prioridade</th>
                <th className="p-4">ID / Romaneio</th>
                <th className="p-4">Fluxo (Origem ➜ Destino)</th>
                <th className="p-4">Tipo Pendência</th>
                <th className="p-4 text-center">Carga | Desc.</th>
                <th className="p-4 text-center">Aging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
              {filteredCycles.filter(c => c.statusGeral !== 'OK').sort((a,b) => {
                const p = { 'ALTA': 3, 'MEDIA': 2, 'BAIXA': 1 };
                // Ordenação: 1) PEND_DIVERGENCIA, 2) maior aging, 3) PEND_DESTINO, 4) PEND_ORIGEM
                if (a.statusGeral === 'PEND_DIVERGENCIA' && b.statusGeral !== 'PEND_DIVERGENCIA') return -1;
                if (b.statusGeral === 'PEND_DIVERGENCIA' && a.statusGeral !== 'PEND_DIVERGENCIA') return 1;
                return b.agingHours - a.agingHours;
              }).map(c => (
                <tr key={`${c.filialOrigem}_${c.id}`} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${c.priority === 'ALTA' ? 'bg-red-50/20' : ''}`}>
                  <td className="p-4">{getPriorityBadge(c.priority)}</td>
                  <td className="p-4 font-mono font-black text-gray-900 dark:text-white">{c.id}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-marsala-600">{c.filialOrigem}</span>
                      <ArrowRight size={10} className="text-gray-300" />
                      <span className="font-bold text-gray-400">{c.filialDestino}</span>
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(c.statusGeral)}</td>
                  <td className="p-4">
                     <div className="flex items-center justify-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                           <div className={`w-3 h-3 rounded-full ${c.carregamento?.status === 'CONFERIDO' ? 'bg-green-500' : c.carregamento?.status === 'DIVERGENTE' ? 'bg-red-600 animate-pulse' : 'bg-yellow-400'}`} />
                           <span className="text-[8px] text-gray-400 uppercase font-black tracking-tighter">Carga</span>
                        </div>
                        <div className="w-4 h-[1px] bg-gray-200 mt-[-10px]" />
                        <div className="flex flex-col items-center gap-1">
                           <div className={`w-3 h-3 rounded-full ${c.descarga?.status === 'CONFERIDO' ? 'bg-green-500' : c.descarga?.status === 'DIVERGENTE' ? 'bg-red-600 animate-pulse' : c.descarga ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                           <span className="text-[8px] text-gray-400 uppercase font-black tracking-tighter">Desc</span>
                        </div>
                     </div>
                  </td>
                  <td className="p-4 text-center font-bold">
                    <span className={c.agingHours > 48 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}>
                       {c.agingHours}h 
                       <span className="text-gray-400 text-[9px] font-medium ml-1">({Math.floor(c.agingHours/24)}d)</span>
                    </span>
                  </td>
                </tr>
              ))}
              {filteredCycles.filter(c => c.statusGeral !== 'OK').length === 0 && (
                <tr><td colSpan={6} className="p-16 text-center text-gray-400 italic">Parabéns! Nenhuma transferência crítica ou pendente encontrada para os filtros aplicados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Simple internal icon to avoid extra imports if missing
const MapPin = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

export default RomaneiosTab;