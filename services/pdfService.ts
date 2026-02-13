import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ETrackRecord, DriverIssue, OperationalManifest } from '../types';

const MARSALA = '#955251';
const GRAY = '#4B5563';

const formatDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
};

const addHeader = (doc: jsPDF, title: string, subtitle: string) => {
  doc.setFillColor(MARSALA);
  doc.rect(0, 0, 210, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${formatDate(new Date())}`, 196, 13, { align: 'right' });
  
  doc.setTextColor(GRAY);
  doc.setFontSize(12);
  doc.text(subtitle, 14, 30);
};

const addFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128); // Neutral Gray
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Position at bottom center of A4 (210mm width, 297mm height)
    // y=290 ensures it's at the very bottom but legible
    doc.text('NODO Studio • Tecnologia aplicada à logística', 105, 290, { align: 'center' });
  }
};

export const PDFService = {
  generateDashboardPDF: (data: ETrackRecord[]) => {
    const doc = new jsPDF();
    const totalNfs = data.reduce((acc, curr) => acc + curr.nfColetadas, 0);
    const uniqueDrivers = new Set(data.map(d => d.motorista)).size;
    const uniqueFiliais = new Set(data.map(d => d.filial)).size;
    
    // Header
    addHeader(doc, 'LogiCheck Dashboard', 'Relatório Gerencial de Operação');

    // KPIs Grid
    const kpiData = [
      ['Total Registros', 'Total NFs', 'Motoristas', 'Filiais'],
      [data.length.toString(), totalNfs.toLocaleString('pt-BR'), uniqueDrivers.toString(), uniqueFiliais.toString()]
    ];

    autoTable(doc, {
      startY: 35,
      head: [kpiData[0]],
      body: [kpiData[1]],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold' },
      styles: { halign: 'center', fontSize: 12 }
    });

    // Ranking Data Logic (Recreating dashboard logic)
    const stats: Record<string, number> = {};
    const driverStats: Record<string, number> = {};
    const filialStats: Record<string, number> = {};

    data.forEach(d => {
      // Conferente
      if (d.conferidoPor && d.conferidoPor !== 'N/A') {
        stats[d.conferidoPor] = (stats[d.conferidoPor] || 0) + d.nfColetadas;
      }
      // Driver
      driverStats[d.motorista] = (driverStats[d.motorista] || 0) + d.nfColetadas;
      // Filial
      filialStats[d.filial] = (filialStats[d.filial] || 0) + d.nfColetadas;
    });

    const topConferentes = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((item, i) => [`${i + 1}º`, item[0], item[1].toLocaleString()]);

    const topDrivers = Object.entries(driverStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((item, i) => [`${i + 1}º`, item[0], item[1].toLocaleString()]);

    const topFiliais = Object.entries(filialStats)
      .sort((a, b) => b[1] - a[1])
      .map((item, i) => [`${i + 1}º`, item[0], item[1].toLocaleString()]);

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    // Table: Top Conferentes
    doc.setFontSize(12);
    doc.setTextColor(MARSALA);
    doc.text('Top 5 Conferentes (Volume NFs)', 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 2,
      head: [['Pos', 'Nome', 'Volume NFs']],
      body: topConferentes,
      theme: 'striped',
      headStyles: { fillColor: MARSALA },
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;

    // Table: Top Motoristas
    doc.text('Top 10 Motoristas (Volume NFs)', 14, finalY);
    autoTable(doc, {
      startY: finalY + 2,
      head: [['Pos', 'Motorista', 'Volume NFs']],
      body: topDrivers,
      theme: 'striped',
      headStyles: { fillColor: [31, 41, 55] }, // Dark gray
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;

    // Check for page break
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }

    // Table: Filiais
    doc.text('Volume por Filial', 14, finalY);
    autoTable(doc, {
      startY: finalY + 2,
      head: [['Pos', 'Filial', 'Volume NFs']],
      body: topFiliais,
      theme: 'striped',
      headStyles: { fillColor: [31, 41, 55] },
    });

    // Add Signature to all pages
    addFooter(doc);

    // Save
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`LogiCheck_Dashboard_${dateStr}.pdf`);
  },

  generatePendenciasPDF: (issues: DriverIssue[], filterText: string) => {
    const doc = new jsPDF();
    
    // Calculate Summary
    const totalOccurrences = issues.length;
    const totalNfs = issues.reduce((acc, curr) => acc + curr.qtdNaoBipadas, 0);
    
    // Rankings
    const counts: Record<string, number> = {};
    const volumes: Record<string, number> = {};
    
    issues.forEach(i => {
      counts[i.motorista] = (counts[i.motorista] || 0) + 1;
      volumes[i.motorista] = (volumes[i.motorista] || 0) + i.qtdNaoBipadas;
    });

    const topRecurrent = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map((item, i) => [`${i + 1}º`, item[0], item[1].toString()]);

    const topVolume = Object.entries(volumes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map((item, i) => [`${i + 1}º`, item[0], item[1].toString()]);

    // Header
    addHeader(doc, 'LogiCheck Pendências', `Relatório de Ocorrências - Filtro: ${filterText}`);

    // KPIs
    const kpiData = [
        ['Total Ocorrências', 'Total NFs Não Bipadas'],
        [totalOccurrences.toString(), totalNfs.toString()]
    ];

    autoTable(doc, {
      startY: 35,
      head: [kpiData[0]],
      body: [kpiData[1]],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold' },
      styles: { halign: 'center', fontSize: 12 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    // Rankings Side by Side
    doc.setFontSize(11);
    doc.setTextColor(MARSALA);
    doc.text('Top 5 - Motoristas Mais Recorrentes', 14, finalY);
    
    autoTable(doc, {
        startY: finalY + 2,
        head: [['Pos', 'Motorista', 'Ocorrências']],
        body: topRecurrent,
        theme: 'striped',
        headStyles: { fillColor: MARSALA },
        tableWidth: 90,
        margin: { left: 14 }
    });

    const table1Y = (doc as any).lastAutoTable.finalY;
    
    doc.text('Top 5 - Maior Volume (NFs)', 115, finalY);
    autoTable(doc, {
        startY: finalY + 2,
        head: [['Pos', 'Motorista', 'Qtd NFs']],
        body: topVolume,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55] },
        tableWidth: 80,
        margin: { left: 115 }
    });
    
    const table2Y = (doc as any).lastAutoTable.finalY;
    finalY = Math.max(table1Y, table2Y) + 10;

    // Full Table
    doc.setFontSize(12);
    doc.text('Detalhamento das Ocorrências', 14, finalY);
    
    const tableBody = issues.map(issue => [
        new Date(issue.timestamp).toLocaleString('pt-BR'),
        issue.motorista,
        issue.placa,
        issue.qtdNaoBipadas.toString(),
        issue.filial,
        issue.observacao || '-'
    ]);

    autoTable(doc, {
        startY: finalY + 2,
        head: [['Data/Hora', 'Motorista', 'Placa', 'NFs', 'Filial', 'Obs']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81] },
        styles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 30 },
            5: { cellWidth: 50 }
        }
    });

    // Add Signature
    addFooter(doc);

    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`LogiCheck_Pendencias_${dateStr}.pdf`);
  },

  generateRomaneiosPDF: (manifests: OperationalManifest[]) => {
    const doc = new jsPDF();

    // --- Calculations ---
    const total = manifests.length;
    const pending = manifests.filter(m => m.status === 'PENDENTE');
    const done = manifests.filter(m => m.status === 'CONFERIDO');
    const oldestPendingDays = pending.length > 0 ? Math.max(...pending.map(m => m.diasEmAberto)) : 0;
    
    // Pending by Filial
    const filialMap: Record<string, number> = {};
    pending.forEach(m => {
      const filial = m.filialOrigem || 'N/A';
      filialMap[filial] = (filialMap[filial] || 0) + 1;
    });
    const byFilial = Object.entries(filialMap)
      .sort((a, b) => b[1] - a[1])
      .map(entry => [entry[0], entry[1].toString()]);

    // Aging Buckets
    const agingMap = {
      '0-1 dias': 0,
      '2-3 dias': 0,
      '4-7 dias': 0,
      '8+ dias': 0
    };
    pending.forEach(m => {
      const days = m.diasEmAberto;
      if (days <= 1) agingMap['0-1 dias']++;
      else if (days <= 3) agingMap['2-3 dias']++;
      else if (days <= 7) agingMap['4-7 dias']++;
      else agingMap['8+ dias']++;
    });
    const byAging = Object.entries(agingMap).map(entry => [entry[0], entry[1].toString()]);

    // Critical List (4+ days)
    const criticalList = pending
      .filter(m => m.diasEmAberto >= 4)
      .sort((a, b) => b.diasEmAberto - a.diasEmAberto)
      .map(m => [
        m.diasEmAberto.toString() + ' dias',
        m.filialOrigem,
        m.romaneio,
        m.motorista.substring(0, 20), // Truncate name
        m.totalNfs.toString(),
        m.totalVolume.toLocaleString('pt-BR', {maximumFractionDigits: 1})
      ]);

    // --- PDF Generation ---

    addHeader(doc, 'Relatório de Romaneios', 'Controle Operacional e Pendências');

    // 1. Summary Table
    autoTable(doc, {
      startY: 35,
      head: [['Total Romaneios', 'Pendentes', 'Conferidos', 'Pendência + Antiga']],
      body: [[
        total.toString(),
        pending.length.toString(),
        done.length.toString(),
        `${oldestPendingDays} dias`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold' },
      styles: { halign: 'center', fontSize: 12 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 12;

    // 2. Side by Side: Filial & Aging
    doc.setFontSize(11);
    doc.setTextColor(MARSALA);
    
    // Left: Filial
    doc.text('Pendências por Filial', 14, finalY);
    autoTable(doc, {
      startY: finalY + 2,
      head: [['Filial', 'Qtd']],
      body: byFilial,
      theme: 'striped',
      headStyles: { fillColor: MARSALA },
      tableWidth: 85,
      margin: { left: 14 }
    });
    
    const filialY = (doc as any).lastAutoTable.finalY;

    // Right: Aging
    doc.text('Aging (Dias em Aberto)', 110, finalY);
    autoTable(doc, {
      startY: finalY + 2,
      head: [['Período', 'Qtd']],
      body: byAging,
      theme: 'striped',
      headStyles: { fillColor: [31, 41, 55] },
      tableWidth: 85,
      margin: { left: 110 }
    });

    const agingY = (doc as any).lastAutoTable.finalY;
    finalY = Math.max(filialY, agingY) + 12;

    // 3. Critical List
    doc.setFontSize(12);
    doc.setTextColor(MARSALA);
    doc.text(`Romaneios Críticos (+4 dias em aberto) - ${criticalList.length} itens`, 14, finalY);

    if (criticalList.length > 0) {
      autoTable(doc, {
        startY: finalY + 3,
        head: [['Dias', 'Filial', 'Romaneio', 'Motorista', 'NFs', 'Vol']],
        body: criticalList,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], textColor: 255 }, // Red Header for critical
        styles: { fontSize: 9 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [220, 38, 38] }
        }
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(GRAY);
      doc.text('Nenhum romaneio crítico encontrado.', 14, finalY + 10);
    }

    addFooter(doc);

    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`LogiCheck_Romaneios_${dateStr}.pdf`);
  },

  generateDrillDownPDF: (title: string, head: string[][], body: string[][]) => {
    const doc = new jsPDF();
    addHeader(doc, `Detalhe: ${title}`, 'Extração de Dados - LogiCheck Dashboard');
    
    autoTable(doc, {
      startY: 35,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: MARSALA, textColor: 255 },
      styles: { fontSize: 9 },
    });

    // Add Signature
    addFooter(doc);

    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`LogiCheck_Detalhe_${safeTitle}_${dateStr}.pdf`);
  }
};