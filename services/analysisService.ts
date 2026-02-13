import { OperationalManifest, TransferCycle, TransferPendencyType, FilialOperationalStats, ETrackRecord, LogiCheckScore, OperationalInsight, ManifestStatus } from '../types';

export const AnalysisService = {
  /**
   * BASE ÚNICA RADARDATA
   * Retorna 1 linha por Transferência (DISTINCT id_transferencia + origem_filial)
   */
  getTransferCycles: (manifests: OperationalManifest[]): TransferCycle[] => {
    const cyclesMap = new Map<string, any>();
    const now = new Date();

    // Agregação por id_transferencia + origem_filial
    manifests.forEach(m => {
      const cycleKey = `${m.filialOrigem}_${m.romaneio}`;
      if (!cyclesMap.has(cycleKey)) {
        cyclesMap.set(cycleKey, {
          romaneio: m.romaneio,
          filialOrigem: m.filialOrigem,
          filialDestino: m.filialDestino,
          dataCriacao: m.dataIncRomaneio,
          motorista: m.motorista,
          veiculo: m.veiculo,
          carregamento: null as OperationalManifest | null,
          descarga: null as OperationalManifest | null,
          totalNfs: m.totalNfs,
          totalVolume: m.totalVolume
        });
      }

      const cycle = cyclesMap.get(cycleKey)!;
      const tipo = (m.tipo || '').toUpperCase();
      
      // Mapeia Carga vs Descarga
      if (tipo.includes('CARREGAMENTO') || tipo.includes('SAIDA') || tipo.includes('SAÍDA')) {
        cycle.carregamento = m;
      } else if (tipo.includes('DESCARGA') || tipo.includes('ENTRADA') || tipo.includes('CHEGADA')) {
        cycle.descarga = m;
      } else if (!cycle.carregamento) {
        cycle.carregamento = m;
      }
    });

    return Array.from(cyclesMap.values()).map(cycle => {
      const car = cycle.carregamento;
      const des = cycle.descarga;
      const carStatus: ManifestStatus = car?.status || 'AUSENTE';
      const desStatus: ManifestStatus = des?.status || 'AUSENTE';
      
      const start = new Date(cycle.dataCriacao);
      const aging_horas = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));

      const divergencia_ativa = carStatus === 'DIVERGENTE' || desStatus === 'DIVERGENTE';
      
      // REGRAS DE TIPO DE PENDÊNCIA (HIERARQUIA)
      let tipo_pendencia: TransferPendencyType = 'OK';
      let pendente = true;

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
        id: cycle.romaneio,
        origem_filial: cycle.filialOrigem,
        destino_filial: cycle.filialDestino,
        created_at: cycle.dataCriacao,
        motorista: cycle.motorista,
        veiculo: cycle.veiculo,
        carga_status: carStatus,
        descarga_status: desStatus,
        divergencia_ativa,
        tipo_pendencia,
        pendente,
        aging_horas,
        totalNfs: cycle.totalNfs,
        totalVolume: cycle.totalVolume
      };
    });
  },

  /**
   * Estatísticas agrupadas por Filial de Origem
   */
  getFilialStats: (cycles: TransferCycle[]): FilialOperationalStats[] => {
    const map = new Map<string, any>();

    cycles.forEach(c => {
      const f = c.origem_filial;
      if (!map.has(f)) {
        map.set(f, { 
          filial: f, total: 0, concluidas: 0, pendentes: 0,
          pOrigem: 0, pDestino: 0, pDivergencia: 0,
          agingSum: 0, maiorAging: 0 
        });
      }
      const s = map.get(f)!;
      s.total++;
      if (!c.pendente) {
        s.concluidas++;
      } else {
        s.pendentes++;
        s.agingSum += c.aging_horas;
        if (c.aging_horas > s.maiorAging) s.maiorAging = c.aging_horas;
        
        if (c.tipo_pendencia === 'ORIGEM') s.pOrigem++;
        if (c.tipo_pendencia === 'DESTINO') s.pDestino++;
        if (c.tipo_pendencia === 'DIVERGENCIA') s.pDivergencia++;
      }
    });

    return Array.from(map.values()).map(s => ({
      filial: s.filial,
      total: s.total,
      concluidas: s.concluidas,
      pendentes: s.pendentes,
      pOrigem: s.pOrigem,
      pDestino: s.pDestino,
      pDivergencia: s.pDivergencia,
      agingMedio: s.pendentes > 0 ? Math.round(s.agingSum / s.pendentes) : 0,
      maiorAging: s.maiorAging
    })).sort((a, b) => b.pendentes - a.pendentes);
  },

  getGeneralOperationalStatus: (cycles: TransferCycle[]) => {
    const pendingCount = cycles.filter(c => c.pendente).length;
    const total = cycles.length;
    if (total === 0) return { label: 'SEM DADOS', color: 'bg-gray-400', desc: 'Aguardando importação' };

    const rate = (pendingCount / total) * 100;
    if (rate > 30) return { label: 'CRÍTICO', color: 'bg-red-600', desc: 'Alto volume de pendências na rede' };
    if (rate > 15) return { label: 'ATENÇÃO', color: 'bg-yellow-500', desc: 'Pendências acima da meta' };
    return { label: 'ESTÁVEL', color: 'bg-green-600', desc: 'Operação fluindo normalmente' };
  },

  calculateScore: (data: ETrackRecord[], manifests: OperationalManifest[]): LogiCheckScore => {
    const cycles = AnalysisService.getTransferCycles(manifests);
    if (cycles.length === 0) return { score: 0, label: 'Sem Dados', color: 'text-gray-400' };
    const concluidas = cycles.filter(c => !c.pendente).length;
    const rate = (concluidas / cycles.length) * 100;
    return { score: Math.round(rate), label: rate > 80 ? 'Saudável' : 'Atenção', color: rate > 80 ? 'text-green-600' : 'text-yellow-600' };
  },

  getInsights: (data: ETrackRecord[]): OperationalInsight[] => [],
  getComparison: (data: ETrackRecord[]) => ({ diff: 0, trend: 'stable' }),
  getRadarAlert: (manifests: OperationalManifest[]) => {
    const cycles = AnalysisService.getTransferCycles(manifests);
    const pending = cycles.filter(c => c.pendente).length;
    return { severityLevel: pending > 10 ? 2 : 0, count: pending, oldest: 0, statusText: `${pending} pendentes`, styleClass: '', iconColor: '' };
  },
  getGeneralStatus: (score: number, radarSeverity: number) => ({ status: 'OK', color: 'bg-green-600', textColor: 'text-white', description: '' })
};