import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, RotateCcw, FileText, CheckCircle2, Trash2, AlertCircle, AlertTriangle, ClipboardList } from 'lucide-react';
import { ETrackRecord, ImportBatch, OperationalManifest, ManifestStatus } from '../types';
import { Card } from './ui/Card';
import { StorageService, generateUUID } from '../services/storageService';

interface ImportDataTabProps {
  data: ETrackRecord[];
  manifests: OperationalManifest[];
  history: ImportBatch[];
  onDataUpdate: (newData: ETrackRecord[], newManifests: OperationalManifest[], newHistory: ImportBatch[]) => void;
}

const ImportDataTab: React.FC<ImportDataTabProps> = ({ data, manifests, history, onDataUpdate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orphanedCount = useMemo(() => {
    const validBatchIds = new Set(history.map(h => h.id));
    return data.filter(r => !r.importId || !validBatchIds.has(r.importId)).length;
  }, [data, history]);

  const normalizeDate = (raw: any): string | null => {
    if (raw === undefined || raw === null || raw === '') return null;
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
    return null;
  };

  const parsePtBrFloat = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const clean = val.replace(/\./g, '').replace(',', '.');
      const float = parseFloat(clean);
      return isNaN(float) ? 0 : float;
    }
    return 0;
  };

  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    const files: File[] = Array.from(e.target.files);
    
    let incomingRecords: ETrackRecord[] = [];
    let incomingManifests: OperationalManifest[] = []; 
    let incomingBatches: ImportBatch[] = [];

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true }) as any[];

        const batchId = generateUUID();
        const now = new Date();

        // Check if it's an operational manifest file (E-track specific columns)
        const isManifestFile = jsonData.length > 0 && 
          (('Romaneio' in jsonData[0]) || ('Nº Romaneio' in jsonData[0])) && 
          (('Filial origem' in jsonData[0]) || ('Filial Origem' in jsonData[0]));

        if (isManifestFile) {
          const manifestMap = new Map<string, {
            lines: any[],
            aggregatedStatus: ManifestStatus
          }>();

          jsonData.forEach((row: any) => {
             const romaneio = String(row['Romaneio'] || row['Nº Romaneio'] || '').trim();
             const filialOrigem = String(row['Filial origem'] || row['Filial Origem'] || '').trim();
             const tipo = String(row['Tipo'] || '').trim();

             if (!romaneio) return;
             // Key is unique per branch, manifest number and type (Loading/Unloading)
             const key = `${filialOrigem}_${romaneio}_${tipo}`;
             
             if (!manifestMap.has(key)) {
               manifestMap.set(key, { lines: [], aggregatedStatus: 'CONFERIDO' });
             }
             
             const entry = manifestMap.get(key)!;
             entry.lines.push(row);

             const statusLine = String(row['Status'] || row['Situação'] || '').toUpperCase();
             const dataConf = row['Data conferencia volume'] || row['Data Conf.'];
             const userConf = row['Usuario conferencia volume'] || row['Usuário Conf.'];
             
             // Logic: DIVERGENTE > PENDENTE > CONFERIDO
             if (statusLine.includes('DIVERGENTE') || statusLine.includes('DIVERGÊNCIA')) {
                entry.aggregatedStatus = 'DIVERGENTE';
             } else if (entry.aggregatedStatus !== 'DIVERGENTE') {
                const isLinePending = (statusLine !== 'CONFERIDO' && statusLine !== 'CONCLUÍDO') || 
                                     !dataConf || !userConf || String(userConf).trim() === '';
                if (isLinePending) {
                   entry.aggregatedStatus = 'PENDENTE';
                }
             }
          });

          manifestMap.forEach((value, key) => {
             const firstRow = value.lines[0];
             const uniqueNFs = new Set<string>();
             let totalVolume = 0;
             let totalPeso = 0;

             value.lines.forEach(r => {
                const nf = r['NF'] || r['Nº NF'];
                if (nf) uniqueNFs.add(String(nf));
                totalVolume += parsePtBrFloat(r['Volume'] || r['Quantidade']);
                totalPeso += parsePtBrFloat(r['Peso'] || r['Peso Total']);
             });

             const dataInc = normalizeDate(firstRow['Data Inc. romaneio'] || firstRow['Data Inclusão']) || now.toISOString();
             const createdTime = new Date(dataInc).getTime();
             const daysOpen = Math.floor((now.getTime() - createdTime) / (1000 * 60 * 60 * 24));

             incomingManifests.push({
                id: generateUUID(),
                key: key,
                romaneio: String(firstRow['Romaneio'] || firstRow['Nº Romaneio']),
                tipo: String(firstRow['Tipo'] || 'N/A'),
                carga: String(firstRow['Carga'] || 'N/A'),
                filialOrigem: String(firstRow['Filial origem'] || firstRow['Filial Origem'] || 'N/A'),
                filialDestino: String(firstRow['Filial destino'] || firstRow['Filial Destino'] || 'N/A'),
                veiculo: String(firstRow['Veículo'] || firstRow['Veiculo'] || firstRow['Placa'] || 'N/A'),
                motorista: String(firstRow['Motorista'] || 'N/A'),
                dataIncRomaneio: dataInc,
                totalNfs: uniqueNFs.size,
                totalVolume: totalVolume,
                totalPeso: totalPeso,
                status: value.aggregatedStatus,
                diasEmAberto: daysOpen >= 0 ? daysOpen : 0,
                ultimoUpdate: now.toISOString()
             });
          });

        } else {
          // Standard Conferência file processing
          const mappedData: ETrackRecord[] = jsonData
            .map((row: any) => ({
              id: generateUUID(),
              importId: batchId,
              nfColetadas: Number(row['NF Coletadas'] || row['NFs']) || 0,
              veiculo: String(row['Veículo'] || row['Veiculo'] || row['Placa'] || 'N/A'),
              motorista: String(row['Motorista'] || 'N/A'),
              filial: String(row['Filial'] || 'N/A'),
              conferenciaData: normalizeDate(row['Conferencia data'] || row['Data Conf.']) || new Date().toISOString(),
              conferidoPor: String(row['Conferido por'] || row['Usuário'] || 'N/A')
            }));
          
          incomingRecords.push(...mappedData);
          incomingBatches.push({
            id: batchId,
            fileName: file.name,
            timestamp: now.toISOString(),
            recordCount: mappedData.length
          });
        }
      } catch (err) {
        console.error('File parse error:', err);
      }
    }

    if (importMode === 'replace') {
      onDataUpdate(incomingRecords, incomingManifests, incomingBatches);
    } else {
      onDataUpdate([...data, ...incomingRecords], [...manifests, ...incomingManifests], [...history, ...incomingBatches]);
    }
    
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = () => {
    if (confirm('ATENÇÃO: Isso apagará TODOS os dados permanentemente. Continuar?')) {
      StorageService.clearAllData();
      window.location.reload();
    }
  };

  const handleClearBatch = (id: string) => {
    if (confirm('Excluir este lote de importação?')) {
      const newHistory = history.filter(h => h.id !== id);
      const newData = data.filter(d => d.importId !== id);
      // We don't remove manifests here as they are not currently tied to history batches in this simple version
      onDataUpdate(newData, manifests, newHistory);
    }
  };

  const handleClearOrphaned = () => {
    const validBatchIds = new Set(history.map(h => h.id));
    const newData = data.filter(r => r.importId && validBatchIds.has(r.importId));
    onDataUpdate(newData, manifests, history);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
             <Upload className="text-marsala-600" />
             Importação de Dados
           </h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
             Carregue planilhas do E-track (.xlsx ou .csv)
           </p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={handleClearAll}
             className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs hover:bg-red-50 transition-all shadow-sm"
           >
             <Trash2 size={16} />
             Limpar Tudo
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Card */}
        <Card className="lg:col-span-4 border-t-4 border-t-marsala-600">
           <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all
                  ${isProcessing ? 'border-gray-200 bg-gray-50' : 'border-marsala-100 hover:border-marsala-400 hover:bg-marsala-50/30'}
                `}
              >
                 <div className="w-16 h-16 bg-marsala-50 dark:bg-marsala-900/20 text-marsala-600 rounded-full flex items-center justify-center mb-4">
                    {isProcessing ? <RotateCcw size={32} className="animate-spin" /> : <Upload size={32} />}
                 </div>
                 <h4 className="text-sm font-black text-gray-900 dark:text-white mb-2 uppercase tracking-widest">
                    {isProcessing ? 'Processando...' : 'Solte sua planilha'}
                 </h4>
                 <p className="text-xs text-gray-400 font-medium">Suporta XLSX, XLS e CSV</p>
                 <input 
                    type="file" 
                    multiple
                    ref={fileInputRef}
                    onChange={processFile}
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                 />
              </div>

              <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Modo de Importação</p>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setImportMode('append')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${importMode === 'append' ? 'bg-marsala-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-400'}`}
                    >
                      Acumular
                    </button>
                    <button 
                      onClick={() => setImportMode('replace')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${importMode === 'replace' ? 'bg-marsala-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-400'}`}
                    >
                      Substituir
                    </button>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                    <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed font-medium">
                       <strong>Dica:</strong> Para o <strong>Radar Operacional</strong>, use a exportação de Romaneios com colunas como "Tipo", "Status" e "Datas".
                    </div>
                 </div>
              </div>
           </div>
        </Card>

        {/* Info & History Card */}
        <div className="lg:col-span-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={24} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base de Dados</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{data.length.toLocaleString()} <span className="text-xs font-bold text-gray-400">Linhas</span></p>
                 </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft flex items-center gap-4">
                 <div className="w-12 h-12 bg-marsala-50 dark:bg-marsala-900/20 text-marsala-600 rounded-xl flex items-center justify-center">
                    <ClipboardList size={24} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Radar Ativo</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{manifests.length.toLocaleString()} <span className="text-xs font-bold text-gray-400">Romaneios</span></p>
                 </div>
              </div>
           </div>

           {orphanedCount > 0 && (
             <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/50 p-4 rounded-2xl flex justify-between items-center animate-fadeIn">
                <div className="flex items-center gap-3">
                   <AlertCircle className="text-yellow-600" />
                   <div>
                      <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400">Detectamos {orphanedCount} registros órfãos.</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-500">Dados que não pertencem a nenhum lote de importação ativo.</p>
                   </div>
                </div>
                <button 
                  onClick={handleClearOrphaned}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-xl text-xs font-black hover:bg-yellow-700 transition-all shadow-md"
                >
                  Limpar Órfãos
                </button>
             </div>
           )}

           <Card title="Histórico de Importação" noPadding>
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] uppercase text-gray-400 font-black">
                       <tr>
                          <th className="p-4">Arquivo</th>
                          <th className="p-4">Data/Hora</th>
                          <th className="p-4 text-center">Registros</th>
                          <th className="p-4 text-right">Ação</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                       {history.length === 0 ? (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-400 font-medium italic tracking-wide">Nenhuma importação realizada.</td></tr>
                       ) : (
                          history.map((item) => (
                             <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="p-4 font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                   <FileText size={14} className="text-gray-400" />
                                   {item.fileName}
                                </td>
                                <td className="p-4 text-gray-500 font-medium">{new Date(item.timestamp).toLocaleString()}</td>
                                <td className="p-4 text-center">
                                   <span className="bg-marsala-50 dark:bg-marsala-900/20 text-marsala-600 px-2 py-0.5 rounded-full font-black tracking-tight">{item.recordCount}</span>
                                </td>
                                <td className="p-4 text-right">
                                   <button 
                                      onClick={() => handleClearBatch(item.id)}
                                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                   >
                                      <Trash2 size={16} />
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
    </div>
  );
};

export default ImportDataTab;