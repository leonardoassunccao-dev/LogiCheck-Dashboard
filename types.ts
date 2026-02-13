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

export interface OperationalManifest {
  id: string; // UUID interno
  key: string; // Chave única: Filial Origem + Romaneio + Tipo
  romaneio: string; 
  tipo: string;
  carga: string;
  filialOrigem: string;
  filialDestino: string;
  veiculo: string;
  motorista: string;
  dataIncRomaneio: string; // Data de criação do romaneio (ISO)
  
  // Dados Agregados
  totalNfs: number;
  totalVolume: number;
  totalPeso: number;
  
  status: 'PENDENTE' | 'CONFERIDO';
  diasEmAberto: number;
  ultimoUpdate: string;
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