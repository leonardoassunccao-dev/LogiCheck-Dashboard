import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, RotateCcw, FileText, CheckCircle2, Trash2, AlertCircle, AlertTriangle } from 'lucide-react';
import { ETrackRecord, ImportBatch } from '../types';
import { Card } from './ui/Card';
import { StorageService, generateUUID } from '../services/storageService';

interface ImportDataTabProps {
  data: ETrackRecord[];
  history: ImportBatch[];
  // Atualiza dados no workspace ATUAL
  onDataUpdate: (newData: ETrackRecord[], newHistory: ImportBatch[]) => void;
}

const ImportDataTab: React.FC<ImportDataTabProps> = ({ data, history, onDataUpdate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify orphaned records (data without a valid import batch link)
  // This happens if data was imported before the batching logic was added.
  const orphanedCount = useMemo(() => {
    const validBatchIds = new Set(history.map(h => h.id));
    return data.filter(r => !r.importId || !validBatchIds.has(r.importId)).length;
  }, [data, history]);

  // Helper para normalizar datas
  const normalizeDate = (raw: any): string => {
    if (raw === undefined || raw === null || raw === '') return new Date().toISOString();
    let dateObj: Date | undefined;
    if (typeof raw === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const totalMilliseconds = Math.round(raw * 86400 * 1000);
      const utcDate = new Date(excelEpoch.getTime() + totalMilliseconds);
      dateObj = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 12, 0, 0);
    } else if (typeof raw === 'string') {
      const cleanStr = raw.trim();
      const ptBrRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/;
      const match = cleanStr.match(ptBrRegex);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; 
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        dateObj = new Date(year, month, day, 12, 0, 0);
      } else {
        const tryDate = new Date(raw);
        if (!isNaN(tryDate.getTime())) {
          dateObj = new Date(tryDate.getFullYear(), tryDate.getMonth(), tryDate.getDate(), 12, 0, 0);
        }
      }
    } else if (raw instanceof Date) {
       dateObj = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12, 0, 0);
    }
    if (dateObj && !isNaN(dateObj.getTime())) return dateObj.toISOString();
    return new Date().toISOString();
  };

  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    const files: File[] = Array.from(e.target.files);
    
    let incomingRecords: ETrackRecord[] = [];
    let incomingBatches: ImportBatch[] = [];

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true }) as any[];

        // Use safe UUID generator
        const batchId = generateUUID();
        const mappedData: ETrackRecord[] = jsonData.map((row: any) => ({
          id: generateUUID(),
          importId: batchId,
          nfColetadas: Number(row['NF Coletadas']) || 0,
          veiculo: String(row['Veículo'] || row['Veiculo'] || 'N/A'),
          motorista: String(row['Motorista'] || 'N/A'),
          filial: String(row['Filial'] || 'N/A'),
          conferenciaData: normalizeDate(row['Conferencia data']),
          conferidoPor: String(row['Conferido por'] || 'N/A'),
        })).filter(r => r.motorista !== 'N/A');

        if (mappedData.length > 0) {
            incomingRecords = [...incomingRecords, ...mappedData];
            incomingBatches.push({
                id: batchId,
                fileName: file.name,
                timestamp: new Date().toISOString(),
                recordCount: mappedData.length
            });
        }
      } catch (error) {
        console.error("Error parsing file", file.name, error);
        alert(`Erro ao ler arquivo ${file.name}`);
      }
    }

    if (incomingRecords.length > 0) {
      let finalData: ETrackRecord[];
      let finalHistory: ImportBatch[];
      if (importMode === 'replace') {
          finalData = incomingRecords;
          finalHistory = incomingBatches;
      } else {
          finalData = [...data, ...incomingRecords];
          finalHistory = [...history, ...incomingBatches];
      }
      onDataUpdate(finalData, finalHistory);
      alert(`${incomingRecords.length} registros importados com sucesso!`);
    } else {
      alert('Nenhum registro válido encontrado nos arquivos.');
    }
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteOrphans = () => {
     if (window.confirm(`Excluir ${orphanedCount} registros antigos/legados que não estão vinculados a nenhum arquivo?`)) {
        const validBatchIds = new Set(history.map(h => h.id));
        // Keep only records that have a valid batch ID
        const newData = data.filter(record => record.importId && validBatchIds.has(record.importId));
        onDataUpdate(newData, history);
     }
  };

  const handleFactoryReset = () => {
    const confirmMsg = "⚠️ ATENÇÃO: RESET DE FÁBRICA ⚠️\n\nVocê está prestes a apagar TODOS os dados do aplicativo, incluindo:\n- Todos os arquivos importados\n- Histórico de importação\n- Pendências registradas\n- Configurações locais\n\nO aplicativo será reiniciado.\n\nTem certeza absoluta?";

    if (window.confirm(confirmMsg)) {
        // Nuclear option: Direct storage wipe + Reload
        StorageService.clearAllData();
        window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Gerenciamento de Dados</h2>
        
        <div className="flex flex-wrap items-center gap-2">
            
            {(data.length > 0 || history.length > 0) && (
                <button
                    type="button"
                    onClick={handleFactoryReset}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-all text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    title="Reset de Fábrica: Apaga tudo e recarrega"
                >
                    <AlertTriangle size={14} className="text-white" />
                    Resetar Tudo
                </button>
            )}

            <span className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300">
            Total: <strong>{data.length}</strong>
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card de Upload */}
        <Card title="Importar XLS (E-track)" className="h-full">
          
          <div className="mb-6 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg flex">
             <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${importMode === 'append' ? 'bg-white dark:bg-gray-600 text-marsala-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
             >
                <CheckCircle2 size={16} />
                Somar ao Histórico
             </button>
             <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${importMode === 'replace' ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
             >
                <RotateCcw size={16} />
                Substituir Dados
             </button>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <Upload className="w-12 h-12 text-marsala-500 mb-4" />
            <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
              Clique para selecionar arquivos .xls ou .xlsx
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={processFile}
              multiple
              accept=".xls,.xlsx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className={`px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 text-white cursor-pointer ${importMode === 'append' ? 'bg-marsala-600 hover:bg-marsala-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isProcessing ? 'Processando...' : importMode === 'append' ? 'Importar e Adicionar' : 'Importar e Substituir'}
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-400 text-center">
              Modo selecionado: <strong>{importMode === 'append' ? 'Adicionar (Mantém anteriores)' : 'Substituir (Apaga anteriores)'}</strong>
          </div>
        </Card>

        {/* Card de Histórico */}
        <Card title="Histórico de Imports" className="h-full flex flex-col relative">
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 px-1">
            Registro dos arquivos importados neste ciclo.
          </p>

          <div className="flex-1 min-h-0 flex flex-col relative z-0">
             <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-md scrollbar-hide max-h-[400px]">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                         <tr>
                             <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Arquivo</th>
                             <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium text-center">Reg.</th>
                             <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium text-right">Ações</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                         {history.length === 0 && orphanedCount === 0 ? (
                             <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400 text-xs">Nenhum histórico disponível</td></tr>
                         ) : (
                             <>
                             {/* Orphaned Data Row */}
                             {orphanedCount > 0 && (
                                <tr className="bg-orange-50 dark:bg-orange-900/10">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={14} className="text-orange-500" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-orange-700 dark:text-orange-300 text-xs">Dados Antigos / Sem Vínculo</span>
                                                <span className="text-[10px] text-orange-500/70">Registros importados anteriormente</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold text-orange-700 dark:text-orange-300">
                                        {orphanedCount}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <button 
                                            type="button"
                                            onClick={handleDeleteOrphans}
                                            className="p-1.5 text-orange-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                            title="Excluir dados legados"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                             )}
                             
                             {/* Standard Batches */}
                             {[...history].reverse().map(batch => (
                                 <tr key={batch.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                     <td className="px-3 py-2 max-w-[150px]" title={batch.fileName}>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText size={12} className="text-marsala-500 flex-shrink-0" />
                                                <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{batch.fileName}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 pl-5">
                                                {new Date(batch.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                     </td>
                                     <td className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">
                                         {batch.recordCount}
                                     </td>
                                     <td className="px-3 py-2 text-right">
                                         {/* Delete button removed */}
                                     </td>
                                 </tr>
                             ))}
                             </>
                         )}
                     </tbody>
                 </table>
             </div>
          </div>
        </Card>
      </div>

      {data.length > 0 && (
        <Card title="Prévia dos Dados (Últimos 10)" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Motorista</th>
                  <th className="p-4 font-medium">Veículo</th>
                  <th className="p-4 font-medium text-right">NFs</th>
                  <th className="p-4 font-medium">Filial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {data.slice(-10).reverse().map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 text-gray-700 dark:text-gray-300">
                    <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                      {new Date(row.conferenciaData).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 font-medium">{row.motorista}</td>
                    <td className="p-4">{row.veiculo}</td>
                    <td className="p-4 text-right">{row.nfColetadas}</td>
                    <td className="p-4">{row.filial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ImportDataTab;