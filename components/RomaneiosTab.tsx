import React, { useMemo, useState } from 'react';
import { 
  FileSpreadsheet, 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter,
  Download,
  ArrowRight,
  Activity,
  CheckCircle2,
  MapPin,
  TrendingDown
} from 'lucide-react';
import { OperationalManifest, RadarTransferencia, TransferPendencyType } from '../types';
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

  // 1. BASE ÚNICA RADARDATA
  const allRadarData = useMemo(() => AnalysisService.getRadarData(manifests), [manifests]);

  // 2. FILTRAGEM
  const filteredRadar = useMemo(() => {
    return allRadarData.filter(c => {
      const cycleDate = new Date(c.created_at).toISOString().split('T')[0];
      if (dateStart && cycleDate < dateStart) return false;
      if (dateEnd && cycleDate > dateEnd) return false;
      if (selectedFilial !== 'ALL' && c.origem_filial !== selectedFilial) return false;
      if (pendencyFilter !== 'ALL' && c.tipo_pendencia !== pendencyFilter) return false;
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return c.id_transferencia.toLowerCase().includes(s) || 
               c.motorista.toLowerCase().includes(s) || 
               c.origem_filial.toLowerCase().includes(s);
      }
      return true;
    });
  }, [allRadarData, dateStart, dateEnd, selectedFilial, pendencyFilter, searchTerm]);

  // 3. ESTATÍSTICAS
  const statsFiliais = useMemo(() => AnalysisService.getFilialStats(filteredRadar), [filteredRadar]);
  const opStatus = useMemo(() => AnalysisService.getGeneralOperationalStatus(filteredRadar), [filteredRadar]);

  const kpis = useMemo(() => {
    const total = filteredRadar.length;
    const pendentesList = filteredRadar.filter(c => c.pendente);
    const pendentes = pendentesList.length;
    const concluidas = total - pendentes;
    
    const pOrigem = pendentesList.filter(p => p.tipo_pendencia === 'ORIGEM').length;
    const pDestino = pendentesList.filter(p => p.tipo_pendencia === 'DESTINO').length;
    const pDivergencia = pendentesList.filter(p => p.tipo_pendencia === 'DIVERGENCIA').length;

    const avgAging = pendentes > 0 ? Math.round(pendentesList.reduce((a, b) => a + b.aging_horas, 0) / pendentes) : 0;
    const maxAging = pendentes > 0 ? Math.max(...pendentesList.map(p => p.aging_horas)) : 0;

    return { total, concluidas, pendentes, pOrigem, pDestino, pDivergencia, avgAging, maxAging };
  }, [filteredRadar]);

  const filiaisList = useMemo(() => Array.from(new Set(allRadarData.map(c => c.origem_filial))).sort(), [allRadarData]);

  const getStatusBadge = (tipo: TransferPendencyType) => {
    const styles = {
      'DIVERGENCIA': 'bg-red-100 text-red-700 border-red-200',
      'DESTINO': 'bg-orange-100 text-orange-700 border-orange-200',
      'ORIGEM': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'OK': 'bg-green-100 text-green-700 border-green-200'
    };
    const labels = { 'DIVERGENCIA': 'Divergência', 'DESTINO': 'Pend. Destino', 'ORIGEM': 'Pend. Origem', 'OK': 'Concluído' };
    return <span className={`${styles[tipo]} px-2 py-0.5 rounded text-[10px] font-black uppercase border`}>{labels[tipo]}</span>;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* Barra de Status */}
      <div className={`w-full py-4 px-8 rounded-3xl shadow-xl ${opStatus.color} text-white flex justify-between items-center transition-all`}>
        <div className="flex items-center gap-4">
          <Activity size={32} className="animate-pulse opacity-80" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Painel Radar Operacional</p>
            <p className="text-2xl font-black tracking-tighter">{opStatus.label}</p>
          </div>
        </div>
        <p className="text-sm font-bold opacity-90 hidden md:block">{opStatus.desc}</p>
      </div>

      {/* Filtros */}
      <Card className="p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter flex items-center gap-2">
            <Filter size={24} className="text-marsala-600" />
            Configurações de Filtro
          </h2>
          <button 
            onClick={() => PDFService.generateRadarFullPDF(filteredRadar, statsFiliais, dateStart, dateEnd)}
            className="flex items-center gap-2 px-8 py-4 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl font-bold shadow-2xl hover:bg-black transition-all"
          >
            <Download size={20} /> Exportar Relatório PDF
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Data de Início/Fim</label>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-transparent border-none text-xs font-bold w-full dark:text-white" />
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-transparent border-none text-xs font-bold w-full dark:text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Filial de Origem</label>
            <select value={selectedFilial} onChange={e => setSelectedFilial(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold dark:text-white">
              <option value="ALL">Todas as Filiais</option>
              {filiaisList.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Status Pendência</label>
            <select value={pendencyFilter} onChange={e => setPendencyFilter(e.target.value as any)} className="w-full bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold dark:text-white">
              <option value="ALL">Todas as Situações</option>
              <option value="DIVERGENCIA">Divergências</option>
              <option value="ORIGEM">Pend. na Origem</option>
              <option value="DESTINO">Pend. no Destino</option>
              <option value="OK">Concluídas</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Pesquisar</label>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-3.5 text-gray-400" />
              <input type="text" placeholder="Romaneio ou Motorista..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 w-full bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold dark:text-white" />
            </div>
          </div>
        </div>
      </Card>

      {/* Resumo em Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard title="Total Transfer." value={kpis.total} icon={<FileSpreadsheet />} />
        <KPICard title="Concluídas" value={kpis.concluidas} icon={<CheckCircle2 />} />
        <KPICard title="Pendentes" value={kpis.pendentes} icon={<Clock />} />
        <KPICard title="Pend. Origem" value={kpis.pOrigem} icon={<TrendingDown />} />
        <KPICard title="Pend. Destino" value={kpis.pDestino} icon={<TrendingDown className="rotate-180" />} />
        <KPICard title="Divergências" value={kpis.pDivergencia} icon={<AlertTriangle />} />
        <KPICard title="Aging Médio" value={`${kpis.avgAging}h`} icon={<Clock />} />
        <KPICard title="Maior Aging" value={`${kpis.maxAging}h`} icon={<Clock />} />
      </div>

      {/* Tabela de Filiais */}
      <Card title="Pendentes por Origem (Filial)" subtitle="Consolidado de pendências por unidade carregadora">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900 text-[10px] font-black uppercase text-gray-400">
              <tr>
                <th className="p-4">Filial Origem</th>
                <th className="p-4 text-center">Pend. Total</th>
                <th className="p-4 text-center">Origem</th>
                <th className="p-4 text-center">Destino</th>
                <th className="p-4 text-center">Diverg.</th>
                <th className="p-4 text-center">Aging Médio</th>
                <th className="p-4 text-right">Maior Aging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs font-bold">
              {statsFiliais.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Nenhuma pendência encontrada.</td></tr>
              ) : (
                statsFiliais.map(s => (
                  <tr key={s.filial} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 text-gray-900 dark:text-white flex items-center gap-2">
                      <MapPin size={12} className="text-marsala-400" />
                      {s.filial}
                    </td>
                    <td className="p-4 text-center text-red-600">{s.total_pendentes}</td>
                    <td className="p-4 text-center">{s.origem_count}</td>
                    <td className="p-4 text-center">{s.destino_count}</td>
                    <td className="p-4 text-center text-red-600">{s.divergencia_count}</td>
                    <td className="p-4 text-center">{s.aging_medio}h</td>
                    <td className="p-4 text-right">{s.maior_aging}h</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Lista Detalhada */}
      <Card title="Detalhamento de Transferências Pendentes" subtitle="Listagem analítica filtrada e ordenada">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400">
              <tr>
                <th className="p-4">ID Romaneio</th>
                <th className="p-4">Origem ➜ Destino</th>
                <th className="p-4 text-center">Carga</th>
                <th className="p-4 text-center">Descarga</th>
                <th className="p-4">Situação</th>
                <th className="p-4 text-right">Tempo Aberto (Horas)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
              {filteredRadar.filter(c => c.pendente).sort((a,b) => {
                // ORDENAÇÃO: 1) DIVERGENCIA, 2) AGING DESC, 3) DESTINO, 4) ORIGEM
                if (a.tipo_pendencia === 'DIVERGENCIA' && b.tipo_pendencia !== 'DIVERGENCIA') return -1;
                if (b.tipo_pendencia === 'DIVERGENCIA' && a.tipo_pendencia !== 'DIVERGENCIA') return 1;
                if (a.aging_horas !== b.aging_horas) return b.aging_horas - a.aging_horas;
                if (a.tipo_pendencia === 'DESTINO' && b.tipo_pendencia !== 'DESTINO') return -1;
                if (b.tipo_pendencia === 'DESTINO' && a.tipo_pendencia !== 'DESTINO') return 1;
                return 0;
              }).map(c => (
                <tr key={`${c.origem_filial}_${c.id_transferencia}`} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all ${c.tipo_pendencia === 'DIVERGENCIA' ? 'bg-red-50/20' : ''}`}>
                  <td className="p-4 font-mono font-black text-gray-900 dark:text-white">{c.id_transferencia}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-marsala-600">{c.origem_filial}</span>
                      <ArrowRight size={10} className="text-gray-300" />
                      <span className="font-bold text-gray-400">{c.destino_filial}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${c.carga_status === 'CONFERIDO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.carga_status}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${c.descarga_status === 'CONFERIDO' ? 'bg-green-100 text-green-700' : c.descarga_status === 'AUSENTE' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>{c.descarga_status}</span>
                  </td>
                  <td className="p-4">{getStatusBadge(c.tipo_pendencia)}</td>
                  <td className="p-4 text-right font-black text-gray-900 dark:text-white">{c.aging_horas}h</td>
                </tr>
              ))}
              {filteredRadar.filter(c => c.pendente).length === 0 && (
                <tr><td colSpan={6} className="p-16 text-center text-gray-400 italic">Parabéns! Nenhuma transferência pendente no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default RomaneiosTab;
