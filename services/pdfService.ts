import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ETrackRecord, DriverIssue, RadarTransferencia, FilialOperationalStats } from '../types';
import { AnalysisService } from './analysisService';

const MARSALA = '#955251';
const BLACK = '#111827';
const GRAY_DARK = '#374151';

const formatDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const addFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`© 2026 LogiCheck · NODO Studio — Tecnologia aplicada à Logística`, 105, 290, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
  }
};

export const PDFService = {
  /**
   * EXPORTADOR RADAR OPERACIONAL
   * Gera relatório multipágina completo
   */
  generateRadarFullPDF: (radarData: RadarTransferencia[], statsFiliais: FilialOperationalStats[], dateStart: string, dateEnd: string) => {
    const doc = new jsPDF();
    const now = new Date();
    const pendentes = radarData.filter(c => c.pendente);
    const concluidas = radarData.length - pendentes.length;
    const opStatus = AnalysisService.getGeneralOperationalStatus(radarData);

    // --- PÁGINA 1: CAPA E RESUMO ---
    doc.setFillColor(MARSALA);
    doc.rect(0, 0, 210, 80, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('Relatório — Radar Operacional', 14, 40);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${dateStart || 'Início'} até ${dateEnd || 'Hoje'}`, 14, 52);
    doc.text(`Gerado em: ${formatDate(now)}`, 14, 60);

    doc.setTextColor(BLACK);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Executivo do Fluxo', 14, 95);

    const kpiRows = [
      ['Total de Transferências', radarData.length.toString()],
      ['Ciclos Concluídos', concluidas.toString()],
      ['Ciclos Pendentes (Total)', pendentes.length.toString()],
      ['Pendência na Origem', pendentes.filter(p => p.tipo_pendencia === 'ORIGEM').length.toString()],
      ['Pendência no Destino', pendentes.filter(p => p.tipo_pendencia === 'DESTINO').length.toString()],
      ['Divergências Ativas', pendentes.filter(p => p.tipo_pendencia === 'DIVERGENCIA').length.toString()],
      ['Status Operacional Atual', opStatus.label],
      ['Aging Médio Global', `${Math.round(pendentes.reduce((a, b) => a + b.aging_horas, 0) / (pendentes.length || 1))}h`],
      ['Maior Aging Ativo', `${pendentes.length > 0 ? Math.max(...pendentes.map(p => p.aging_horas)) : 0}h`]
    ];

    autoTable(doc, {
      startY: 100,
      head: [['Métrica Operacional', 'Valor']],
      body: kpiRows,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', width: 100 }, 1: { halign: 'right' } }
    });

    // --- PÁGINA 2: TABELA POR FILIAL ---
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(MARSALA);
    doc.text('Pendentes por Origem (Filial)', 14, 25);

    const filialRows = statsFiliais.map(s => [
      s.filial,
      s.total_pendentes.toString(),
      s.origem_count.toString(),
      s.destino_count.toString(),
      s.divergencia_count.toString(),
      `${s.aging_medio}h`,
      `${s.maior_aging}h`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Filial Origem', 'Total Pend.', 'Origem', 'Destino', 'Diverg.', 'Aging Méd.', 'Maior A.']],
      body: filialRows,
      theme: 'grid',
      headStyles: { fillColor: MARSALA },
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
    });

    // --- PÁGINA 3+: LISTA DETALHADA ---
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(MARSALA);
    doc.text('Transferências Pendentes (Detalhe)', 14, 25);

    const sortedDetailed = pendentes.sort((a,b) => {
      if (a.tipo_pendencia === 'DIVERGENCIA' && b.tipo_pendencia !== 'DIVERGENCIA') return -1;
      if (b.tipo_pendencia === 'DIVERGENCIA' && a.tipo_pendencia !== 'DIVERGENCIA') return 1;
      return b.aging_horas - a.aging_horas;
    });

    const detailedRows = sortedDetailed.map(c => [
      c.id_transferencia,
      `${c.origem_filial} > ${c.destino_filial}`,
      c.carga_status,
      c.descarga_status,
      c.tipo_pendencia,
      `${c.aging_horas}h`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['ID Romaneio', 'Fluxo', 'Carga', 'Descarga', 'Pendência', 'Aging']],
      body: detailedRows,
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
    doc.save(`Radar_Operacional_${dateStart || 'total'}_${dateEnd || 'total'}.pdf`);
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
