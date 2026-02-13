import { ETrackRecord, OperationalInsight, LogiCheckScore, OperationalManifest, TransferCycle, TransferPendencyType } from '../types';

export const AnalysisService = {
  /**
   * Agrupa manifestos em Ciclos de Transferência
   */
  getTransferCycles: (manifests: OperationalManifest[]): TransferCycle[] => {
    const cyclesMap = new Map<string, TransferCycle>();
    const now = new Date();

    manifests.forEach(m => {
      // Identificador único do ciclo: Filial Origem + Romaneio
      // (Em transferências, o romaneio costuma ser o mesmo para carregar e descarregar)
      const cycleKey = `${m.filialOrigem}_${m.romaneio}`;
      
      if (!cyclesMap.has(cycleKey)) {
        cyclesMap.set(cycleKey, {
          id: m.romaneio,
          filialOrigem: m.filialOrigem,
          filialDestino: m.filialDestino,
          dataCriacao: m.dataIncRomaneio,
          motorista: m.motorista,
          veiculo: m.veiculo,
          statusGeral: 'CONCLUIDA',
          agingHours: 0,
          totalNfs: m.totalNfs,
          totalVolume: m.totalVolume
        });
      }

      const cycle = cyclesMap.get(cycleKey)!;
      const tipo = (m.tipo || '').toUpperCase();

      if (tipo.includes('CARREGAMENTO') || tipo.includes('SAIDA') || tipo.includes('SAÍDA')) {
        cycle.carregamento = m;
      } else if (tipo.includes('DESCARGA') || tipo.includes('ENTRADA') || tipo.includes('CHEGADA')) {
        cycle.descarga = m;
      } else {
        // Se não for explicitamente carga/descarga, tratamos como carregamento base se estiver vazio
        if (!cycle.carregamento) cycle.carregamento = m;
      }
    });

    // Classificação e Aging
    return Array.from(cyclesMap.values()).map(cycle => {
      const start = new Date(cycle.dataCriacao);
      cycle.agingHours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));

      let status: TransferPendencyType = 'CONCLUIDA';

      const car = cycle.carregamento;
      const des = cycle.descarga;

      // 1. DIVERGENCIA (Prioridade 1)
      const hasDivergence = (car?.status === 'DIVERGENTE') || (des?.status === 'DIVERGENTE');
      
      // 2. DESTINO (Prioridade 2)
      // Carregamento OK, mas descarga pendente ou inexistente
      const isPendingDestino = (car?.status === 'CONFERIDO') && (!des || des.status === 'PENDENTE');

      // 3. ORIGEM (Prioridade 3)
      // Carregamento pendente ou inexistente
      const isPendingOrigem = (!car || car.status === 'PENDENTE');

      if (hasDivergence) status = 'PEND_DIVERGENCIA';
      else if (isPendingDestino) status = 'PEND_DESTINO';
      else if (isPendingOrigem) status = 'PEND_ORIGEM';

      cycle.statusGeral = status;
      return cycle;
    });
  },

  calculateScore: (data: ETrackRecord[], manifests: OperationalManifest[]): LogiCheckScore => {
    if (data.length === 0 && manifests.length === 0) {
        return { score: 0, label: 'Sem Dados', color: 'text-gray-400' };
    }

    let balanceScore = 100;
    if (data.length > 0) {
        const conferenteMap: Record<string, number> = {};
        data.forEach(d => {
            if (d.conferidoPor && d.conferidoPor !== 'N/A') {
                conferenteMap[d.conferidoPor] = (conferenteMap[d.conferidoPor] || 0) + 1;
            }
        });
        const volumes = Object.values(conferenteMap);
        if (volumes.length > 0) {
            const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
            const variance = volumes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / volumes.length;
            balanceScore = Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / (avg || 1)) * 50));
        } else {
            balanceScore = 0;
        }
    }

    let volumeStabilityScore = 100;
    if (data.length > 0) {
        const dateMap: Record<string, number> = {};
        data.forEach(d => {
            const date = new Date(d.conferenciaData).toLocaleDateString();
            dateMap[date] = (dateMap[date] || 0) + d.nfColetadas;
        });
        const dailyVolumes = Object.values(dateMap);
        if (dailyVolumes.length > 1) {
            const avgVol = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
            const volVariance = dailyVolumes.reduce((a, b) => a + Math.pow(b - avgVol, 2), 0) / dailyVolumes.length;
            const stdDev = Math.sqrt(volVariance);
            const cv = stdDev / (avgVol || 1);
            volumeStabilityScore = Math.max(0, Math.min(100, 100 - (cv * 100)));
        } else {
            volumeStabilityScore = 100; 
        }
    } else {
        volumeStabilityScore = 0;
    }

    let pendingScore = 100;
    if (manifests.length > 0) {
        const pending = manifests.filter(m => m.status === 'PENDENTE' || m.status === 'DIVERGENTE');
        const count = pending.length;
        const maxAging = count > 0 ? Math.max(...pending.map(m => m.diasEmAberto)) : 0;
        const penalty = (count * 2) + (maxAging * 5);
        pendingScore = Math.max(0, 100 - penalty);
    } else if (data.length > 0) {
        pendingScore = 100; 
    } else {
        pendingScore = 0;
    }

    const finalScore = Math.round((balanceScore + volumeStabilityScore + pendingScore) / 3);
    
    let label = '';
    let color = '';

    if (finalScore >= 80) {
        label = 'Operação Saudável';
        color = 'text-green-600 dark:text-green-500';
    } else if (finalScore >= 60) {
        label = 'Atenção Necessária';
        color = 'text-yellow-600 dark:text-yellow-500';
    } else {
        label = 'Crítico / Instável';
        color = 'text-red-600 dark:text-red-500';
    }

    return { score: finalScore, label, color };
  },

  getInsights: (data: ETrackRecord[]): OperationalInsight[] => {
    if (data.length === 0) return [];
    const insights: OperationalInsight[] = [];

    const motoristaMap: Record<string, number> = {};
    data.forEach(d => motoristaMap[d.motorista] = (motoristaMap[d.motorista] || 0) + d.nfColetadas);
    const topMotorista = Object.entries(motoristaMap).sort((a, b) => b[1] - a[1])[0];
    
    if (topMotorista) {
      insights.push({
        type: 'neutral',
        title: 'Performance de Frota',
        description: `${topMotorista[0]} lidera o volume com ${topMotorista[1]} NFs processadas.`,
        drillDown: 'MOTORISTAS'
      });
    }

    const dateMap: Record<string, number> = {};
    data.forEach(d => {
      const date = new Date(d.conferenciaData).toLocaleDateString('pt-BR');
      dateMap[date] = (dateMap[date] || 0) + 1;
    });
    const topDate = Object.entries(dateMap).sort((a, b) => b[1] - a[1])[0];
    
    if (topDate) {
      insights.push({
        type: 'positive',
        title: 'Pico Operacional',
        description: `O dia ${topDate[0]} teve a maior concentração de romaneios (${topDate[1]}).`,
        drillDown: 'ROMANEIOS'
      });
    }

    const filiais = new Set(data.map(d => d.filial)).size;
    insights.push({
      type: filiais > 1 ? 'positive' : 'neutral',
      title: 'Distribuição Geográfica',
      description: `Operação ativa em ${filiais} filiais distintas.`,
      drillDown: 'FILIAIS'
    });

    return insights;
  },

  getComparison: (data: ETrackRecord[]) => {
    if (data.length < 2) return { diff: 0, trend: 'stable' };
    
    const sorted = [...data].sort((a, b) => new Date(a.conferenciaData).getTime() - new Date(b.conferenciaData).getTime());
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid).reduce((a, b) => a + b.nfColetadas, 0);
    const secondHalf = sorted.slice(mid).reduce((a, b) => a + b.nfColetadas, 0);
    
    const diff = firstHalf === 0 ? 0 : ((secondHalf - firstHalf) / firstHalf) * 100;
    return {
      diff: Math.abs(Math.round(diff)),
      trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable'
    };
  },

  getRadarAlert: (manifests: OperationalManifest[]) => {
    const pending = manifests.filter(m => m.status === 'PENDENTE' || m.status === 'DIVERGENTE');
    const count = pending.length;
    const oldest = count > 0 ? Math.max(...pending.map(m => m.diasEmAberto)) : 0;

    let severityLevel: 0 | 1 | 2 | 3 = 0; 

    if (count >= 16) severityLevel = 3;
    else if (count >= 6) severityLevel = 2;
    else if (count >= 1) severityLevel = 1;

    if (count > 0 && oldest >= 4) {
       severityLevel = Math.min(severityLevel + 1, 3) as any;
    }

    let statusText = 'Sem pendências no momento';
    let styleClass = 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    let iconColor = 'text-gray-400';
    
    switch (severityLevel) {
        case 1:
            statusText = 'Atenção: pendências baixas';
            styleClass = 'border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10';
            iconColor = 'text-yellow-600 dark:text-yellow-500';
            break;
        case 2:
            statusText = 'Alerta: pendências acumulando';
            styleClass = 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/10';
            iconColor = 'text-orange-600 dark:text-orange-500';
            break;
        case 3:
            statusText = 'Crítico: risco operacional';
            styleClass = 'border-l-4 border-l-red-600 bg-red-50 dark:bg-red-900/20';
            iconColor = 'text-red-600 dark:text-red-500 animate-pulse';
            break;
    }

    return {
        count,
        oldest,
        severityLevel,
        statusText,
        styleClass,
        iconColor
    };
  },

  getGeneralStatus: (score: number, radarSeverity: number) => {
    if (radarSeverity === 3 || score < 50) {
        return {
            status: 'CRÍTICO',
            color: 'bg-red-600',
            textColor: 'text-white',
            description: 'Ação imediata necessária'
        };
    }
    
    if (radarSeverity === 2 || (score >= 50 && score <= 70)) {
        return {
            status: 'ATENÇÃO',
            color: 'bg-yellow-500',
            textColor: 'text-white',
            description: 'Monitore os indicadores'
        };
    }

    return {
        status: 'ESTÁVEL',
        color: 'bg-green-600',
        textColor: 'text-white',
        description: 'Operação dentro da meta'
    };
  }
};