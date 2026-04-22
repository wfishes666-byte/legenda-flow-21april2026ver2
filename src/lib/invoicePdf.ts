import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface InvoicePdfItem {
  item_name: string;
  unit: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface InvoicePdfData {
  invoice_number: string | null;
  invoice_date: string;
  outlet_name?: string;
  recipient?: string | null;
  status: string;
  total: number;
  notes?: string | null;
  items: InvoicePdfItem[];
}

const formatRp = (v: number) => `Rp ${(Number(v) || 0).toLocaleString('id-ID')}`;

/** Generate & download a single invoice as a clean A4 PDF document. */
export function exportInvoicePDF(inv: InvoicePdfData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ===== Header =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(inv.outlet_name || 'Outlet', margin, 29);
  doc.setTextColor(0);

  // Invoice meta box (right side)
  const metaX = pageWidth - margin - 70;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('No. Invoice', metaX, 22);
  doc.text('Tanggal', metaX, 28);
  doc.text('Status', metaX, 34);

  doc.setFont('helvetica', 'normal');
  doc.text(`: ${inv.invoice_number || '—'}`, metaX + 22, 22);
  doc.text(`: ${format(new Date(inv.invoice_date), 'dd/MM/yyyy')}`, metaX + 22, 28);
  doc.text(`: ${inv.status === 'paid' ? 'TERBAYAR' : 'BELUM DIBAYAR'}`, metaX + 22, 34);

  // Recipient
  let cursorY = 44;
  if (inv.recipient) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Kepada:', margin, cursorY);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(inv.recipient, margin, cursorY + 5);
    cursorY += 12;
  }

  // ===== Items table =====
  autoTable(doc, {
    startY: cursorY + 2,
    margin: { left: margin, right: margin },
    head: [['#', 'Nama Item', 'Satuan', 'Qty', 'Harga Satuan', 'Total']],
    body: inv.items.map((it, i) => [
      String(i + 1),
      it.item_name,
      it.unit,
      String(it.qty),
      formatRp(Number(it.unit_price)),
      formatRp(Number(it.total)),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  // ===== Total =====
  const finalY = (doc as any).lastAutoTable.finalY || cursorY + 20;
  const totalY = finalY + 8;

  doc.setDrawColor(200);
  doc.line(pageWidth - margin - 70, totalY - 4, pageWidth - margin, totalY - 4);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL', pageWidth - margin - 70, totalY + 2);
  doc.text(formatRp(inv.total), pageWidth - margin, totalY + 2, { align: 'right' });

  // ===== Notes =====
  if (inv.notes && inv.notes.trim()) {
    const notesY = totalY + 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Catatan:', margin, notesY);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(inv.notes, pageWidth - margin * 2);
    doc.text(lines, margin, notesY + 5);
  }

  // ===== Footer =====
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    margin,
    doc.internal.pageSize.getHeight() - 10,
  );

  const filename = `invoice-${inv.invoice_number || format(new Date(inv.invoice_date), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
