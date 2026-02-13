import React, { useMemo, useState } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Search, 
  Filter,
  Download
} from 'lucide-react';
import { OperationalManifest } from '../types';
import { Card, KPICard } from './ui/Card';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { PDFService } from '../services/pdfService';

interface RomaneiosTabProps {
  manifests: OperationalManifest[];
}

const COLORS = ['#955251', '#EAB308', '#F97316', '#DC2626'];

const RomaneiosTab: React.FC<RomaneiosTabProps> = ({ manifests }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDENTE' | 'CONFERIDO'>('PENDENTE');

  // --- Calculations ---

  const kpis = useMemo(() => {
    const total = manifests.length;
    const pending = manifests.filter(m => m.status === 'PENDENTE');
    const done = manifests.filter(m => m.status === 'CONFERIDO');
    
    // Oldest Pending Calculation (using pre-calculated diasEmAberto)
    let oldestDays = 0;
    if (pending.length > 0) {
      oldestDays = Math.max(...pending.map(p => p.diasEmAberto));
    }

    return { total, pending: pending.length, done: done.length, oldestDays };
  }, [manifests]);

  const chartsData = useMemo(() => {
    const pending = manifests.filter(m => m.status === 'PENDENTE');
    
    // 1. Pending by Filial Origem
    const filialMap: Record<string, number> = {};
    pending.forEach(m => {
      const filial = m.filialOrigem || 'N/A';
      filialMap[filial] = (filialMap[filial] || 0) + 1;
    });
    const byFilial = Object.entries(filialMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10

    // 2. Pending by Tipo
    const tipoMap: Record<string, number> = {};
    pending.forEach(m => {
       const tipo = m.tipo || 'N/A';
       tipoMap[tipo] = (tipoMap[tipo] || 0) + 1;
    });
    const byTipo = Object.entries(tipoMap)
       .map(([name, value]) => ({ name, value }))
       .sort((a, b) => b.value - a.value);

    // 3. Aging buckets (0-1, 2-3, 4-7, 8+)
    const agingMap = {
      '0-1 dias': 0,
      '2-3 dias': 0,
      '4-7 dias': 0,
      '8+ dias': 0
    };

    pending.forEach(m => {
      const days = m.diasEmAberto;
      if (days <= 1) agingMap['0-1 dias']++;
      else if (days <= 3) agingMap['2-3 dias']++;
      else if (days <= 7) agingMap['4-7 dias']++;
      else agingMap['8+ dias']++;
    });

    const agingData = Object.entries(agingMap).map(([name, value]) => ({ name, value }));

    return { byFilial, byTipo, agingData };
  }, [manifests]);

  // --- Table Filtering ---
  const filteredList = useMemo(() => {
    return manifests.filter(m => {
      // Status Filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      // Text Search
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        return (
          m.romaneio.toLowerCase().includes(lowerSearch) ||
          m.motorista.toLowerCase().includes(lowerSearch) ||
          m.filialOrigem.toLowerCase().includes(lowerSearch) ||
          m.filialDestino.toLowerCase().includes(lowerSearch) ||
          m.veiculo.toLowerCase().includes(lowerSearch) ||
          m.carga.toLowerCase().includes(lowerSearch)
        );
      }
      return true;
    }).sort((a, b) => {
      // Sort by status (Pending first), then Days Open Desc
      if (a.status !== b.status) return a.status === 'PENDENTE' ? -1 : 1;
      return b.diasEmAberto - a.diasEmAberto;
    });
  }, [manifests, searchTerm, statusFilter]);

  const formatWeight = (val: number) => {
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
  };

  const formatVolume = (val: number) => {
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' vol';
  };

  const handleDownloadPDF = () => {
    PDFService.generateRomaneiosPDF(manifests);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
             <FileSpreadsheet className="text-marsala-600" />
             Radar Operacional
           </h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
             Monitoramento de romaneios e pendências de conferência.
           </p>
           <p className="text-xs text-gray-400 mt-0.5">
             Identifique atrasos, cobre filiais e mantenha a disciplina operacional.
           </p>
        </div>
        <button 
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all hover:-translate-y-1"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Relatório PDF</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Romaneios" 
          value={kpis.total} 
          icon={<FileSpreadsheet />} 
          subtext="Base importada"
        />
        <KPICard 
          title="Pendentes" 
          value={kpis.pending} 
          icon={<Clock />} 
          subtext="Aguardando conf."
          trend={{ value: 0, direction: kpis.pending > 0 ? 'down' : 'stable' }}
        />
        <KPICard 
          title="Conferidos" 
          value={kpis.done} 
          icon={<CheckCircle2 />} 
          subtext="Finalizados"
        />
        <KPICard 
          title="Pendência + Antiga" 
          value={`${kpis.oldestDays} dias`} 
          icon={<AlertOctagon />} 
          subtext="Aging Máximo"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Pendentes por Origem" subtitle="Filiais com mais pendências">
           <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartsData.byFilial} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                    <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       cursor={{fill: 'rgba(0,0,0,0.02)'}}
                    />
                    <Bar dataKey="value" fill="#955251" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 10, fill: '#666' }} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </Card>

        <Card title="Pendentes por Tipo" subtitle="Classificação do romaneio">
           <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartsData.byTipo} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                    <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       cursor={{fill: 'rgba(0,0,0,0.02)'}}
                    />
                    <Bar dataKey="value" fill="#75363b" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 10, fill: '#666' }} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </Card>

        <Card title="Aging (Dias Aberto)" subtitle="Tempo desde a inclusão">
           <div className="h-60 w-full flex items-center justify-center">
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
                    <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{fontSize: '10px'}} />
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </Card>
      </div>

      {/* Table Section */}
      <div className="space-y-4">
         {/* Table Filters */}
         <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
               <input 
                  type="text" 
                  placeholder="Busca: Romaneio, Filial, Tipo, Motorista..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white py-2 focus:ring-marsala-500 focus:border-marsala-500 text-sm"
               />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto">
               <Filter size={18} className="text-gray-400" />
               <button 
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
               >
                  Todos
               </button>
               <button 
                  onClick={() => setStatusFilter('PENDENTE')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'PENDENTE' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
               >
                  Pendentes
               </button>
               <button 
                  onClick={() => setStatusFilter('CONFERIDO')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${statusFilter === 'CONFERIDO' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
               >
                  Conferidos
               </button>
            </div>
         </div>

         <Card title={`Listagem Detalhada (${filteredList.length})`} noPadding>
            <div className="overflow-x-auto max-h-[600px]">
               <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/90 backdrop-blur z-10 shadow-sm text-xs uppercase text-gray-500 dark:text-gray-400">
                     <tr>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium">Romaneio</th>
                        <th className="p-4 font-medium">Origem / Destino</th>
                        <th className="p-4 font-medium">Tipo / Carga</th>
                        <th className="p-4 font-medium">Motorista / Veículo</th>
                        <th className="p-4 font-medium">Totais</th>
                        <th className="p-4 font-medium text-center">Dias Aberto</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                     {filteredList.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                     ) : (
                        filteredList.map(row => (
                           <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="p-4">
                                 {row.status === 'PENDENTE' ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                       Pendente
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                       Conferido
                                    </span>
                                 )}
                              </td>
                              <td className="p-4">
                                 <div className="font-bold text-gray-900 dark:text-white font-mono">{row.romaneio}</div>
                                 <div className="text-[10px] text-gray-400">{new Date(row.dataIncRomaneio).toLocaleDateString('pt-BR')}</div>
                              </td>
                              <td className="p-4 text-gray-700 dark:text-gray-300">
                                 <div className="flex flex-col">
                                     <span className="font-semibold text-xs text-marsala-600 dark:text-marsala-400">{row.filialOrigem}</span>
                                     <span className="text-[10px] text-gray-400">➜ {row.filialDestino}</span>
                                 </div>
                              </td>
                              <td className="p-4">
                                 <div className="flex flex-col">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{row.tipo}</span>
                                    <span className="text-[10px] text-gray-500">{row.carga}</span>
                                 </div>
                              </td>
                              <td className="p-4">
                                 <div className="flex flex-col">
                                    <span className="font-medium text-gray-900 dark:text-white text-xs">{row.motorista}</span>
                                    <span className="text-[10px] text-gray-500">{row.veiculo}</span>
                                 </div>
                              </td>
                              <td className="p-4">
                                  <div className="flex flex-col gap-0.5 text-xs">
                                      <span>📦 <strong className="text-gray-700 dark:text-gray-300">{row.totalNfs}</strong> NFs</span>
                                      <span>📊 {formatVolume(row.totalVolume)}</span>
                                      <span>⚖️ {formatWeight(row.totalPeso)}</span>
                                  </div>
                              </td>
                              <td className="p-4 text-center">
                                 {row.status === 'PENDENTE' ? (
                                    <span className={`font-bold ${row.diasEmAberto > 3 ? 'text-red-600' : 'text-yellow-600'}`}>
                                       {row.diasEmAberto} dias
                                    </span>
                                 ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                 )}
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