import { OperationalManifest, TransferCycle, TransferPendencyType, PriorityLevel, FilialOperationalStats, ETrackRecord, LogiCheckScore, OperationalInsight } from '../types';

export const AnalysisService = {
  /**
   * Agrupa manifestos em Ciclos de Transferência (Transferência = Romaneio + Origem)
   */
  getTransferCycles: (manifests: OperationalManifest[]): TransferCycle[] => {
    const cyclesMap = new Map<string, TransferCycle>();
    const now = new Date();

    manifests.forEach(m => {
      // O ID da transferência é composto pelo número do romaneio e a filial de origem
      const cycleKey = `${m.filialOrigem}_${m.romaneio}`;
      
      if (!cyclesMap.has(cycleKey)) {
        cyclesMap.set(cycleKey, {
          id: m.romaneio,
          filialOrigem: m.filialOrigem,
          filialDestino: m.filialDestino,
          dataCriacao: m.dataIncRomaneio,
          motorista: m.motorista,
          veiculo: m.veiculo,
          statusGeral: 'OK',
          agingHours: 0,
          priority: 'BAIXA',
          totalNfs: m.totalNfs,
          totalVolume: m.totalVolume
        });
      }

      const cycle = cyclesMap.get(cycleKey)!;
      const tipo = (m.tipo || '').toUpperCase();

      // Mapeamento de Carregamento vs Descarga baseado no "Tipo" da linha do E-track
      if (tipo.includes('CARREGAMENTO') || tipo.includes('SAIDA') || tipo.includes('SAÍDA')) {
        cycle.carregamento = m;
      } else if (tipo.includes('DESCARGA') || tipo.includes('ENTRADA') || tipo.includes('CHEGADA')) {
        cycle.descarga = m;
      } else if (!cycle.carregamento) {
        cycle.carregamento = m;
      }
    });

    return Array.from(cyclesMap.values()).map(cycle => {
      const start = new Date(cycle.dataCriacao);
      cycle.agingHours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));

      const car = cycle.carregamento;
      const des = cycle.descarga;

      const carStatus = car?.status || 'AUSENTE';
      const desStatus = des?.status || 'AUSENTE';
      const hasDivergence = carStatus === 'DIVERGENTE' || desStatus === 'DIVERGENTE';

      // 1. CLASSIFICAÇÃO DE TIPO DE PENDÊNCIA
      let status: TransferPendencyType = 'OK';
      
      if (hasDivergence) {
        status = 'PEND_DIVERGENCIA';
      } else if (carStatus !== 'CONFERIDO') {
        status = 'PEND_ORIGEM';
      } else if (desStatus !== 'CONFERIDO') {
        status = 'PEND_DESTINO';
      }

      cycle.statusGeral = status;

      // 2. REGRAS DE PRIORIDADE
      if (status === 'PEND_DIVERGENCIA' && cycle.agingHours >= 24) {
        cycle.priority = 'ALTA';
      } else if (status === 'PEND_DESTINO' && cycle.agingHours >= 24) {
        cycle.priority = 'MEDIA';
      } else if (status === 'PEND_DIVERGENCIA' || (status !== 'OK' && cycle.agingHours >= 48)) {
        cycle.priority = 'ALTA';
      } else {
        cycle.priority = 'BAIXA';
      }

      return cycle;
    });
  },

  /**
   * Agrega estatísticas por Filial de Origem e calcula Saúde (0-100)
   */
  getFilialStats: (cycles: TransferCycle[]): FilialOperationalStats[] => {
    const map = new Map<string, any>();

    cycles.forEach(c => {
      const f = c.filialOrigem || 'N/A';
      if (!map.has(f)) {
        map.set(f, { 
          filial: f, total: 0, concluidas: 0, pendentes: 0,
          pOrigem: 0, pDestino: 0, pDivergencia: 0,
          agingSum: 0, maiorAging: 0 
        });
      }
      const s = map.get(f)!;
      s.total++;
      if (c.statusGeral === 'OK') {
        s.concluidas++;
      } else {
        s.pendentes++;
        s.agingSum += c.agingHours;
        if (c.agingHours > s.maiorAging) s.maiorAging = c.agingHours;
        
        if (c.statusGeral === 'PEND_ORIGEM') s.pOrigem++;
        if (c.statusGeral === 'PEND_DESTINO') s.pDestino++;
        if (c.statusGeral === 'PEND_DIVERGENCIA') s.pDivergencia++;
      }
    });

    return Array.from(map.values()).map(s => {
      const avgAging = s.pendentes > 0 ? s.agingSum / s.pendentes : 0;
      
      // ALGORITMO DE SAÚDE DA FILIAL: saude = 100 - (pendentes*2) - (pend_divergencia*5) - (aging_medio*0.5)
      let saude = 100 - (s.pendentes * 2) - (s.pDivergencia * 5) - (avgAging * 0.5);
      saude = Math.max(0, Math.min(100, Math.round(saude)));

      let status: 'ESTÁVEL' | 'ATENÇÃO' | 'CRÍTICO' = 'ESTÁVEL';
      if (saude < 60) status = 'CRÍTICO';
      else if (saude < 80) status = 'ATENÇÃO';

      return {
        ...s,
        agingMedio: Math.round(avgAging),
        saude,
        status
      };
    }).sort((a, b) => a.saude - b.saude);
  },

  /**
   * Avalia o status geral da rede de transporte
   */
  getGeneralOperationalStatus: (cycles: TransferCycle[]) => {
    const total = cycles.length;
    if (total === 0) return { label: 'SEM DADOS', color: 'bg-gray-400', desc: 'Aguardando importação' };

    const pending = cycles.filter(c => c.statusGeral !== 'OK');
    const pendingRate = (pending.length / total) * 100;
    const hasCriticalDivergence = pending.some(c => c.statusGeral === 'PEND_DIVERGENCIA' && c.agingHours > 48);

    // Regras: 
    // Crítico: pendentes > 35% OU divergência > 48h
    // Atenção: pendentes > 20% e <= 35%
    // Estável: pendentes <= 20% e sem divergência > 48h
    if (pendingRate > 35 || hasCriticalDivergence) {
      return { label: 'CRÍTICO', color: 'bg-red-600', desc: 'Rede congestionada ou com divergências críticas' };
    }
    if (pendingRate > 20) {
      return { label: 'ATENÇÃO', color: 'bg-yellow-500', desc: 'Volume de pendências acima da meta operacional' };
    }
    return { label: 'ESTÁVEL', color: 'bg-green-600', desc: 'Operação fluindo conforme planejado' };
  },

  calculateScore: (data: ETrackRecord[], manifests: OperationalManifest[]): LogiCheckScore => {
    if (data.length === 0 && manifests.length === 0) return { score: 0, label: 'Sem Dados', color: 'text-gray-400' };
    const cycles = AnalysisService.getTransferCycles(manifests);
    const concluidas = cycles.filter(c => c.statusGeral === 'OK').length;
    const rate = cycles.length > 0 ? (concluidas / cycles.length) * 100 : 100;
    
    let label = 'Operação Saudável';
    let color = 'text-green-600';
    if (rate < 60) { label = 'Crítico / Instável'; color = 'text-red-600'; }
    else if (rate < 80) { label = 'Atenção Necessária'; color = 'text-yellow-600'; }

    return { score: Math.round(rate), label, color };
  },

  getInsights: (data: ETrackRecord[]): OperationalInsight[] => {
    if (data.length === 0) return [];
    const topFilial = Object.entries(data.reduce((acc, curr) => {
      acc[curr.filial] = (acc[curr.filial] || 0) + curr.nfColetadas;
      return acc;
    }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0];

    return [{
      type: 'positive',
      title: 'Fluxo Principal',
      description: `Filial ${topFilial?.[0]} processou o maior volume de NFs no período (${topFilial?.[1]}).`,
      drillDown: 'FILIAIS'
    }];
  },

  getComparison: (data: ETrackRecord[]) => ({ diff: 0, trend: 'stable' }),
  getRadarAlert: (manifests: OperationalManifest[]) => {
    const cycles = AnalysisService.getTransferCycles(manifests);
    const pending = cycles.filter(c => c.statusGeral !== 'OK');
    return {
      severityLevel: pending.length > 20 ? 3 : pending.length > 10 ? 2 : pending.length > 0 ? 1 : 0,
      count: pending.length,
      oldest: pending.length > 0 ? Math.max(...pending.map(p => Math.floor(p.agingHours/24))) : 0,
      statusText: pending.length > 0 ? `${pending.length} ciclos em aberto` : 'Fluxo zerado',
      styleClass: '',
      iconColor: ''
    };
  },
  getGeneralStatus: (score: number, radarSeverity: number) => ({ status: 'OK', color: 'bg-green-600', textColor: 'text-white', description: '' })
};