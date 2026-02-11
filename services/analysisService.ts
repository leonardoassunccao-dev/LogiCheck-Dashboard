import { ETrackRecord, OperationalInsight, LogiCheckScore } from '../types';

export const AnalysisService = {
  calculateScore: (data: ETrackRecord[]): LogiCheckScore => {
    if (data.length === 0) return { score: 0, label: 'Sem Dados', color: 'text-gray-400' };

    // Critério 1: Equilíbrio de Conferentes (Desvio Padrão)
    const conferenteMap: Record<string, number> = {};
    data.forEach(d => conferenteMap[d.conferidoPor] = (conferenteMap[d.conferidoPor] || 0) + 1);
    const volumes = Object.values(conferenteMap);
    const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const variance = volumes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / volumes.length;
    const balanceFactor = Math.max(0, 100 - (Math.sqrt(variance) / avg) * 50);

    // Critério 2: Volumetria
    const totalNfs = data.reduce((acc, curr) => acc + curr.nfColetadas, 0);
    const volumeFactor = Math.min(100, (totalNfs / (data.length * 10)) * 100);

    const score = Math.round((balanceFactor * 0.6) + (volumeFactor * 0.4));

    if (score > 80) return { score, label: 'Operação Excelente', color: 'text-green-500' };
    if (score > 60) return { score, label: 'Operação Estável', color: 'text-blue-500' };
    if (score > 40) return { score, label: 'Atenção Necessária', color: 'text-yellow-500' };
    return { score, label: 'Crítico', color: 'text-red-500' };
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
  }
};