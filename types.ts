export interface ETrackRecord {
  id: string;
  importId?: string;
  nfColetadas: number;
  veiculo: string;
  motorista: string;
  filial: string;
  conferenciaData: string;
  conferidoPor: string;
}

export interface DriverIssue {
  id: string;
  timestamp: string;
  motorista: string;
  placa: string;
  qtdNaoBipadas: number;
  filial: string;
  observacao?: string;
}

export type ManifestStatus = 'PENDENTE' | 'CONFERIDO' | 'DIVERGENTE';

export interface OperationalManifest {
  id: string; 
  key: string; 
  romaneio: string; 
  tipo: string; // Ex: CARREGAMENTO, DESCARGA, COLETA
  carga: string;
  filialOrigem: string;
  filialDestino: string;
  veiculo: string;
  motorista: string;
  dataIncRomaneio: string; 
  
  totalNfs: number;
  totalVolume: number;
  totalPeso: number;
  
  status: ManifestStatus;
  diasEmAberto: number;
  ultimoUpdate: string;
}

export type TransferPendencyType = 'PEND_ORIGEM' | 'PEND_DESTINO' | 'PEND_DIVERGENCIA' | 'CONCLUIDA';

export interface TransferCycle {
  id: string; // Geralmente o número do Romaneio
  filialOrigem: string;
  filialDestino: string;
  dataCriacao: string;
  motorista: string;
  veiculo: string;
  
  // Manifestos vinculados
  carregamento?: OperationalManifest;
  descarga?: OperationalManifest;
  
  statusGeral: TransferPendencyType;
  agingHours: number;
  totalNfs: number;
  totalVolume: number;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  timestamp: string;
  recordCount: number;
}

export type Theme = 'light' | 'dark';
export type Tab = 'dashboard' | 'pendencias' | 'romaneios' | 'dados';

export interface AppState {
  theme: Theme;
  importedData: ETrackRecord[];
  operationalManifests: OperationalManifest[];
  importHistory: ImportBatch[];
  driverIssues: DriverIssue[];
  isMeetingMode: boolean;
}

export type DrillDownType = 'ROMANEIOS' | 'NFS' | 'MOTORISTAS' | 'FILIAIS';

export interface OperationalInsight {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  trendValue?: string;
  drillDown?: DrillDownType;
}

export interface LogiCheckScore {
  score: number;
  label: string;
  color: string;
}