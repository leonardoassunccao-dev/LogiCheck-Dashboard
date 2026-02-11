import React, { useMemo } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { ETrackRecord, DrillDownType } from '../types';
import { PDFService } from '../services/pdfService';
import * as XLSX from 'xlsx';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: DrillDownType | null;
  data: ETrackRecord[];
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ isOpen, onClose, type, data }) => {
  if (!isOpen || !type) return null;

  // --- Data Processing Logic ---
  const { tableHeaders, tableData, title, summary } = useMemo(() => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let modalTitle = '';
    let modalSummary: React.ReactNode = null;

    if (type === 'ROMANEIOS') {
      modalTitle = 'Detalhamento de Romaneios';
      
      // 1. Sort by Date/Time Descending (Newest first)
      // We copy array to avoid mutating prop
      const sortedData = [...data].sort((a, b) => 
        new Date(b.conferenciaData).getTime() - new Date(a.conferenciaData).getTime()
      );

      // 2. Calculate Date Range Context
      const dates = sortedData.map(d => new Date(d.conferenciaData).getTime());
      let rangeLabel = 'N/A';
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const isSameDay = minDate.toLocaleDateString('pt-BR') === maxDate.toLocaleDateString('pt-BR');
        
        rangeLabel = isSameDay 
          ? minDate.toLocaleDateString('pt-BR') 
          : `${minDate.toLocaleDateString('pt-BR')} até ${maxDate.toLocaleDateString('pt-BR')}`;
      }

      headers = ['Data', 'Veículo', 'Motorista', 'Filial', 'NFs', 'Conferente'];
      rows = sortedData.map(d => [
        new Date(d.conferenciaData).toLocaleDateString('pt-BR'),
        d.veiculo,
        d.motorista,
        d.filial,
        d.nfColetadas,
        d.conferidoPor
      ]);

      modalSummary = (
        <div className="flex flex-col mt-1">
           <span className="text-sm text-gray-600 dark:text-gray-300">
             Período: <strong className="text-marsala-600 dark:text-marsala-400">{rangeLabel}</strong>
           </span>
           <span className="text-xs text-gray-400">Total: <strong>{data.length}</strong> romaneios listados</span>
        </div>
      );
    } 
    
    else if (type === 'NFS') {
      modalTitle = 'Detalhamento de NFs Processadas';
      headers = ['Data', 'Motorista', 'Veículo', 'Volume NFs'];
      rows = data.map(d => [
        new Date(d.conferenciaData).toLocaleDateString('pt-BR'),
        d.motorista,
        d.veiculo,
        d.nfColetadas
      ]).sort((a, b) => (b[3] as number) - (a[3] as number)); 

      const totalNFs = data.reduce((acc, curr) => acc + curr.nfColetadas, 0);
      modalSummary = <span className="text-sm text-gray-500">Volume Total: <strong>{totalNFs.toLocaleString()}</strong> NFs</span>;
    } 
    
    else if (type === 'MOTORISTAS') {
      modalTitle = 'Base de Motoristas';
      const stats: Record<string, { nfs: number; romaneios: number }> = {};
      data.forEach(d => {
        if (!stats[d.motorista]) stats[d.motorista] = { nfs: 0, romaneios: 0 };
        stats[d.motorista].nfs += d.nfColetadas;
        stats[d.motorista].romaneios += 1;
      });

      headers = ['Motorista', 'Romaneios', 'Total NFs', 'Média NFs/Viagem'];
      rows = Object.entries(stats)
        .map(([name, stat]) => [
          name,
          stat.romaneios,
          stat.nfs,
          Math.round(stat.nfs / stat.romaneios)
        ])
        .sort((a, b) => (b[2] as number) - (a[2] as number)); 

      modalSummary = <span className="text-sm text-gray-500">Motoristas Únicos: <strong>{Object.keys(stats).length}</strong></span>;
    } 
    
    else if (type === 'FILIAIS') {
      modalTitle = 'Filiais Operantes';
      const stats: Record<string, { nfs: number; romaneios: number }> = {};
      data.forEach(d => {
        if (!stats[d.filial]) stats[d.filial] = { nfs: 0, romaneios: 0 };
        stats[d.filial].nfs += d.nfColetadas;
        stats[d.filial].romaneios += 1;
      });

      const totalDocs = data.length;

      headers = ['Filial', 'Romaneios', 'Part. % (Rom)', 'Total NFs'];
      rows = Object.entries(stats)
        .map(([name, stat]) => [
          name,
          stat.romaneios,
          ((stat.romaneios / totalDocs) * 100).toFixed(1) + '%',
          stat.nfs
        ])
        .sort((a, b) => (b[3] as number) - (a[3] as number));

      modalSummary = <span className="text-sm text-gray-500">Total Filiais: <strong>{Object.keys(stats).length}</strong></span>;
    }

    return { tableHeaders: headers, tableData: rows, title: modalTitle, summary: modalSummary };
  }, [type, data]);

  // --- Export Handlers ---
  const handleExportPDF = () => {
    const stringRows = tableData.map(row => row.map(cell => cell.toString()));
    PDFService.generateDrillDownPDF(title, [tableHeaders], stringRows);
  };

  const handleExportCSV = () => {
    const ws = XLSX.utils.aoa_to_sheet([tableHeaders, ...tableData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, `logicheck_${safeTitle}_${dateStr}.csv`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-850 rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
            {summary}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/80 backdrop-blur-sm z-10 shadow-sm">
              <tr>
                {tableHeaders.map((h, i) => (
                  <th key={i} className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {type === 'ROMANEIOS' ? (
                // Grouped Rendering for Romaneios
                tableData.map((row, rIdx) => {
                  const currentDate = row[0] as string; // Data Column
                  const prevDate = rIdx > 0 ? tableData[rIdx - 1][0] as string : null;
                  const showHeader = currentDate !== prevDate;
                  
                  return (
                    <React.Fragment key={rIdx}>
                      {showHeader && (
                        <tr className="bg-gray-100 dark:bg-gray-800/80">
                          <td colSpan={6} className="px-6 py-2 text-xs font-bold text-marsala-700 dark:text-marsala-300 uppercase tracking-wider border-y border-gray-200 dark:border-gray-700">
                            📅 {currentDate}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                // Standard Rendering for other types
                tableData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {tableData.length === 0 && (
             <div className="p-12 text-center text-gray-400">Nenhum dado disponível.</div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-850/50 rounded-b-xl flex justify-end gap-3">
           <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet size={16} className="text-green-600 dark:text-green-400" />
            CSV
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            PDF
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;