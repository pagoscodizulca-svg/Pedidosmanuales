import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DbOrder } from '../types.js';

export const generateConsolidatedReport = (orders: DbOrder[], dateRange: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.setTextColor(226, 6, 19); // Codizulca Red
  doc.text('Codizulca ERP - Reporte de Pedidos Consolidados', 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 30);
  doc.text(`Filtro: ${dateRange}`, 14, 36);

  const tableData = orders.map(o => [
    `#${o.order.numero_pedido || 'N/A'}`,
    o.order.fecha,
    o.order.cliente,
    o.order.ruta || '-',
    o.status.replace('_', ' '),
    `$${(o.order.total_pedido || 0).toFixed(2)}`
  ]);

  const totalUSD = orders.reduce((sum, o) => sum + (o.order.total_pedido || 0), 0);

  autoTable(doc, {
    startY: 45,
    head: [['Pedido #', 'Fecha', 'Cliente', 'Ruta', 'Estado', 'Total ($)']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [8, 145, 178] }, // Codizulca Cyan
    foot: [['', '', '', '', 'TOTAL CONSOLIDADO', `$${totalUSD.toFixed(2)}`]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
  });

  doc.save(`Reporte_Pedidos_Codizulca_${new Date().getTime()}.pdf`);
};

import { generateOrderHtml, getPrintStyles } from './pdfTemplate';

export const printOrder = (order: DbOrder, withHistory: boolean) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pedido #${order.order.numero_pedido}</title>
        ${getPrintStyles()}
      </head>
      <body>
        ${generateOrderHtml(order, withHistory)}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};

export const printMultipleOrders = (orders: DbOrder[], withHistory: boolean) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Impresión por Lote (${orders.length} pedidos)</title>
        ${getPrintStyles()}
      </head>
      <body>
        ${orders.map((order, i) => `
          <div class="${i < orders.length - 1 ? 'page-break' : ''}">
            ${generateOrderHtml(order, withHistory)}
          </div>
        `).join('')}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};

