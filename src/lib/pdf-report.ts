import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ReportHeader {
  title: string;
  subtitle?: string;
  period: string;
  generatedBy?: string;
}

interface TableColumn {
  header: string;
  key: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string;
}

interface TableData {
  [key: string]: any;
}

interface SummaryItem {
  label: string;
  value: string | number;
  color?: [number, number, number]; // RGB
}

// Color palette
const COLORS = {
  primary: [12, 59, 51] as [number, number, number],      // #0c3b33
  secondary: [15, 74, 63] as [number, number, number],    // #0f4a3f
  accent: [20, 184, 166] as [number, number, number],     // #14b8a6
  success: [16, 185, 129] as [number, number, number],    // #10b981
  danger: [239, 68, 68] as [number, number, number],      // #ef4444
  warning: [245, 158, 11] as [number, number, number],    // #f59e0b
  text: [30, 41, 59] as [number, number, number],         // #1e293b
  textLight: [100, 116, 139] as [number, number, number], // #64748b
  border: [226, 232, 240] as [number, number, number],    // #e2e8f0
  bgLight: [248, 250, 252] as [number, number, number],   // #f8fafc
  white: [255, 255, 255] as [number, number, number],
};

export function createProfessionalPDF(
  header: ReportHeader,
  columns: TableColumn[],
  data: TableData[],
  summary: SummaryItem[],
  filename: string
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Helper functions
  const setColor = (color: [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const setFillColor = (color: [number, number, number]) => {
    doc.setFillColor(color[0], color[1], color[2]);
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, color = COLORS.border, width = 0.5) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, fill?: [number, number, number], border?: [number, number, number]) => {
    if (fill) {
      setFillColor(fill);
      doc.rect(x, yPos, w, h, 'F');
    }
    if (border) {
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.setLineWidth(0.5);
      doc.rect(x, yPos, w, h, 'S');
    }
  };

  // ===== HEADER SECTION =====
  // Background header
  drawRect(0, 0, pageWidth, 45, COLORS.primary);

  // Logo placeholder (lingkaran dengan inisial)
  setFillColor(COLORS.accent);
  doc.circle(margin + 12, 22, 10, 'F');
  setColor(COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('KS', margin + 12, 25, { align: 'center' });

  // Clinic name
  setColor(COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('KlinikSehat', margin + 28, 18);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Klinik Pratama Terpercaya', margin + 28, 25);

  // Address
  doc.setFontSize(7);
  doc.text('Jl. Kesehatan No. 123, Kota Sehat | Telp: (021) 1234-5678', margin + 28, 32);

  // Report date (right side)
  doc.setFontSize(8);
  const reportDate = format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: id });
  doc.text(`Dicetak: ${reportDate}`, pageWidth - margin, 18, { align: 'right' });

  y = 55;

  // ===== REPORT TITLE =====
  setColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(header.title, pageWidth / 2, y, { align: 'center' });
  y += 6;

  if (header.subtitle) {
    setColor(COLORS.textLight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(header.subtitle, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // Period
  setColor(COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Periode: ${header.period}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Decorative line
  drawLine(margin + 30, y, pageWidth - margin - 30, y, COLORS.accent, 1.5);
  y += 8;

  // ===== SUMMARY SECTION =====
  if (summary.length > 0) {
    const summaryBoxWidth = contentWidth;
    const summaryBoxHeight = 28;
    const itemWidth = summaryBoxWidth / summary.length;

    // Summary box background
    drawRect(margin, y, summaryBoxWidth, summaryBoxHeight, COLORS.bgLight, COLORS.border);

    summary.forEach((item, index) => {
      const itemX = margin + (index * itemWidth);

      // Vertical divider (except first)
      if (index > 0) {
        drawLine(itemX, y + 4, itemX, y + summaryBoxHeight - 4, COLORS.border);
      }

      // Label
      setColor(COLORS.textLight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(item.label.toUpperCase(), itemX + itemWidth / 2, y + 10, { align: 'center' });

      // Value
      const valueColor = item.color || COLORS.primary;
      setColor(valueColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(String(item.value), itemX + itemWidth / 2, y + 20, { align: 'center' });
    });

    y += summaryBoxHeight + 8;
  }

  // ===== TABLE SECTION =====
  const tableStartY = y;
  const rowHeight = 8;
  const headerHeight = 10;
  const maxRowsPerPage = Math.floor((pageHeight - y - 30) / rowHeight);

  // Table header
  drawRect(margin, y, contentWidth, headerHeight, COLORS.primary);
  setColor(COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  let xPos = margin + 2;
  columns.forEach((col) => {
    const align = col.align || 'left';
    if (align === 'center') {
      doc.text(col.header, xPos + col.width / 2, y + 7, { align: 'center' });
    } else if (align === 'right') {
      doc.text(col.header, xPos + col.width - 2, y + 7, { align: 'right' });
    } else {
      doc.text(col.header, xPos, y + 7);
    }
    xPos += col.width;
  });

  y += headerHeight;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let rowCount = 0;
  let pageIndex = 1;

  data.forEach((row, rowIndex) => {
    // Check if we need a new page
    if (rowCount >= maxRowsPerPage) {
      // Footer for current page
      drawPageFooter(doc, pageWidth, pageHeight, margin, pageIndex);
      doc.addPage();
      pageIndex++;
      y = margin;

      // Re-draw header on new page
      drawRect(margin, y, contentWidth, headerHeight, COLORS.primary);
      setColor(COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);

      xPos = margin + 2;
      columns.forEach((col) => {
        const align = col.align || 'left';
        if (align === 'center') {
          doc.text(col.header, xPos + col.width / 2, y + 7, { align: 'center' });
        } else if (align === 'right') {
          doc.text(col.header, xPos + col.width - 2, y + 7, { align: 'right' });
        } else {
          doc.text(col.header, xPos, y + 7);
        }
        xPos += col.width;
      });

      y += headerHeight;
      rowCount = 0;
    }

    // Alternating row background
    if (rowIndex % 2 === 0) {
      drawRect(margin, y, contentWidth, rowHeight, COLORS.white);
    } else {
      drawRect(margin, y, contentWidth, rowHeight, COLORS.bgLight);
    }

    // Row border bottom
    drawLine(margin, y + rowHeight, margin + contentWidth, y + rowHeight, COLORS.border, 0.3);

    // Row data
    setColor(COLORS.text);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    xPos = margin + 2;
    columns.forEach((col) => {
      let value = row[col.key];
      if (col.format) {
        value = col.format(value, row);
      } else if (value === null || value === undefined) {
        value = '-';
      }

      const align = col.align || 'left';
      if (align === 'center') {
        doc.text(String(value).substring(0, 30), xPos + col.width / 2, y + 5.5, { align: 'center' });
      } else if (align === 'right') {
        doc.text(String(value).substring(0, 30), xPos + col.width - 2, y + 5.5, { align: 'right' });
      } else {
        doc.text(String(value).substring(0, 30), xPos, y + 5.5);
      }
      xPos += col.width;
    });

    y += rowHeight;
    rowCount++;
  });

  // Table bottom border
  drawLine(margin, y, margin + contentWidth, y, COLORS.primary, 1);

  // ===== FOOTER =====
  drawPageFooter(doc, pageWidth, pageHeight, margin, pageIndex);

  // Save
  doc.save(filename);

  return doc;
}

function drawPageFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  pageNumber: number
) {
  const footerY = pageHeight - 15;

  // Footer line
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  // Footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
  doc.text('KlinikSehat - Sistem Manajemen Klinik', margin, footerY);

  doc.text(`Halaman ${pageNumber}`, pageWidth / 2, footerY, { align: 'center' });

  const printDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: id });
  doc.text(printDate, pageWidth - margin, footerY, { align: 'right' });
}

// ===== VISIT REPORT =====
export function generateVisitReportPDF(
  data: any[],
  stats: {
    totalKunjungan: number;
    totalSelesai: number;
    totalDibatalkan: number;
    rataHarian: number;
  },
  dateFrom: string,
  dateTo: string,
  doctorFilter?: string,
  poliFilter?: string
) {
  const columns: TableColumn[] = [
    { header: 'No', key: 'no', width: 10, align: 'center' },
    { header: 'Tanggal', key: 'tanggal', width: 25 },
    { header: 'No. RM', key: 'rm', width: 22 },
    { header: 'Pasien', key: 'pasien', width: 35 },
    { header: 'Poli', key: 'poli', width: 25 },
    { header: 'Dokter', key: 'dokter', width: 30 },
    { header: 'Status', key: 'status', width: 22, align: 'center' },
  ];

  const tableData = data.map((row, i) => ({
    no: String(i + 1),
    tanggal: format(new Date(row.created_at), 'dd/MM/yyyy'),
    rm: row.patient?.medical_record_number || '-',
    pasien: row.patient_name || '-',
    poli: row.poli?.name || '-',
    dokter: row.doctor_name || '-',
    status: row.status === 'selesai' ? 'Selesai' : row.status === 'dibatalkan' ? 'Dibatalkan' : 'Menunggu',
  }));

  const summary: SummaryItem[] = [
    { label: 'Total Kunjungan', value: stats.totalKunjungan, color: COLORS.primary },
    { label: 'Selesai', value: stats.totalSelesai, color: COLORS.success },
    { label: 'Dibatalkan', value: stats.totalDibatalkan, color: COLORS.danger },
    { label: 'Rata-rata/Hari', value: stats.rataHarian, color: COLORS.accent },
  ];

  let subtitle = 'Laporan data kunjungan pasien';
  if (doctorFilter) subtitle += ` - Dokter: ${doctorFilter}`;
  if (poliFilter) subtitle += ` - Poli: ${poliFilter}`;

  createProfessionalPDF(
    {
      title: 'LAPORAN KUNJUNGAN KLINIK',
      subtitle,
      period: `${format(new Date(dateFrom), 'dd MMMM yyyy', { locale: id })} - ${format(new Date(dateTo), 'dd MMMM yyyy', { locale: id })}`,
    },
    columns,
    tableData,
    summary,
    `laporan-kunjungan-${dateFrom}-${dateTo}.pdf`
  );
}

// ===== FINANCE REPORT =====
export function generateFinanceReportPDF(
  data: any[],
  stats: {
    total: number;
    paid: number;
    unpaid: number;
    totalRevenue: number;
    totalExamination: number;
    totalAdmin: number;
    totalMedicine: number;
  },
  dateFrom: string,
  dateTo: string
) {
  const columns: TableColumn[] = [
    { header: 'No', key: 'no', width: 10, align: 'center' },
    { header: 'Tanggal', key: 'tanggal', width: 22 },
    { header: 'No. Antrian', key: 'antrian', width: 20, align: 'center' },
    { header: 'Pasien', key: 'pasien', width: 30 },
    { header: 'Poli', key: 'poli', width: 22 },
    { header: 'Pemeriksaan', key: 'biayaPeriksa', width: 25, align: 'right' },
    { header: 'Obat', key: 'biayaObat', width: 25, align: 'right' },
    { header: 'Total', key: 'total', width: 28, align: 'right' },
    { header: 'Status', key: 'status', width: 18, align: 'center' },
  ];

  const tableData = data.map((row, i) => ({
    no: String(i + 1),
    tanggal: format(new Date(row.created_at), 'dd/MM/yyyy'),
    antrian: row.queue?.queue_number || '-',
    pasien: row.patient_name || '-',
    poli: row.queue?.poli?.name || '-',
    biayaPeriksa: `Rp ${(row.examination_fee || 0).toLocaleString('id-ID')}`,
    biayaObat: `Rp ${(row.medicine_total || 0).toLocaleString('id-ID')}`,
    total: `Rp ${(row.total_amount || 0).toLocaleString('id-ID')}`,
    status: row.status === 'dibayar' ? 'Dibayar' : 'Belum',
  }));

  // Add totals row
  tableData.push({
    no: '',
    tanggal: '',
    antrian: '',
    pasien: 'TOTAL',
    poli: '',
    biayaPeriksa: `Rp ${stats.totalExamination.toLocaleString('id-ID')}`,
    biayaObat: `Rp ${stats.totalMedicine.toLocaleString('id-ID')}`,
    total: `Rp ${stats.totalRevenue.toLocaleString('id-ID')}`,
    status: '',
  });

  const summary: SummaryItem[] = [
    { label: 'Total Transaksi', value: stats.total, color: COLORS.primary },
    { label: 'Sudah Dibayar', value: stats.paid, color: COLORS.success },
    { label: 'Belum Dibayar', value: stats.unpaid, color: COLORS.warning },
    { label: 'Total Pendapatan', value: `Rp ${stats.totalRevenue.toLocaleString('id-ID')}`, color: COLORS.accent },
  ];

  createProfessionalPDF(
    {
      title: 'LAPORAN KEUANGAN KLINIK',
      subtitle: 'Rekapitulasi pembayaran dan pendapatan',
      period: `${format(new Date(dateFrom), 'dd MMMM yyyy', { locale: id })} - ${format(new Date(dateTo), 'dd MMMM yyyy', { locale: id })}`,
    },
    columns,
    tableData,
    summary,
    `laporan-keuangan-${dateFrom}-${dateTo}.pdf`
  );
}
