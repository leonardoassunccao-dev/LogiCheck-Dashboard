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
   * NOVO: Relatório Radar Operacional Completo conforme especificações
   */
  generateRadarFullPDF: (cycles: TransferCycle[], statsFiliais: FilialOperationalStats[], dateStart: string, dateEnd: string) => {
    const doc = new jsPDF();
    const now = new Date();
    const pendingList = cycles.filter(c => c.pendente);
    const concluidasCount = cycles.length - pendingList.length;
    const statusInfo = AnalysisService.getGeneralOperationalStatus(cycles);

    // --- PÁGINA 1: CAPA E RESUMO ---
    doc.setFillColor(MARSALA);
    doc.rect(0, 0, 210, 80, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('Relatório — Radar Operacional', 14, 40);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${dateStart || 'Início'} até ${dateEnd || 'Hoje'}`, 14, 52);
    doc.text(`Gerado em: ${formatDate(now)}`, 14, 60);

    doc.setTextColor(BLACK);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Geral do Fluxo', 14, 95);

    const kpiData = [
      ['Transferências Total', cycles.length.toString()],
      ['Ciclos Concluídos', concluidasCount.toString()],
      ['Ciclos Pendentes', pendingList.length.toString()],
      ['Pendência Origem', pendingList.filter(p => p.tipo_pendencia === 'ORIGEM').length.toString()],
      ['Pendência Destino', pendingList.filter(p => p.tipo_pendencia === 'DESTINO').length.toString()],
      ['Divergências Ativas', pendingList.filter(p => p.tipo_pendencia === 'DIVERGENCIA').length.toString()],
      ['Aging Médio (Pendentes)', `${Math.round(pendingList.reduce((a, b) => a + b.aging_horas, 0) / (pendingList.length || 1))}h`],
      ['Maior Aging Ativo', `${pendingList.length > 0 ? Math.max(...pendingList.map(p => p.aging_horas)) : 0}h`]
    ];

    autoTable(doc, {
      startY: 100,
      head: [['Indicador Operacional', 'Valor']],
      body: kpiData,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', width: 100 }, 1: { halign: 'right' } }
    });

    // --- PÁGINA 2: PENDENTES POR FILIAL ---
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(MARSALA);
    doc.text('Pendentes por Origem (Filial)', 14, 25);

    const filialBody = statsFiliais.map(s => [
      s.filial,
      s.pendentes.toString(),
      s.pOrigem.toString(),
      s.pDestino.toString(),
      s.pDivergencia.toString(),
      `${s.agingMedio}h`,
      `${s.maiorAging}h`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Filial Origem', 'Pend. Total', 'Origem', 'Destino', 'Diverg.', 'Aging Méd.', 'Maior A.']],
      body: filialBody,
      theme: 'grid',
      headStyles: { fillColor: MARSALA },
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
    });

    // --- PÁGINA 3+: DETALHAMENTO ANALÍTICO ---
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(MARSALA);
    doc.text('Transferências Pendentes (Detalhe)', 14, 25);

    const sortedPending = pendingList.sort((a,b) => {
      if (a.tipo_pendencia === 'DIVERGENCIA' && b.tipo_pendencia !== 'DIVERGENCIA') return -1;
      if (b.tipo_pendencia === 'DIVERGENCIA' && a.tipo_pendencia !== 'DIVERGENCIA') return 1;
      if (a.aging_horas !== b.aging_horas) return b.aging_horas - a.aging_horas;
      return 0;
    });

    const detailedBody = sortedPending.map(c => [
      c.id,
      `${c.origem_filial} > ${c.destino_filial}`,
      c.carga_status,
      c.descarga_status,
      c.tipo_pendencia,
      `${c.aging_horas}h`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['ID Romaneio', 'Fluxo', 'Carga', 'Descarga', 'Pendência', 'Aging']],
      body: detailedBody,
      theme: 'striped',
      headStyles: { fillColor: BLACK },
      styles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.text[0] === 'DIVERGENCIA') {
          data.cell.styles.textColor = [200, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    addFooter(doc);
    doc.save(`Radar_Operacional_${dateStart || 'Início'}_${dateEnd || 'Hoje'}.pdf`);
  },

  generateDashboardPDF: (data: ETrackRecord[]) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('LogiCheck Dashboard - Resumo', 14, 20);
    const body = data.map(d => [new Date(d.conferenciaData).toLocaleDateString(), d.motorista, d.veiculo, d.nfColetadas, d.filial]);
    autoTable(doc, { startY: 30, head: [['Data', 'Motorista', 'Veículo', 'NFs', 'Filial']], body });
    doc.save('LogiCheck_Dashboard.pdf');
  },

  generatePendenciasPDF: (issues: DriverIssue[], filterText: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('LogiCheck - Relatório de Pendências', 14, 20);
    // Fixed typo: changed the non-existent property access 'i.qtd NFs' to the correct 'i.qtdNaoBipadas' from the DriverIssue interface.
    const body = issues.map(i => [new Date(i.timestamp).toLocaleString(), i.motorista, i.placa, i.qtdNaoBipadas, i.filial, i.observacao || '-']);
    autoTable(doc, { startY: 35, head: [['Data/Hora', 'Motorista', 'Placa', 'Qtd NFs', 'Filial', 'Observação']], body, styles: { fontSize: 8 } });
    doc.save('LogiCheck_Pendencias.pdf');
  },

  generateDrillDownPDF: (title: string, head: string[][], body: string[][]) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    autoTable(doc, { startY: 30, head, body, styles: { fontSize: 8 } });
    doc.save(`LogiCheck_${title.replace(/\s/g, '_')}.pdf`);
  }
};
