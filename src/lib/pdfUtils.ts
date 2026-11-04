import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DbOrder } from '../types.js';
import { VENDEDORES } from '../data/vendedores.js';
import {
  buildGroupedVendedorOptions,
  getZonasForVendedor,
  matchVendedor,
  normalizeNombre,
  VendedorOption,
} from '../utils/vendedorFilter.js';
import { generateOrderHtml, getPrintStyles } from './pdfTemplate';

interface StatusBucket {
  count: number;
  monto: number;
}

export interface TraceabilityMetrics {
  facturado: StatusBucket;
  pendienteFacturacion: StatusBucket;
  pendienteCxc: StatusBucket;
  otrosPendientes: StatusBucket;
  totalGeneral: StatusBucket;
}

interface ResolvedOrderEntry {
  dbOrder: DbOrder;
  vendedor: string;
  zonaRuta: string;
  monto: number;
  estadoLabel: string;
  bucketKey: 'facturado' | 'pendienteFacturacion' | 'pendienteCxc' | 'otrosPendientes';
}

interface ZonaGroup {
  zonaRuta: string;
  orders: ResolvedOrderEntry[];
  metrics: TraceabilityMetrics;
}

interface VendedorGroup {
  vendedor: string;
  zonas: ZonaGroup[];
  metrics: TraceabilityMetrics;
}

const KNOWN_GEOGRAPHIC_ZONES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bciudad\s+ojeda\b|\bojeda\b/i, label: 'CIUDAD OJEDA' },
  { pattern: /\bcab\s*\/\s*oje\b/i, label: 'CABIMAS / OJEDA' },
  { pattern: /\bcabimas\b/i, label: 'CABIMAS' },
  { pattern: /\bmenn?e\s*grande\b/i, label: 'MENEGRANDE' },
  { pattern: /\bbachaquero\b/i, label: 'BACHAQUERO' },
  { pattern: /\blagunillas\b/i, label: 'LAGUNILLAS' },
  { pattern: /\btia\s+juana\b/i, label: 'TIA JUANA' },
  { pattern: /\bsanta\s+rita\b/i, label: 'SANTA RITA' },
  { pattern: /\blos\s+puertos\b/i, label: 'LOS PUERTOS' },
  { pattern: /\bvilla\s+del\s+ros(?:ario)?\b/i, label: 'VILLA DEL ROSARIO' },
  { pattern: /\bmachiques\b/i, label: 'MACHIQUES' },
  { pattern: /\bla\s+concepcion\b/i, label: 'LA CONCEPCION' },
  { pattern: /\bla\s+paz\b/i, label: 'LA PAZ' },
  { pattern: /\bcarrasquero\b/i, label: 'CARRASQUERO' },
  { pattern: /\bsinamaica\b/i, label: 'SINAMAICA' },
  { pattern: /\bel\s+mojan\b/i, label: 'EL MOJAN' },
  { pattern: /\bsanta\s+cruz\b/i, label: 'SANTA CRUZ DE MARA' },
  { pattern: /\bmara\b/i, label: 'MARA' },
  { pattern: /\bla\s+ca[nñ]ada\b/i, label: 'LA CAÑADA' },
  { pattern: /\bpunto\s+fijo\b/i, label: 'PUNTO FIJO' },
  { pattern: /\bdabajuro\b/i, label: 'DABAJURO' },
  { pattern: /\bchuruguara\b/i, label: 'CHURUGUARA' },
  { pattern: /\burumaco\b/i, label: 'URUMACO' },
  { pattern: /\bmene\s+mauroa\b/i, label: 'MENE MAUROA' },
  { pattern: /\bcoro\b/i, label: 'CORO' },
  { pattern: /\bla\s+costa\b/i, label: 'LA COSTA' },
  { pattern: /\bsan\s+francisco\b/i, label: 'SAN FRANCISCO' },
  { pattern: /\blos\s+olivos\b/i, label: 'LOS OLIVOS' },
  { pattern: /\bla\s+limpia\b/i, label: 'LA LIMPIA' },
  { pattern: /\bsan\s+jacinto\b/i, label: 'SAN JACINTO' },
  { pattern: /\bcoromoto\b/i, label: 'COROMOTO' },
  { pattern: /\bamparo\b/i, label: 'AMPARO' },
  { pattern: /\bcurva\s+de\s+molina\b/i, label: 'CURVA DE MOLINA' },
  { pattern: /\bsabaneta\b/i, label: 'SABANETA' },
  { pattern: /\bdelicias\b/i, label: 'DELICIAS' },
  { pattern: /\bbella\s+vista\b/i, label: 'BELLA VISTA' },
  { pattern: /\b5\s+de\s+julio\b/i, label: '5 DE JULIO' },
];

function createEmptyMetrics(): TraceabilityMetrics {
  return {
    facturado: { count: 0, monto: 0 },
    pendienteFacturacion: { count: 0, monto: 0 },
    pendienteCxc: { count: 0, monto: 0 },
    otrosPendientes: { count: 0, monto: 0 },
    totalGeneral: { count: 0, monto: 0 },
  };
}

function classifyOrderStatus(statusRaw: string): {
  bucketKey: 'facturado' | 'pendienteFacturacion' | 'pendienteCxc' | 'otrosPendientes';
  estadoLabel: string;
} {
  const normalized = String(statusRaw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalized === 'COMPLETADO' || normalized === 'FACTURADO') {
    return { bucketKey: 'facturado', estadoLabel: 'FACTURADO' };
  }
  if (normalized === 'PENDIENTE_FACTURACION') {
    return { bucketKey: 'pendienteFacturacion', estadoLabel: 'PENDIENTE FACTURACION' };
  }
  if (normalized === 'PENDIENTE_CXC') {
    return { bucketKey: 'pendienteCxc', estadoLabel: 'PENDIENTE CXC' };
  }
  return {
    bucketKey: 'otrosPendientes',
    estadoLabel: normalized.replace(/_/g, ' ') || 'PENDIENTE',
  };
}

function addEntryToMetrics(metrics: TraceabilityMetrics, entry: ResolvedOrderEntry): void {
  metrics[entry.bucketKey].count += 1;
  metrics[entry.bucketKey].monto += entry.monto;
  metrics.totalGeneral.count += 1;
  metrics.totalGeneral.monto += entry.monto;
}

function formatMoney(amount: number): string {
  return `$${(Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Extrae el sufijo de Zona / Ruta cuando el string de `ruta` o `vendedor` viene compuesto
 * (ej. "OSCAR ORTIZ- CORO" -> "CORO", "J PABLO ARAUJO - CAB/OJE" -> "CABIMAS / OJEDA",
 * "JAIDER MEDINA - FOOD SERVICE NORTE" -> "FOOD SERVICE NORTE",
 * "DANIEL DEL GALLEGO FOOD SERVICE SUR" -> "FOOD SERVICE SUR").
 */
function extractCompositeZonaFromRawString(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed || /^oficina\s*-/i.test(trimmed)) return null;

  // Caso 1: Sufijo pegado "JOHNATAN SOTO VILLA DEL ROS"
  if (/villa\s+del\s+ros/i.test(trimmed)) {
    return 'VILLA DEL ROSARIO';
  }

  // Caso 2: Sufijo "FOOD SERVICE [NORTE|SUR|SENIOR]" con o sin guion
  const fsMatch = trimmed.match(/\b(fo+d\s+ser[fv]+ice(?:\s+(?:norte|sur|e?seni[nñ]?or))?)$/i);
  if (fsMatch && !/^fo+d\s+ser[fv]+ice/i.test(trimmed)) {
    return fsMatch[1]
      .replace(/fo+d\s+ser[fv]+ice/i, 'FOOD SERVICE')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  // Caso 3: Separador explícito "-" (ej. "OSCAR ORTIZ- CORO", "J PABLO ARAUJO - CAB/OJE", "CUENTAS CLAVE 2 - SAIRU VALLES")
  if (trimmed.includes('-')) {
    const normalizedCuentas = trimmed.replace(/\bcuentas\s+clave[sz]?\s*-\s*(\d+)\b/gi, 'CUENTAS CLAVE $1');
    if (normalizedCuentas.includes('-')) {
      const parts = normalizedCuentas
        .split(/\s*-\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const first = parts[0].toUpperCase();
        const last = parts[parts.length - 1].toUpperCase();
        if (/^CUENTAS\s+CLAVE\s+\d+$/i.test(first)) {
          return first;
        }
        if (/^CAB\s*\/\s*OJE$/i.test(last)) {
          return 'CABIMAS / OJEDA';
        }
        return last;
      }
    }
  }

  return null;
}

/**
 * Separa y resuelve de forma determinística el Vendedor y la Zona / Ruta de un pedido.
 * - Vendedor: aplica normalización canónica y fallback a "SIN VENDEDOR".
 * - Zona / Ruta: prioriza columna `rutas`/`zona`, luego sufijo compuesto en `ruta`,
 *   luego zonas configuradas del vendedor o geográficas en `observaciones`/`direccion_despacho`,
 *   con fallback a "SIN ZONA / RUTA". Nunca devuelve el nombre del vendedor como Zona/Ruta.
 */
export function resolveOrderVendedorAndZona(
  dbOrder: DbOrder,
  canonicalVendedores: VendedorOption[],
): { vendedor: string; zonaRuta: string } {
  const ord = dbOrder.order;
  const rawVendedorCandidate = String(
    ord.vendedores || ord.vendedor || ord.ruta || '',
  )
    .replace(/\bavd\.\s*maracaibo\b/gi, '')
    .trim();

  // 1. Resolver Vendedor
  let resolvedVendedor = '';
  if (rawVendedorCandidate && rawVendedorCandidate !== '-') {
    const matchedOption = canonicalVendedores.find((opt) =>
      matchVendedor(rawVendedorCandidate, opt.value),
    );
    if (matchedOption) {
      resolvedVendedor = matchedOption.label;
    } else {
      resolvedVendedor = rawVendedorCandidate
        .replace(/\s*-\s*(?:coro|la\s+costa|cab\s*\/\s*oje|food\s+service.*)$/i, '')
        .replace(/\s+villa\s+del\s+ros(?:ario)?$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    }
  }
  if (!resolvedVendedor || resolvedVendedor === '-') {
    resolvedVendedor = 'SIN VENDEDOR';
  }

  // 2. Resolver Zona / Ruta
  let resolvedZona = '';

  // 2a. Columna explícita `rutas` o `zona` en BD / OrderData
  const explicitRutaZona = String(ord.rutas || ord.zona || '').trim();
  if (
    explicitRutaZona &&
    explicitRutaZona !== '-' &&
    !matchVendedor(explicitRutaZona, resolvedVendedor)
  ) {
    resolvedZona = explicitRutaZona.toUpperCase();
  }

  // 2b. Si `ord.ruta` tiene un valor distinto al nombre del vendedor o un sufijo compuesto
  if (!resolvedZona) {
    const compositeFromRuta =
      extractCompositeZonaFromRawString(ord.ruta || '') ||
      extractCompositeZonaFromRawString(ord.vendedor || '');
    if (compositeFromRuta && !matchVendedor(compositeFromRuta, resolvedVendedor)) {
      resolvedZona = compositeFromRuta;
    } else if (
      ord.ruta &&
      ord.ruta.trim() !== '-' &&
      !matchVendedor(ord.ruta, resolvedVendedor) &&
      normalizeNombre(ord.ruta).join(' ') !== normalizeNombre(resolvedVendedor).join(' ')
    ) {
      const cleanRuta = ord.ruta.replace(/\bavd\.\s*maracaibo\b/gi, '').trim().toUpperCase();
      if (cleanRuta && !matchVendedor(cleanRuta, resolvedVendedor)) {
        resolvedZona = cleanRuta;
      }
    }
  }

  // 2c. Buscar entre las zonas asignadas al vendedor en `VENDEDORES` dentro de `observaciones` o `direccion_despacho`
  const searchContext = `${ord.observaciones || ''} ${ord.direccion_despacho || ''}`.trim();
  if (!resolvedZona && searchContext) {
    const sellerZones = getZonasForVendedor(resolvedVendedor, VENDEDORES);
    const matchedSellerZone = sellerZones.find((z) =>
      searchContext.toLowerCase().includes(z.toLowerCase()),
    );
    if (matchedSellerZone) {
      resolvedZona = matchedSellerZone.toUpperCase();
    }
  }

  // 2d. Buscar zonas geográficas conocidas en `observaciones` o `direccion_despacho`
  if (!resolvedZona && searchContext) {
    for (const geo of KNOWN_GEOGRAPHIC_ZONES) {
      if (geo.pattern.test(searchContext)) {
        resolvedZona = geo.label;
        break;
      }
    }
  }

  if (!resolvedZona || resolvedZona === '-') {
    resolvedZona = 'SIN ZONA / RUTA';
  }

  return { vendedor: resolvedVendedor, zonaRuta: resolvedZona };
}

export const generateConsolidatedReport = (orders: DbOrder[], dateRange: string) => {
  const doc = new jsPDF();
  const reportDateStr = new Date().toLocaleDateString('es-VE');
  const canonicalVendedores = buildGroupedVendedorOptions(orders, Object.keys(VENDEDORES));

  // 1. Construir agrupación jerárquica de 2 niveles: Vendedor -> Zona/Ruta
  const vendedorMap = new Map<string, Map<string, ResolvedOrderEntry[]>>();
  const globalMetrics = createEmptyMetrics();

  for (const dbOrder of orders) {
    const { vendedor, zonaRuta } = resolveOrderVendedorAndZona(dbOrder, canonicalVendedores);
    const monto = Number(dbOrder.order.total_pedido ?? dbOrder.order.monto_pedido ?? 0) || 0;
    const { bucketKey, estadoLabel } = classifyOrderStatus(dbOrder.status);

    const entry: ResolvedOrderEntry = {
      dbOrder,
      vendedor,
      zonaRuta,
      monto,
      estadoLabel,
      bucketKey,
    };

    addEntryToMetrics(globalMetrics, entry);

    if (!vendedorMap.has(vendedor)) {
      vendedorMap.set(vendedor, new Map());
    }
    const zonaMap = vendedorMap.get(vendedor)!;
    if (!zonaMap.has(zonaRuta)) {
      zonaMap.set(zonaRuta, []);
    }
    zonaMap.get(zonaRuta)!.push(entry);
  }

  // Ordenar Nivel 1 (Vendedores A-Z, dejando "SIN VENDEDOR" al final)
  const sortedVendedorNames = Array.from(vendedorMap.keys()).sort((a, b) => {
    if (a === 'SIN VENDEDOR') return 1;
    if (b === 'SIN VENDEDOR') return -1;
    return a.localeCompare(b, 'es');
  });

  const vendedorGroups: VendedorGroup[] = sortedVendedorNames.map((vendedor) => {
    const zonaMap = vendedorMap.get(vendedor)!;
    // Ordenar Nivel 2 (Zonas/Rutas A-Z, dejando "SIN ZONA / RUTA" al final)
    const sortedZonaNames = Array.from(zonaMap.keys()).sort((a, b) => {
      if (a === 'SIN ZONA / RUTA') return 1;
      if (b === 'SIN ZONA / RUTA') return -1;
      return a.localeCompare(b, 'es');
    });

    const vendedorMetrics = createEmptyMetrics();
    const zonas: ZonaGroup[] = sortedZonaNames.map((zonaRuta) => {
      const entries = zonaMap.get(zonaRuta)!.slice().sort((x, y) => {
        const numX = String(x.dbOrder.order.numero_pedido || '');
        const numY = String(y.dbOrder.order.numero_pedido || '');
        return numX.localeCompare(numY, 'es', { numeric: true });
      });
      const zonaMetrics = createEmptyMetrics();
      for (const e of entries) {
        addEntryToMetrics(zonaMetrics, e);
        addEntryToMetrics(vendedorMetrics, e);
      }
      return { zonaRuta, orders: entries, metrics: zonaMetrics };
    });

    return { vendedor, zonas, metrics: vendedorMetrics };
  });

  const drawCorporateHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(226, 6, 19); // Codizulca Red
    doc.text('Codizulca ERP - Reporte de Pedidos Consolidados', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(`Fecha de Reporte: ${reportDateStr}`, 14, 25);
    doc.text(`Filtro: ${dateRange}`, 14, 30);
  };

  // 2. Renderizar una página de inicio por cada Vendedor
  if (vendedorGroups.length === 0) {
    drawCorporateHeader();
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('No se encontraron pedidos para el lote seleccionado.', 14, 44);
  } else {
    vendedorGroups.forEach((vGroup, vIdx) => {
      if (vIdx > 0) {
        doc.addPage();
      }

      drawCorporateHeader();

      // Cintillo destacado del Vendedor
      doc.setFillColor(15, 23, 42); // Slate-900 corporativo
      doc.roundedRect(14, 34, 182, 10, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      const bannerText = `VENDEDOR: ${vGroup.vendedor}   |   Total Pedidos: ${vGroup.metrics.totalGeneral.count}   |   Monto Total: ${formatMoney(vGroup.metrics.totalGeneral.monto)}`;
      doc.text(bannerText, 18, 40.5);

      let currentY = 50;

      // Recorrer cada Zona / Ruta del Vendedor
      for (const zGroup of vGroup.zonas) {
        if (currentY > 245) {
          doc.addPage();
          drawCorporateHeader();
          currentY = 38;
        }

        // Subtítulo de sección para la Zona / Ruta
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY - 4.5, 182, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 128, 157); // #00809d
        doc.text(`ZONA / RUTA: ${zGroup.zonaRuta}`, 16, currentY);

        const tableBody = zGroup.orders.map((item) => [
          `#${item.dbOrder.order.numero_pedido || 'N/A'}`,
          item.dbOrder.order.fecha || '-',
          item.dbOrder.order.cliente || '-',
          item.zonaRuta,
          item.estadoLabel,
          formatMoney(item.monto),
        ]);

        const zm = zGroup.metrics;
        const subtotalLine =
          `Subtotal Zona ${zGroup.zonaRuta} -> Total: ${formatMoney(zm.totalGeneral.monto)} (${zm.totalGeneral.count}) | ` +
          `Facturado: ${formatMoney(zm.facturado.monto)} (${zm.facturado.count}) | ` +
          `Pend. Facturación: ${formatMoney(zm.pendienteFacturacion.monto)} (${zm.pendienteFacturacion.count}) | ` +
          `Pend. CxC: ${formatMoney(zm.pendienteCxc.monto)} (${zm.pendienteCxc.count})` +
          (zm.otrosPendientes.count > 0
            ? ` | Otros: ${formatMoney(zm.otrosPendientes.monto)} (${zm.otrosPendientes.count})`
            : '');

        autoTable(doc, {
          startY: currentY + 3,
          head: [['Pedido #', 'Fecha', 'Cliente', 'Ruta / Zona', 'Estado', 'Total ($)']],
          body: tableBody,
          foot: [[{ content: subtotalLine, colSpan: 6 }]],
          theme: 'grid',
          styles: { fontSize: 8.5, cellPadding: 2.2 },
          headStyles: { fillColor: [0, 128, 157], textColor: [255, 255, 255], fontStyle: 'bold' }, // #00809d
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 22 },
            2: { cellWidth: 56 },
            3: { cellWidth: 32 },
            4: { cellWidth: 26 },
            5: { cellWidth: 24, halign: 'right' },
          },
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8,
          },
          margin: { left: 14, right: 14, bottom: 18 },
        });

        currentY = ((doc as any).lastAutoTable?.finalY || currentY + 20) + 8;
      }

      // Cuadro de Auditoría del Vendedor al final de su sección
      if (currentY > 225) {
        doc.addPage();
        drawCorporateHeader();
        currentY = 38;
      }

      const vm = vGroup.metrics;
      const pct = (monto: number) =>
        vm.totalGeneral.monto > 0
          ? `${((monto / vm.totalGeneral.monto) * 100).toFixed(1)}%`
          : '0.0%';

      const sellerSummaryRows: any[][] = [
        ['FACTURADO', `${vm.facturado.count}`, formatMoney(vm.facturado.monto), pct(vm.facturado.monto)],
        [
          'PENDIENTE FACTURACIÓN',
          `${vm.pendienteFacturacion.count}`,
          formatMoney(vm.pendienteFacturacion.monto),
          pct(vm.pendienteFacturacion.monto),
        ],
        [
          'PENDIENTE CXC',
          `${vm.pendienteCxc.count}`,
          formatMoney(vm.pendienteCxc.monto),
          pct(vm.pendienteCxc.monto),
        ],
      ];

      if (vm.otrosPendientes.count > 0) {
        sellerSummaryRows.push([
          'OTROS PENDIENTES / NO FACTURADOS',
          `${vm.otrosPendientes.count}`,
          formatMoney(vm.otrosPendientes.monto),
          pct(vm.otrosPendientes.monto),
        ]);
      }

      autoTable(doc, {
        startY: currentY + 2,
        head: [
          [
            {
              content: `RESUMEN DE TRAZABILIDAD DEL VENDEDOR (${vGroup.vendedor})`,
              colSpan: 4,
              styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'left' },
            },
          ],
          ['Estado de Auditoría', 'Cant. Pedidos', 'Monto ($)', '% del Vendedor'],
        ],
        body: sellerSummaryRows,
        foot: [
          [
            'TOTAL VENDEDOR',
            `${vm.totalGeneral.count}`,
            formatMoney(vm.totalGeneral.monto),
            '100.0%',
          ],
        ],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.2 },
        headStyles: { fillColor: [0, 128, 157], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 82, fontStyle: 'bold' },
          1: { cellWidth: 32, halign: 'center' },
          2: { cellWidth: 38, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' },
        },
        footStyles: {
          fillColor: [226, 232, 240],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
        },
        margin: { left: 14, right: 14, bottom: 18 },
      });
    });

    // 3. Hoja Final de Consolidado Global (Auditoría General del Lote)
    doc.addPage();
    drawCorporateHeader();

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(14, 34, 182, 10, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `CONSOLIDADO GLOBAL - AUDITORÍA GENERAL DEL LOTE (${globalMetrics.totalGeneral.count} Pedidos | ${formatMoney(globalMetrics.totalGeneral.monto)})`,
      18,
      40.5,
    );

    const globalTableRows: any[][] = [];
    for (const vGroup of vendedorGroups) {
      for (const zGroup of vGroup.zonas) {
        const zm = zGroup.metrics;
        globalTableRows.push([
          vGroup.vendedor,
          zGroup.zonaRuta,
          `${zm.totalGeneral.count}`,
          formatMoney(zm.facturado.monto),
          formatMoney(zm.pendienteFacturacion.monto),
          formatMoney(zm.pendienteCxc.monto),
          formatMoney(zm.totalGeneral.monto),
        ]);
      }
    }

    autoTable(doc, {
      startY: 48,
      head: [
        [
          'Vendedor',
          'Zona/Ruta',
          'Cant. Pedidos',
          'Facturado ($)',
          'Pend. Facturación ($)',
          'Pend. CxC ($)',
          'Total ($)',
        ],
      ],
      body: globalTableRows,
      foot: [
        [
          'GRAN TOTAL DEL LOTE',
          '',
          `${globalMetrics.totalGeneral.count}`,
          formatMoney(globalMetrics.facturado.monto),
          formatMoney(globalMetrics.pendienteFacturacion.monto),
          formatMoney(globalMetrics.pendienteCxc.monto),
          formatMoney(globalMetrics.totalGeneral.monto),
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 128, 157], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 34 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      footStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      margin: { left: 14, right: 14, bottom: 18 },
    });
  }

  // 4. Numeración de páginas en el pie de página (Página X de Y) para control físico de auditoría
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setDrawColor(203, 213, 225);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Codizulca ERP - Control Físico de Auditoría de Pedidos', 14, pageHeight - 7.5);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 14, pageHeight - 7.5, {
      align: 'right',
    });
  }

  doc.save(`Reporte_Pedidos_Codizulca_${new Date().getTime()}.pdf`);
};

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

