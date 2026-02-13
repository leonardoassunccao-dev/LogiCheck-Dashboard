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

export type ManifestStatus = 'PENDENTE' | 'CONFERIDO' | 'DIVERGENTE' | 'AUSENTE';
export type PriorityLevel = 'ALTA' | 'MEDIA' | 'BAIXA';
export type TransferPendencyType = 'OK' | 'ORIGEM' | 'DESTINO' | 'DIVERGENCIA';

export interface OperationalManifest {
  id: string; 
  key: string; 
  romaneio: string; 
  tipo: string; 
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

export interface TransferCycle {
  id: string; // id_transferencia (romaneio)
  origem_filial: string;
  destino_filial: string;
  created_at: string;
  motorista: string;
  veiculo: string;
  carga_status: ManifestStatus;
  descarga_status: ManifestStatus;
  divergencia_ativa: boolean;
  tipo_pendencia: TransferPendencyType;
  pendente: boolean;
  aging_horas: number;
  totalNfs: number;
  totalVolume: number;
}

export interface FilialOperationalStats {
  filial: string;
  total: number;
  concluidas: number;
  pendentes: number;
  pOrigem: number;
  pDestino: number;
  pDivergencia: number;
  agingMedio: number;
  maiorAging: number;
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