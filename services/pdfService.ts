import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ETrackRecord, DriverIssue, OperationalManifest, TransferCycle, FilialOperationalStats } from '../types';
import { AnalysisService } from './analysisService';

const MARSALA = '#955251';
const BLACK = '#111827';
const GRAY_DARK = '#374151';
const GRAY_LIGHT = '#9CA3AF';

const formatDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const addFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`© 2026 LogiCheck • NODO Studio — Tecnologia aplicada à Logística`, 105, 290, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
  }
};

export const PDFService = {
  /**
   * NOVO: Relatório Radar Operacional Completo conforme especificação TAREFA ÚNICA
   */
  generateRadarFullPDF: (cycles: TransferCycle[], statsFiliais: FilialOperationalStats[], dateStart: string, dateEnd: string) => {
    const doc = new jsPDF();
    const now = new Date();
    const pending = cycles.filter(c => c.statusGeral !== 'OK');
    const status = AnalysisService.getGeneralOperationalStatus(cycles);

    // --- PÁGINA 1: CAPA ---
    doc.setFillColor(MARSALA);
    doc.rect(0, 0, 210, 120, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.text('Relatório', 20, 50);
    doc.text('Radar Operacional', 20, 65);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Monitoramento de Fluxo e Transferências', 20, 80);

    // Period Box on Cover
    doc.setFillColor(255, 255, 255, 0.2);
    doc.roundedRect(20, 95, 120, 15, 2, 2, 'F');
    doc.setFontSize(10);
    doc.text(`Período: ${dateStart || 'Início'} a ${dateEnd || 'Hoje'}`, 25, 104);

    // Status Indicator on Cover
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Status Operacional: ${status.label}`, 20, 140);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY_DARK);
    doc.text(status.desc, 20, 148);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${formatDate(now)}`, 20, 270);
    doc.text(`LogiCheck Dashboard v1.0`, 20, 275);

    // --- PÁGINA 2: RESUMO EXECUTIVO ---
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(MARSALA);
    doc.text('01. Resumo Executivo', 14, 25);

    const concluidasCount = cycles.length - pending.length;
    const rate = cycles.length > 0 ? (concluidasCount / cycles.length) * 100 : 100;
    const avgAging = pending.length > 0 ? pending.reduce((a,b) => a + b.agingHours, 0) / pending.length : 0;
    const maxAging = pending.length > 0 ? Math.max(...pending.map(p => p.agingHours)) : 0;

    const kpiHead = [['Métrica', 'Valor']];
    const kpiBody = [
      ['Total de Transferências (Ciclos)', cycles.length.toString()],
      ['% de Conclusão', `${rate.toFixed(1)}%`],
      ['Total Pendentes', pending.length.toString()],
      ['Divergências Ativas', cycles.filter(c => c.statusGeral === 'PEND_DIVERGENCIA').length.toString()],
      ['Aging Médio (Pendentes)', `${Math.round(avgAging)}h`],
      ['Maior Aging Ativo', `${Math.floor(maxAging/24)}d ${maxAging % 24}h`]
    ];

    autoTable(doc, {
      startY: 35,
      head: kpiHead,
      body: kpiBody,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', width: 100 }, 1: { halign: 'right' } }
    });

    // Breakdown by Type
    const typeCount = {
      'Divergência': cycles.filter(c => c.statusGeral === 'PEND_DIVERGENCIA').length,
      'Aguard. Descarga': cycles.filter(c => c.statusGeral === 'PEND_DESTINO').length,
      'Aguard. Origem': cycles.filter(c => c.statusGeral === 'PEND_ORIGEM').length
    };

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Tipo de Pendência', 'Quantidade']],
      body: Object.entries(typeCount).map(([k,v]) => [k, v.toString()]),
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80] },
      styles: { halign: 'center' }
    });

    // --- PÁGINA 3+: ANÁLISE POR FILIAL ---
    doc.addPage();
    doc.setFontSize(18);
    doc.setTextColor(MARSALA);
    doc.text('02. Análise por Filial (Origem)', 14, 25);

    const filialBody = statsFiliais.map(s => [
      s.filial,
      s.total.toString(),
      s.concluidas.toString(),
      s.pendentes.toString(),
      s.pDivergencia.toString(),
      `${s.agingMedio}h`,
      `${Math.floor(s.maiorAging/24)}d`,
      s.saude.toString(),
      s.status
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Filial', 'Total', 'Concl.', 'Pend.', 'Div.', 'Aging M.', 'Maior A.', 'Saúde', 'Status']],
      body: filialBody,
      theme: 'striped',
      headStyles: { fillColor: MARSALA },
      styles: { fontSize: 8, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.column.index === 8) {
          const val = data.cell.text[0];
          if (val === 'CRÍTICO') data.cell.styles.textColor = [200, 0, 0];
          if (val === 'ATENÇÃO') data.cell.styles.textColor = [150, 100, 0];
        }
      }
    });

    // --- PÁGINA FINAL: TRANSFERÊNCIAS CRÍTICAS ---
    doc.addPage();
    doc.setFontSize(18);
    doc.setTextColor(MARSALA);
    doc.text('03. Listagem de Transferências Críticas', 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(GRAY_DARK);
    doc.text('Ordenado por nível de prioridade e tempo de abertura.', 14, 32);

    const criticalCycles = pending.sort((a,b) => {
      const p = { 'ALTA': 3, 'MEDIA': 2, 'BAIXA': 1 };
      return p[b.priority] - p[a.priority] || b.agingHours - a.agingHours;
    });

    const cycleBody = criticalCycles.map(c => [
      c.priority,
      c.id,
      `${c.filialOrigem} -> ${c.filialDestino}`,
      c.statusGeral.replace('PEND_', ''),
      c.agingHours.toString() + 'h',
      c.motorista.substring(0, 20)
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Prioridade', 'Romaneio', 'Fluxo', 'Status', 'Aging', 'Motorista']],
      body: cycleBody,
      theme: 'grid',
      headStyles: { fillColor: BLACK },
      styles: { fontSize: 8, cellPadding: 3 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0 && data.cell.text[0] === 'ALTA') {
           data.cell.styles.fillColor = [255, 235, 235];
           data.cell.styles.textColor = [150, 0, 0];
           data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    addFooter(doc);
    doc.save(`Radar_Operacional_${dateStart || 'total'}_${dateEnd || 'total'}.pdf`);
  },

  /** 
   * Legados e auxiliares mantidos conforme App 
   */
  generateDashboardPDF: (data: ETrackRecord[]) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('LogiCheck Dashboard - Resumo', 14, 20);
    const body = data.map(d => [
      new Date(d.conferenciaData).toLocaleDateString(),
      d.motorista,
      d.veiculo,
      d.nfColetadas,
      d.filial
    ]);
    autoTable(doc, {
      startY: 30,
      head: [['Data', 'Motorista', 'Veículo', 'NFs', 'Filial']],
      body
    });
    doc.save('LogiCheck_Dashboard.pdf');
  },

  generatePendenciasPDF: (issues: DriverIssue[], filterText: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('LogiCheck - Relatório de Pendências', 14, 20);
    doc.setFontSize(10);
    doc.text(`Filtros: ${filterText}`, 14, 28);
    
    const body = issues.map(i => [
      new Date(i.timestamp).toLocaleString(),
      i.motorista,
      i.placa,
      i.qtdNaoBipadas,
      i.filial,
      i.observacao || '-'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Data/Hora', 'Motorista', 'Placa', 'Qtd NFs', 'Filial', 'Observação']],
      body,
      styles: { fontSize: 8 }
    });
    doc.save('LogiCheck_Pendencias.pdf');
  },

  generateDrillDownPDF: (title: string, head: string[][], body: string[][]) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    autoTable(doc, {
      startY: 30,
      head,
      body,
      styles: { fontSize: 8 }
    });
    doc.save(`LogiCheck_${title.replace(/\s/g, '_')}.pdf`);
  }
};