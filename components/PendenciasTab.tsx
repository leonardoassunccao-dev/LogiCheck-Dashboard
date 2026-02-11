import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Download, 
  AlertTriangle, Truck, FileText, Box 
} from 'lucide-react';
import { DriverIssue, ETrackRecord } from '../types';
import { Card, KPICard } from './ui/Card';
import { StorageService } from '../services/storageService';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid 
} from 'recharts';
import { PDFService } from '../services/pdfService';

interface PendenciasTabProps {
  issues: DriverIssue[];
  setIssues: (issues: DriverIssue[]) => void;
  importedData: ETrackRecord[]; // For autocomplete suggestions
}

const PendenciasTab: React.FC<PendenciasTabProps> = ({ issues, setIssues, importedData }) => {
  // --- Form State ---
  const initialFormState = {
    motorista: '',
    placa: '',
    qtdNaoBipadas: '',
    filial: '',
    observacao: '',
    datetime: new Date().toISOString().slice(0, 16), // datetime-local format
  };
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Filter State ---
  const [filterPeriod, setFilterPeriod] = useState('30'); // days
  const [searchTerm, setSearchTerm] = useState('');

  // --- Unique Drivers for Autocomplete ---
  const uniqueDrivers = useMemo(() => {
    const fromIssues = issues.map(i => i.motorista);
    const fromImport = importedData.map(d => d.motorista);
    return Array.from(new Set([...fromIssues, ...fromImport])).sort();
  }, [issues, importedData]);

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.motorista || !formData.placa || !formData.qtdNaoBipadas) return;

    const newIssue: DriverIssue = {
      id: editingId || crypto.randomUUID(),
      timestamp: new Date(formData.datetime).toISOString(),
      motorista: formData.motorista,
      placa: formData.placa,
      qtdNaoBipadas: parseInt(formData.qtdNaoBipadas),
      filial: formData.filial,
      observacao: formData.observacao
    };

    let updatedIssues;
    if (editingId) {
      updatedIssues = issues.map(i => i.id === editingId ? newIssue : i);
      setEditingId(null);
    } else {
      updatedIssues = [newIssue, ...issues];
    }
    
    setIssues(updatedIssues);
    StorageService.setDriverIssues(updatedIssues);
    setFormData(initialFormState);
  };

  const handleEdit = (issue: DriverIssue) => {
    setFormData({
      motorista: issue.motorista,
      placa: issue.placa,
      qtdNaoBipadas: issue.qtdNaoBipadas.toString(),
      filial: issue.filial,
      observacao: issue.observacao || '',
      datetime: new Date(issue.timestamp).toISOString().slice(0, 16)
    });
    setEditingId(issue.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir esta ocorrência?')) {
      const updated = issues.filter(i => i.id !== id);
      setIssues(updated);
      StorageService.setDriverIssues(updated);
    }
  };

  // --- Filtering Logic ---
  const filteredIssues = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - parseInt(filterPeriod));

    return issues.filter(issue => {
      const issueDate = new Date(issue.timestamp);
      const matchesPeriod = parseInt(filterPeriod) === 999 ? true : issueDate >= cutoffDate;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        issue.motorista.toLowerCase().includes(searchLower) ||
        issue.placa.toLowerCase().includes(searchLower) ||
        issue.filial.toLowerCase().includes(searchLower);
      
      return matchesPeriod && matchesSearch;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [issues, filterPeriod, searchTerm]);

  // --- Analytics / KPIs ---
  const kpis = useMemo(() => {
    const totalOccurrences = filteredIssues.length;
    const totalNfs = filteredIssues.reduce((acc, curr) => acc + curr.qtdNaoBipadas, 0);
    
    // Most recurring driver
    const driverCounts: Record<string, number> = {};
    filteredIssues.forEach(i => {
      driverCounts[i.motorista] = (driverCounts[i.motorista] || 0) + 1;
    });
    const topDriverEntry = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0];
    const topDriver = topDriverEntry ? `${topDriverEntry[0]} (${topDriverEntry[1]})` : '-';

    return { totalOccurrences, totalNfs, topDriver };
  }, [filteredIssues]);

  // --- Charts Data ---
  const rankingByOccurrence = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIssues.forEach(i => counts[i.motorista] = (counts[i.motorista] || 0) + 1);
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredIssues]);

  const rankingByVolume = useMemo(() => {
    const sums: Record<string, number> = {};
    filteredIssues.forEach(i => sums[i.motorista] = (sums[i.motorista] || 0) + i.qtdNaoBipadas);
    return Object.entries(sums)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredIssues]);

  const trendData = useMemo(() => {
    const daily: Record<string, number> = {};
    filteredIssues.forEach(i => {
      const date = new Date(i.timestamp).toLocaleDateString('pt-BR');
      daily[date] = (daily[date] || 0) + 1;
    });
    return Object.entries(daily)
      .map(([date, count]) => ({ date, count }))
      // Charts usually read left-to-right, need valid date sort
      .sort((a, b) => {
         const [da, ma, ya] = a.date.split('/').map(Number);
         const [db, mb, yb] = b.date.split('/').map(Number);
         return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [filteredIssues]);

  const getFilterText = () => {
    const periodText = filterPeriod === '999' ? 'Todo o período' : `Últimos ${filterPeriod} dias`;
    const searchText = searchTerm ? ` | Busca: "${searchTerm}"` : '';
    return `${periodText}${searchText}`;
  }

  const handleDownloadPDF = () => {
    PDFService.generatePendenciasPDF(filteredIssues, getFilterText());
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <AlertTriangle className="text-marsala-600" />
          Gestão de Pendências
        </h2>
        <button 
          type="button"
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          <Download size={18} />
          <span>Baixar PDF</span>
        </button>
      </div>

      {/* Input Form (Hidden on Print) */}
      <Card title={editingId ? "Editar Ocorrência" : "Registrar Nova Pendência"} className="border-l-4 border-l-marsala-600">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data/Hora</label>
            <input 
              type="datetime-local" 
              required
              value={formData.datetime}
              onChange={e => setFormData({...formData, datetime: e.target.value})}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-marsala-500 focus:ring-marsala-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motorista</label>
            <input 
              list="drivers"
              type="text" 
              required
              placeholder="Nome do motorista"
              value={formData.motorista}
              onChange={e => setFormData({...formData, motorista: e.target.value})}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-marsala-500 focus:ring-marsala-500"
            />
            <datalist id="drivers">
              {uniqueDrivers.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placa</label>
            <input 
              type="text" 
              required
              placeholder="ABC-1234"
              value={formData.placa}
              onChange={e => setFormData({...formData, placa: e.target.value.toUpperCase()})}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-marsala-500 focus:ring-marsala-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qtd. NFs não bipadas</label>
            <input 
              type="number" 
              required
              min="1"
              value={formData.qtdNaoBipadas}
              onChange={e => setFormData({...formData, qtdNaoBipadas: e.target.value})}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-marsala-500 focus:ring-marsala-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filial</label>
            <input 
              type="text" 
              placeholder="Ex: SPO"
              value={formData.filial}
              onChange={e => setFormData({...formData, filial: e.target.value})}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-marsala-500 focus:ring-marsala-500"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observação</label>
            <input 
              type="text" 
              placeholder="Detalhes adicionais..."
              value={formData.observacao}
              onChange={e => setFormData({...formData, observacao: e.target.value})}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-marsala-500 focus:ring-marsala-500"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex gap-3 mt-2">
            <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-marsala-600 text-white rounded-md hover:bg-marsala-700 transition-colors shadow-sm">
              <Plus size={18} />
              {editingId ? 'Atualizar Ocorrência' : 'Salvar Ocorrência'}
            </button>
            <button 
              type="button" 
              onClick={() => { setFormData(initialFormState); setEditingId(null); }}
              className="px-6 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Limpar
            </button>
          </div>
        </form>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Total Ocorrências" value={kpis.totalOccurrences} icon={<AlertTriangle />} subtext="No período" />
        <KPICard title="NFs Não Bipadas" value={kpis.totalNfs} icon={<FileText />} subtext="Volume total" />
        <KPICard title="Motorista + Recorrente" value={kpis.topDriver} icon={<Truck />} subtext="Mais ocorrências" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Card title="Top 10 - Ocorrências por Motorista">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={rankingByOccurrence} margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                  <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb'}} />
                  <Bar dataKey="value" fill="#955251" radius={[0, 4, 4, 0]} isAnimationActive={true} label={{ position: 'right', fill: '#6B7280', fontSize: 10 }} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        
        <div>
          <Card title="Top 10 - Volume de NFs Não Bipadas">
             <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={rankingByVolume} margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                  <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb'}} />
                  <Bar dataKey="value" fill="#1F2937" radius={[0, 4, 4, 0]} isAnimationActive={true} label={{ position: 'right', fill: '#6B7280', fontSize: 10 }} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <div>
          <Card title="Tendência Temporal">
              <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{top: 20, right: 20}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{fontSize: 10}} />
                  <YAxis tick={{fontSize: 10}} />
                  <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb'}} />
                  <Line type="monotone" dataKey="count" stroke="#955251" strokeWidth={2} dot={{r: 3, fill: '#955251'}} activeDot={{r: 5}} isAnimationActive={true} />
                  </LineChart>
              </ResponsiveContainer>
              </div>
          </Card>
      </div>

      {/* Filters for Table */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por motorista, placa ou filial..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white py-2"
          />
        </div>
        <select 
          value={filterPeriod} 
          onChange={e => setFilterPeriod(e.target.value)}
          className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white py-2"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="999">Todo o período</option>
        </select>
      </div>

      {/* Table */}
      <div>
        <Card title={`Registros Detalhados (${filteredIssues.length})`} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-medium">Data/Hora</th>
                  <th className="p-4 font-medium">Motorista</th>
                  <th className="p-4 font-medium">Placa</th>
                  <th className="p-4 font-medium text-center">NFs Pendentes</th>
                  <th className="p-4 font-medium">Filial</th>
                  <th className="p-4 font-medium">Obs</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {filteredIssues.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum registro encontrado para o filtro atual.</td></tr>
                ) : (
                    filteredIssues.map(issue => (
                    <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 text-gray-700 dark:text-gray-300">
                        <td className="p-4">{new Date(issue.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-bold text-gray-900 dark:text-gray-100">{issue.motorista}</td>
                        <td className="p-4 font-mono text-xs"><span className="bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">{issue.placa}</span></td>
                        <td className="p-4 text-center font-bold text-red-600">{issue.qtdNaoBipadas}</td>
                        <td className="p-4">{issue.filial}</td>
                        <td className="p-4 text-gray-500 italic truncate max-w-xs">{issue.observacao || '-'}</td>
                        <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(issue)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                            <button onClick={() => handleDelete(issue.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                        </div>
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

export default PendenciasTab;