import { DbOrder } from '../types.js';

export const generateOrderHtml = (order: DbOrder, withHistory: boolean = false) => {
  const o = order.order;
  const total = o.total_pedido || 0;

  // Ensure exactly 15 rows
  const rows = Array.from({ length: 15 }).map((_, i) => {
    const art = o.articulos[i] || null;
    return `
      <tr>
        <td class="bold text-center">${i + 1}</td>
        <td class="bg-yellow bold text-center">${art?.unidad_medida || ''}</td>
        <td class="bold text-center">${art?.cantidad_solicitada || ''}</td>
        <td></td>
        <td class="text-center">${art?.codigo || ''}</td>
        <td class="text-left">${art?.descripcion || ''}</td>
        <td class="bold text-right">${Number(art?.precio_unitario || 0) > 0 ? '$' + Number(art.precio_unitario).toFixed(2) : ''}</td>
        <td class="bold text-right">${Number(art?.sub_total || 0) > 0 ? '$' + Number(art.sub_total).toFixed(2) : ''}</td>
      </tr>
    `;
  }).join('');

  const historyList = order.statusHistory || [];
  const historyHtml = withHistory && historyList.length > 0 ? `
    <div class="history">
      <h3>Trazabilidad del Pedido</h3>
      <ul>
        ${historyList.map(h => `
          <li class="history-item">
            <strong>${h.timestamp ? new Date(h.timestamp).toLocaleString() : '-'}</strong> - [${h.department || 'Sistema'}] ${h.status} por ${h.changedBy || 'Usuario'} 
            ${h.reason ? `(Motivo: ${h.reason})` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return `
    <div class="print-container">
      <div class="header-box">
        <div class="col-left">
          <div class="cell title-cell">
            <h2 class="title-logo">codizulca</h2>
            <span class="rif">RIF: J40987613-6</span>
          </div>
          <div class="cell bold border-top uppercase">
            RUTA: ${o.ruta || '-'}
          </div>
        </div>
        <div class="col-mid">
          <div class="cell bold uppercase" style="height: 50%;">
            CLIENTE: ${o.cliente || '-'}
          </div>
          <div class="cell border-top" style="height: 50%;">
            <!-- Empty -->
          </div>
        </div>
        <div class="col-right">
          <div class="cell-flex">
            <div class="label">FECHA:</div>
            <div class="value">${o.fecha || ''}</div>
          </div>
          <div class="cell-flex border-top">
            <div class="label">ID CLIENTE:</div>
            <div class="value bg-yellow bold">${o.id_cliente || ''}</div>
          </div>
          <div class="cell-flex border-top">
            <div class="label">Nº PEDIDO:</div>
            <div class="value bg-yellow bold red-text">${String(o.numero_pedido || '').padStart(5, '0')}</div>
          </div>
        </div>
      </div>

      <table class="main-table">
        <thead>
          <tr>
            <th rowspan="2" style="width: 4%;">Nº</th>
            <th colspan="2" style="width: 12%;">CANT. SOLICITADA</th>
            <th rowspan="2" style="width: 11%;">CANTIDAD<br/>DESPACHADA</th>
            <th rowspan="2" style="width: 9%;">CÓDIGO</th>
            <th rowspan="2">DESCRIPCION DEL PRODUCTO</th>
            <th rowspan="2" style="width: 10%;">PRECIO</th>
            <th rowspan="2" style="width: 12%;">SUB TOTAL</th>
          </tr>
          <tr>
            <th style="width: 6%;">UNID</th>
            <th style="width: 6%;">CANT</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td colspan="6" class="text-left uppercase">SUPERVISOR: ${o.supervisor || '-'}</td>
            <td class="bold text-right" style="border-right: 2px solid #000;">TOTAL:</td>
            <td class="bold text-right bg-yellow">$${total.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="5" class="text-left uppercase">CHOFER: ${o.chofer || '-'}</td>
            <td colspan="1" class="text-left uppercase">OBSERVACIONES: ${o.observaciones || '-'}</td>
            <td colspan="2" rowspan="2" class="text-center" style="font-size: 9px; color: #888; vertical-align: top;">APROBACIÓN CXC</td>
          </tr>
          <tr>
            <td colspan="5" class="text-left uppercase">CANTIDAD DE CESTAS: ${o.cantidad_cestas ?? '-'}</td>
            <td colspan="1" class="text-left uppercase"></td>
          </tr>
        </tbody>
      </table>

      ${historyHtml}
    </div>
  `;
};

export const getPrintStyles = () => `
  <style>
    @media print {
      @page { margin: 0.4cm; size: portrait; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 !important; margin: 0 !important; }
      .print-container { margin: 0 auto !important; page-break-inside: avoid; break-inside: avoid; }
      .page-break { page-break-after: always; break-after: page; margin-bottom: 0 !important; border: none !important; padding-bottom: 0 !important; }
      .page-break:last-child { page-break-after: auto; break-after: auto; }
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      margin: 0;
      padding: 16px;
      color: #000;
    }
    .print-container {
      max-width: 900px;
      margin: 0 auto 24px auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .page-break { margin-bottom: 24px; border-bottom: 2px dashed #ccc; padding-bottom: 24px; }
    .page-break:last-child { page-break-after: auto; border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    
    .header-box {
      display: flex;
      border: 2px solid #000;
      border-bottom: none;
    }
    .col-left { flex: 0 0 30%; border-right: 2px solid #000; display: flex; flex-direction: column; }
    .col-mid { flex: 1; border-right: 2px solid #000; display: flex; flex-direction: column; }
    .col-right { flex: 0 0 25%; display: flex; flex-direction: column; }
    
    .cell { padding: 4px 8px; }
    .cell-flex { display: flex; height: 33.333%; }
    .title-cell { flex: 1; }
    .border-top { border-top: 2px solid #000; }
    
    .title-logo { font-size: 22px; font-weight: 900; margin: 0; line-height: 1; letter-spacing: -1px; }
    .rif { font-size: 9px; font-weight: bold; }
    
    .label { flex: 0 0 40%; border-right: 2px solid #000; padding: 3px 6px; font-size: 9px; }
    .value { flex: 1; padding: 3px 6px; text-align: right; }
    
    .main-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
    }
    .main-table th, .main-table td {
      border: 1px solid #000;
      padding: 3.5px 4px;
    }
    .main-table th {
      font-size: 9px;
      font-weight: bold;
    }
    
    /* Stronger inner borders for structure */
    .main-table thead tr:last-child th { border-bottom: 2px solid #000; }
    .main-table tbody tr:nth-last-child(3) td { border-bottom: 2px solid #000; }
    .main-table tbody tr td:nth-child(5), .main-table tbody tr td:nth-child(6) { border-right: 2px solid #000; }
    
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .bg-yellow { background-color: #fff3cd !important; }
    .red-text { color: #d32f2f !important; }
    .uppercase { text-transform: uppercase; }
    
    .history { margin-top: 10px; font-size: 9.5px; border-top: 1px solid #ccc; padding-top: 6px; page-break-inside: avoid; break-inside: avoid; }
    .history h3 { margin: 0 0 4px 0; font-size: 10px; }
    .history ul { margin: 0; padding-left: 16px; }
    .history-item { margin-bottom: 2px; }
  </style>
`;
