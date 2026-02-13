import { ETrackRecord, OperationalInsight, LogiCheckScore, OperationalManifest } from '../types';

export const AnalysisService = {
  /**
   * CÁLCULO DE SAÚDE OPERACIONAL (Índice LogiCheck)
   * Fórmula: (Pilar 1 + Pilar 2 + Pilar 3) / 3
   * 
   * Pilar 1: Equilíbrio de Conferência (0-100) -> Baseado no desvio padrão de produtividade entre conferentes.
   * Pilar 2: Estabilidade de Volume (0-100) -> Baseado na regularidade do volume diário (CV - Coeficiente de Variação).
   * Pilar 3: Controle de Pendências (0-100) -> Baseado na quantidade e aging (tempo) dos romaneios pendentes.
   */
  calculateScore: (data: ETrackRecord[], manifests: OperationalManifest[]): LogiCheckScore => {
    // Se não há dados gerais E não há manifestos, score zero
    if (data.length === 0 && manifests.length === 0) {
        return { score: 0, label: 'Sem Dados', color: 'text-gray-400' };
    }

    // --- PILAR 1: Equilíbrio de Conferência ---
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
            // Penaliza desvios altos. CV = 1.0 (100% variação) gera score 50. CV = 0 gera score 100.
            balanceScore = Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / (avg || 1)) * 50));
        } else {
            balanceScore = 0; // Tem dados mas ninguém conferiu
        }
    }

    // --- PILAR 2: Estabilidade de Volume ---
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
            // Coeficiente de Variação (CV). Se variar 20% (0.2), perde 20 pontos.
            const cv = stdDev / (avgVol || 1);
            volumeStabilityScore = Math.max(0, Math.min(100, 100 - (cv * 100)));
        } else {
            // Se só tem 1 dia de dados, consideramos estável (100) ou neutro
            volumeStabilityScore = 100; 
        }
    } else {
        volumeStabilityScore = 0;
    }

    // --- PILAR 3: Controle de Pendências ---
    let pendingScore = 100;
    if (manifests.length > 0) {
        const pending = manifests.filter(m => m.status === 'PENDENTE');
        const count = pending.length;
        const maxAging = count > 0 ? Math.max(...pending.map(m => m.diasEmAberto)) : 0;
        
        // Fórmula de penalidade:
        // - Cada pendência: -2 pontos
        // - Cada dia de atraso do item mais velho: -5 pontos
        const penalty = (count * 2) + (maxAging * 5);
        pendingScore = Math.max(0, 100 - penalty);
    } else if (data.length > 0) {
        // Se tem dados importados mas não tem manifestos carregados, 
        // assumimos neutro ou ignoramos este pilar (média dos outros 2)? 
        // Para simplificar, mantemos 100 se não houver manifesto pendente acusado.
        pendingScore = 100; 
    } else {
        pendingScore = 0;
    }

    // --- CÁLCULO FINAL ---
    const finalScore = Math.round((balanceScore + volumeStabilityScore + pendingScore) / 3);

    // --- CLASSIFICAÇÃO (Cores solicitadas) ---
    // 80–100 → verde
    // 60–79 → amarelo
    // 0–59 → vermelho
    
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

    // Insight 1: Recordista de Volume
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

    // Insight 2: Pico de Operação (Data)
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

    // Insight 3: Eficiência de Filiais
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
    const pending = manifests.filter(m => m.status === 'PENDENTE');
    const count = pending.length;
    // Pega o maior aging dos pendentes
    const oldest = count > 0 ? Math.max(...pending.map(m => m.diasEmAberto)) : 0;

    // Definição de Nível Base (0 a 3)
    let severityLevel: 0 | 1 | 2 | 3 = 0; // 0: Neutral, 1: Low, 2: Med, 3: High

    if (count >= 16) severityLevel = 3;
    else if (count >= 6) severityLevel = 2;
    else if (count >= 1) severityLevel = 1;

    // Promoção de Severidade por Aging (Se +4 dias, sobe um nível, limitado a 3)
    if (count > 0 && oldest >= 4) {
       severityLevel = Math.min(severityLevel + 1, 3) as any;
    }

    // Definição de Textos e Estilos
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
    // 1. Critical: Radar High Risk OR Low Score
    if (radarSeverity === 3 || score < 50) {
        return {
            status: 'CRÍTICO',
            color: 'bg-red-600',
            textColor: 'text-white',
            description: 'Ação imediata necessária'
        };
    }
    
    // 2. Warning: Radar Medium Risk OR Medium Score
    if (radarSeverity === 2 || (score >= 50 && score <= 70)) {
        return {
            status: 'ATENÇÃO',
            color: 'bg-yellow-500',
            textColor: 'text-white',
            description: 'Monitore os indicadores'
        };
    }

    // 3. Stable
    return {
        status: 'ESTÁVEL',
        color: 'bg-green-600',
        textColor: 'text-white',
        description: 'Operação dentro da meta'
    };
  }
};