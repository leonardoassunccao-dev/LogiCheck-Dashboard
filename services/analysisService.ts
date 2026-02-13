import { OperationalManifest, RadarTransferencia, TransferPendencyType, FilialOperationalStats, ETrackRecord, LogiCheckScore, OperationalInsight, ManifestStatus } from '../types';

export const AnalysisService = {
  /**
   * BASE ÚNICA RADARDATA
   * Retorna 1 linha por transferência real (deduplicada por id + origem)
   */
  getRadarData: (manifests: OperationalManifest[]): RadarTransferencia[] => {
    const cyclesMap = new Map<string, any>();
    const now = new Date();

    manifests.forEach(m => {
      // Chave única: Filial Origem + Número do Romaneio
      const cycleKey = `${m.filialOrigem}_${m.romaneio}`;
      
      if (!cyclesMap.has(cycleKey)) {
        cyclesMap.set(cycleKey, {
          id: m.romaneio,
          origem: m.filialOrigem,
          destino: m.filialDestino,
          created: m.dataIncRomaneio,
          motorista: m.motorista,
          veiculo: m.veiculo,
          carregamento: null as OperationalManifest | null,
          descarga: null as OperationalManifest | null,
          nfs: m.totalNfs,
          vol: m.totalVolume
        });
      }

      const cycle = cyclesMap.get(cycleKey)!;
      const tipo = (m.tipo || '').toUpperCase();
      
      if (tipo.includes('CARREGAMENTO') || tipo.includes('SAIDA') || tipo.includes('SAÍDA')) {
        cycle.carregamento = m;
      } else if (tipo.includes('DESCARGA') || tipo.includes('ENTRADA') || tipo.includes('CHEGADA')) {
        cycle.descarga = m;
      } else if (!cycle.carregamento) {
        cycle.carregamento = m;
      }
    });

    return Array.from(cyclesMap.values()).map(cycle => {
      const carStatus: ManifestStatus = cycle.carregamento?.status || 'AUSENTE';
      const desStatus: ManifestStatus = cycle.descarga?.status || 'AUSENTE';
      const start = new Date(cycle.created);
      const aging_horas = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));
      
      const divergencia_ativa = carStatus === 'DIVERGENTE' || desStatus === 'DIVERGENTE';
      
      let tipo_pendencia: TransferPendencyType = 'OK';
      let pendente = true;

      // REGRAS HIERÁRQUICAS
      if (divergencia_ativa) {
        tipo_pendencia = 'DIVERGENCIA';
      } else if (carStatus !== 'CONFERIDO') {
        tipo_pendencia = 'ORIGEM';
      } else if (desStatus !== 'CONFERIDO') {
        tipo_pendencia = 'DESTINO';
      } else {
        tipo_pendencia = 'OK';
        pendente = false;
      }

      return {
        id_transferencia: cycle.id,
        origem_filial: cycle.origem,
        destino_filial: cycle.destino,
        created_at: cycle.created,
        motorista: cycle.motorista,
        veiculo: cycle.veiculo,
        carga_status: carStatus,
        descarga_status: desStatus,
        divergencia_ativa,
        tipo_pendencia,
        pendente,
        aging_horas,
        totalNfs: cycle.nfs,
        totalVolume: cycle.vol
      };
    });
  },

  getFilialStats: (radarData: RadarTransferencia[]): FilialOperationalStats[] => {
    const map = new Map<string, any>();
    
    radarData.filter(c => c.pendente).forEach(c => {
      const f = c.origem_filial;
      if (!map.has(f)) {
        map.set(f, { 
          filial: f, total: 0, o: 0, d: 0, div: 0, agingSum: 0, maxA: 0 
        });
      }
      const s = map.get(f)!;
      s.total++;
      s.agingSum += c.aging_horas;
      if (c.aging_horas > s.maxA) s.maxA = c.aging_horas;
      
      if (c.tipo_pendencia === 'ORIGEM') s.o++;
      if (c.tipo_pendencia === 'DESTINO') s.d++;
      if (c.tipo_pendencia === 'DIVERGENCIA') s.div++;
    });

    return Array.from(map.values()).map(s => ({
      filial: s.filial,
      total_pendentes: s.total,
      origem_count: s.o,
      destino_count: s.d,
      divergencia_count: s.div,
      aging_medio: Math.round(s.agingSum / s.total),
      maior_aging: s.maxA
    })).sort((a, b) => b.total_pendentes - a.total_pendentes);
  },

  getGeneralOperationalStatus: (radarData: RadarTransferencia[]) => {
    const pendentes = radarData.filter(c => c.pendente).length;
    const total = radarData.length;
    if (total === 0) return { label: 'SEM DADOS', color: 'bg-gray-400', desc: 'Importe os romaneios' };
    
    const rate = (pendentes / total) * 100;
    if (rate > 35) return { label: 'CRÍTICO', color: 'bg-red-600', desc: 'Volume de pendências alarmante' };
    if (rate > 20) return { label: 'ATENÇÃO', color: 'bg-yellow-500', desc: 'Fluxo acima da capacidade' };
    return { label: 'ESTÁVEL', color: 'bg-green-600', desc: 'Operação fluindo perfeitamente' };
  },

  calculateScore: (data: ETrackRecord[], manifests: OperationalManifest[]): LogiCheckScore => {
    const radar = AnalysisService.getRadarData(manifests);
    if (radar.length === 0) return { score: 0, label: 'Sem Dados', color: 'text-gray-400' };
    const concluidas = radar.filter(c => !c.pendente).length;
    const rate = (concluidas / radar.length) * 100;
    return { 
      score: Math.round(rate), 
      label: rate > 80 ? 'Excelente' : rate > 60 ? 'Regular' : 'Crítico',
      color: rate > 80 ? 'text-green-600' : rate > 60 ? 'text-yellow-600' : 'text-red-600'
    };
  },

  getInsights: (data: ETrackRecord[]): OperationalInsight[] => [],
  getComparison: (data: ETrackRecord[]) => ({ diff: 0, trend: 'stable' }),
  getRadarAlert: (manifests: OperationalManifest[]) => {
    const radar = AnalysisService.getRadarData(manifests);
    const pendentes = radar.filter(c => c.pendente).length;
    return { severityLevel: pendentes > 15 ? 2 : 0, count: pendentes, oldest: 0, statusText: `${pendentes} pendentes`, styleClass: '', iconColor: '' };
  },
  getGeneralStatus: (score: number, radarSeverity: number) => ({ status: 'OK', color: 'bg-green-600', textColor: 'text-white', description: 'Monitoramento ativo' })
};
