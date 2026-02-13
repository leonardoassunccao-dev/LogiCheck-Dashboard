
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ETrackRecord, DriverIssue, RadarTransferencia, FilialOperationalStats } from '../types';
import { AnalysisService } from './analysisService';

const MARSALA = '#955251';
const BLACK = '#111827';

const addFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`© 2026 LogiCheck · NODO Studio — Tecnologia aplicada à Logística`, 105, 290, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: 'right' });
  }
};

export const PDFService = {
  generateRadarFullPDF: (radarData: RadarTransferencia[], statsFiliais: FilialOperationalStats[], dateStart: string, dateEnd: string) => {
    console.log("PDF NEW", radarData.length);
    const doc = new jsPDF();
    const now = new Date();
    const pendentes = radarData.filter(c => c.pendente);
    const concluidas = radarData.length - pendentes.length;
    const opStatus = AnalysisService.getGeneralOperationalStatus(radarData);

    // PÁGINA 1: CABA E RESUMO
    doc.setFillColor(MARSALA);
    doc.rect(0, 0, 210, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.text('Relatório — Radar Operacional', 14, 40);
    doc.setFontSize(12);
    doc.text(`Período: ${dateStart || 'Início'} até ${dateEnd || 'Hoje'}`, 14, 52);
    doc.text(`Gerado em: ${now.toLocaleString()}`, 14, 60);

    doc.setTextColor(BLACK);
    doc.setFontSize(16);
    doc.text('1. Resumo Geral do Fluxo', 14, 95);

    const kpiRows = [
      ['Total de Transferências', radarData.length.toString()],
      ['Ciclos Concluídos', concluidas.toString()],
      ['Ciclos Pendentes', pendentes.length.toString()],
      ['Pendência Origem', pendentes.filter(p => p.tipo_pendencia === 'ORIGEM').length.toString()],
      ['Pendência Destino', pendentes.filter(p => p.tipo_pendencia === 'DESTINO').length.toString()],
      ['Divergências', pendentes.filter(p => p.tipo_pendencia === 'DIVERGENCIA').length.toString()],
      ['Status da Rede', opStatus.label],
      ['Aging Médio', `${Math.round(pendentes.reduce((a, b) => a + b.aging_horas, 0) / (pendentes.length || 1))}h`]
    ];

    autoTable(doc, {
      startY: 102,
      head: [['Métrica Operacional', 'Valor']],
      body: kpiRows,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      columnStyles: { 1: { halign: 'right' } }
    });

    // PÁGINA 2: FILIAIS
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(MARSALA);
    doc.text('2. Pendentes por Origem (Filial)', 14, 25);

    // Fixed typo: s.fillial corrected to s.filial
    const filialBody = statsFiliais.map(s => [
      s.filial, s.total_pendentes.toString(), s.origem_count.toString(), s.destino_count.toString(), 
      s.divergencia_count.toString(), `${s.aging_medio}h`, `${s.maior_aging}h`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Filial', 'Pend.', 'Orig.', 'Dest.', 'Div.', 'Aging M.', 'M. Aging']],
      body: filialBody,
      headStyles: { fillColor: MARSALA },
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left' } }
    });

    // PÁGINA 3+: DETALHES
    doc.addPage();
    doc.setFontSize(16);
    doc.text('3. Lista de Transferências Pendentes', 14, 25);

    const sorted = pendentes.sort((a,b) => {
      if (a.tipo_pendencia === 'DIVERGENCIA' && b.tipo_pendencia !== 'DIVERGENCIA') return -1;
      if (b.tipo_pendencia === 'DIVERGENCIA' && a.tipo_pendencia !== 'DIVERGENCIA') return 1;
      return b.aging_horas - a.aging_horas;
    });

    const detailedBody = sorted.map(c => [
      c.id_transferencia, `${c.origem_filial} > ${c.destino_filial}`, c.carga_status, c.descarga_status, c.tipo_pendencia, `${c.aging_horas}h`
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Romaneio', 'Fluxo', 'Carga', 'Descarga', 'Status', 'Aging']],
      body: detailedBody,
      headStyles: { fillColor: [30, 30, 30] },
      styles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.text[0] === 'DIVERGENCIA') data.cell.styles.textColor = [200, 0, 0];
      }
    });

    addFooter(doc);
    doc.save(`Radar_Operacional_${dateStart || 'total'}_${dateEnd || 'total'}.pdf`);
  },

  generateDashboardPDF: (data: ETrackRecord[]) => {
    const doc = new jsPDF();
    autoTable(doc, { head: [['Data', 'Motorista', 'Veículo', 'NFs', 'Filial']], body: data.map(d => [d.conferenciaData, d.motorista, d.veiculo, d.nfColetadas, d.filial]) });
    doc.save('LogiCheck_Dashboard.pdf');
  },

  generatePendenciasPDF: (issues: DriverIssue[], filterText: string) => {
    const doc = new jsPDF();
    const body = issues.map(i => [new Date(i.timestamp).toLocaleString(), i.motorista, i.placa, i.qtdNaoBipadas, i.filial, i.observacao || '-']);
    autoTable(doc, { startY: 30, head: [['Data', 'Motorista', 'Placa', 'NFs', 'Filial', 'Obs']], body });
    doc.save('LogiCheck_Pendencias.pdf');
  },

  generateDrillDownPDF: (title: string, head: string[][], body: string[][]) => {
    const doc = new jsPDF();
    doc.text(title, 14, 20);
    autoTable(doc, { startY: 25, head, body });
    doc.save('LogiCheck_Detalhe.pdf');
  }
};
