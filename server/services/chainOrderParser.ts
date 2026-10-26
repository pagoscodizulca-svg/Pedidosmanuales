import crypto from 'crypto';
import type { ArticuloItem, OrderData, OrderStatus, StatusHistoryItem } from '../../src/types.js';
import { PRODUCTOS as CATALOGO_PRODUCTOS } from '../../src/data/productos.js';

export type ChainOrigin = 'ALKOSTO' | 'FAMILIA CENTER' | 'OTRA CADENA';

export interface ChainStoreDefinition {
  tag: string;
  codigo: string;
  codigoPadded: string;
  nombre: string;
  cadena: ChainOrigin;
  aliases: string[];
}

export const CHAIN_STORES_CATALOG: ChainStoreDefinition[] = [
  // --- ALKOSTO ---
  { tag: 'AK01', codigo: '7498', codigoPadded: '007498', nombre: 'ALKOSTO 1 - SAN FELIPE', cadena: 'ALKOSTO', aliases: ['ALKOSTO 1', 'ALKOSTO 01', 'SAN FELIPE', 'AK01', 'AK1', '7498', '007498'] },
  { tag: 'AK02', codigo: '7499', codigoPadded: '007499', nombre: 'ALKOSTO 2 - PLAZA BARALT', cadena: 'ALKOSTO', aliases: ['ALKOSTO 2', 'ALKOSTO 02', 'PLAZA BARALT', 'AK02', 'AK2', '7499', '007499'] },
  { tag: 'AK03', codigo: '7497', codigoPadded: '007497', nombre: 'ALKOSTO 3 - DELICIAS', cadena: 'ALKOSTO', aliases: ['ALKOSTO 3', 'ALKOSTO 03', 'DELICIAS', 'AK03', 'AK3', '7497', '007497'] },
  { tag: 'AK04', codigo: '7500', codigoPadded: '007500', nombre: 'ALKOSTO 4 - COROMOTO', cadena: 'ALKOSTO', aliases: ['ALKOSTO 4', 'ALKOSTO 04', 'COROMOTO', 'CIRCUNVALACION 2', 'AK04', 'AK4', '7500', '007500'] },
  { tag: 'AK05', codigo: '7502', codigoPadded: '007502', nombre: 'ALKOSTO 5 - CABIMAS', cadena: 'ALKOSTO', aliases: ['ALKOSTO 5', 'ALKOSTO 05', 'CABIMAS', 'AK05', 'AK5', '7502', '007502'] },
  { tag: 'AK06', codigo: '7501', codigoPadded: '007501', nombre: 'ALKOSTO 6 - LOS CACTUS', cadena: 'ALKOSTO', aliases: ['ALKOSTO 6', 'ALKOSTO 06', 'LOS CACTUS', 'SAN FRANCISCO', 'AK06', 'AK6', '7501', '007501'] },
  { tag: 'AK07', codigo: '7503', codigoPadded: '007503', nombre: 'ALKOSTO 7 - BELLA VISTA', cadena: 'ALKOSTO', aliases: ['ALKOSTO 7', 'ALKOSTO 07', 'BELLA VISTA', 'CURVA DE MOLINA', 'AK07', 'AK7', '7503', '007503'] },
  { tag: 'AK08', codigo: '7680', codigoPadded: '007680', nombre: 'ALKOSTO 8 - EL MILAGRO', cadena: 'ALKOSTO', aliases: ['ALKOSTO 8', 'ALKOSTO 08', 'EL MILAGRO', 'TRUJILLO', 'AK08', 'AK8', '7680', '007680'] },
  { tag: 'AK09', codigo: '7905', codigoPadded: '007905', nombre: 'ALKOSTO 9 - ANTIGUO NASA ZONA INDUSTRIAL', cadena: 'ALKOSTO', aliases: ['ALKOSTO 9', 'ALKOSTO 09', 'ANTIGUO NASA', 'ZONA INDUSTRIAL', 'AK09', 'AK9', '7905', '007905'] },
  { tag: 'AK10', codigo: '8306', codigoPadded: '008306', nombre: 'ALKOSTO 10 - LA LIMPIA', cadena: 'ALKOSTO', aliases: ['ALKOSTO 10', 'LA LIMPIA', 'AK10', '8160', '008160', '8306', '008306'] },
  { tag: 'AKOP', codigo: '1560', codigoPadded: '001560', nombre: 'ALKOSTO SEDE PRINCIPAL / AKOP', cadena: 'ALKOSTO', aliases: ['AKOP', 'ALKOSTO DONDE COMPRAR ES GANAR', '1560', '001560'] },

  // --- FAMILIA CENTER ---
  { tag: 'FC01', codigo: '7489', codigoPadded: '007489', nombre: 'FAMILIA CENTER 1 - PLAZA LAGO', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 1', 'FAMILIA CENTER 01', 'PLAZA LAGO', 'FC01', 'FC1', '7489', '007489'] },
  { tag: 'FC02', codigo: '7490', codigoPadded: '007490', nombre: 'FAMILIA CENTER 2 - URB MONTE CLARO', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 2', 'FAMILIA CENTER 02', 'MONTE CLARO', 'FC02', 'FC2', '7490', '007490'] },
  { tag: 'FC03', codigo: '7491', codigoPadded: '007491', nombre: 'FAMILIA CENTER 3', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 3', 'FAMILIA CENTER 03', 'FC03', 'FC3', '7491', '007491'] },
  { tag: 'FC04', codigo: '7492', codigoPadded: '007492', nombre: 'FAMILIA CENTER 4 - DR QUINTERO', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 4', 'FAMILIA CENTER 04', 'DR QUINTERO', 'FC04', 'FC4', '7492', '007492'] },
  { tag: 'FC05', codigo: '7493', codigoPadded: '007493', nombre: 'FAMILIA CENTER 5 - LA LAGO', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 5', 'FAMILIA CENTER 05', 'LA LAGO', 'FC05', 'FC5', '7493', '007493'] },
  { tag: 'FC06', codigo: '7494', codigoPadded: '007494', nombre: 'FAMILIA CENTER 6 - LOS OLIVOS', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 6', 'FAMILIA CENTER 06', 'LOS OLIVOS', 'FC06', 'FC6', '7494', '007494'] },
  { tag: 'FC07', codigo: '8229', codigoPadded: '008229', nombre: 'FAMILIA CENTER 7', cadena: 'FAMILIA CENTER', aliases: ['FAMILIA CENTER 7', 'FAMILIA CENTER 07', 'FC07', 'FC7', '8229', '008229'] },
  { tag: 'FCOP', codigo: '5373', codigoPadded: '005373', nombre: 'FAMILIA CENTER SEDE PRINCIPAL / FCOP', cadena: 'FAMILIA CENTER', aliases: ['FCOP', 'FAMILIA CENTER, C.A.', 'FAMILIA CENTER C.A.', '5373', '005373'] }
];

// Mapa de códigos de barra EAN-13 y códigos de cadena (Alkosto / Familia Center) a SKUs oficiales Codizulca
const CHAIN_CODE_TO_CODIZULCA_SKU: Record<string, { codigo: string; descripcion: string; unidad: string }> = {
  '7590377000077': { codigo: '001496', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR', unidad: 'BULTO' },
  '1496': { codigo: '001496', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR', unidad: 'BULTO' },
  '001496': { codigo: '001496', descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR', unidad: 'BULTO' },
  '1519': { codigo: '001519', descripcion: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR', unidad: 'BULTO' },
  '001519': { codigo: '001519', descripcion: 'MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR', unidad: 'BULTO' },
  '21': { codigo: '000021', descripcion: 'MORTADELA ESP D/POLLO CORRAL 1X12UNI', unidad: 'BULTO' },
  '000021': { codigo: '000021', descripcion: 'MORTADELA ESP D/POLLO CORRAL 1X12UNI', unidad: 'BULTO' },
  '4': { codigo: '000004', descripcion: 'MORTADELA DE POLLO DEL CORRAL 6 X 1KG', unidad: 'BULTO' },
  '000004': { codigo: '000004', descripcion: 'MORTADELA DE POLLO DEL CORRAL 6 X 1KG', unidad: 'BULTO' },
  '5412873178161': { codigo: '001360', descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG', unidad: 'BULTO' },
  '1360': { codigo: '001360', descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG', unidad: 'BULTO' },
  '001360': { codigo: '001360', descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG', unidad: 'BULTO' },
  '7591210000513': { codigo: '001091', descripcion: 'CREMA DE LECHE PURISIMA 6 X 500 GRS', unidad: 'BULTO' },
  '1463': { codigo: '001463', descripcion: 'MORT. SUPERIOR ASTURIAS X KG', unidad: 'KG' },
  '001463': { codigo: '001463', descripcion: 'MORT. SUPERIOR ASTURIAS X KG', unidad: 'KG' },
  '100929': { codigo: '001463', descripcion: 'MORT. SUPERIOR ASTURIAS X KG', unidad: 'KG' },
  '1512': { codigo: '001512', descripcion: 'MORT. PECHUGA DE PAVO ASTURIAS X KG', unidad: 'KG' },
  '100881': { codigo: '001512', descripcion: 'MORT. PECHUGA DE PAVO ASTURIAS X KG', unidad: 'KG' },
  '1511': { codigo: '001511', descripcion: 'MORT. PECHUGA DE POLLO ASTURIAS X KG', unidad: 'KG' },
  '100882': { codigo: '001511', descripcion: 'MORT. PECHUGA DE POLLO ASTURIAS X KG', unidad: 'KG' },
  'QS': { codigo: '000096', descripcion: 'QUESO MOZZARELLA CORLASA X KG', unidad: 'KG' },
  '100281': { codigo: '000096', descripcion: 'QUESO MOZZARELLA CORLASA X KG', unidad: 'KG' }
};

const PRODUCT_CATALOG_MAP = new Map<string, string>();
if (Array.isArray(CATALOGO_PRODUCTOS)) {
  for (const p of CATALOGO_PRODUCTOS) {
    const id = String(p.id || '').trim().toUpperCase();
    if (id) {
      PRODUCT_CATALOG_MAP.set(id, p.descripcion);
      PRODUCT_CATALOG_MAP.set(id.padStart(6, '0'), p.descripcion);
    }
  }
}

export interface NormalizedChainOrderResult {
  id: string;
  numero_pedido: string;
  status: OrderStatus;
  cadena: ChainOrigin;
  hasFormatError: boolean;
  anomalies: string[];
  cxc_note?: string;
  orderData: OrderData;
  statusHistory: StatusHistoryItem[];
  dbRow: Record<string, any>;
}

export interface BatchParseResult {
  orders: NormalizedChainOrderResult[];
  ignoredTestCount: number;
  validCount: number;
  errorFormatoCount: number;
}

/**
 * Parsea números de forma tolerante a formato venezolano (1.500,50), anglosajón (1,500.50) o símbolos ($, Bs, USD).
 */
export function parseSafeNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined) return 0;
  const raw = String(val).trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[$BsUSD\s]/gi, '');
  if (!cleaned) return 0;

  // Formato 1.234,56
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  // Formato 1,234.56
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  // Ambos separadores presentes
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf('.') < cleaned.lastIndexOf(',')) {
      const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    } else {
      const n = parseFloat(cleaned.replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
  }
  // Solo coma decimal (22,80)
  if (cleaned.includes(',')) {
    const n = parseFloat(cleaned.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Normaliza fechas (DD/MM/YYYY, DD-MM-YYYY, ISO 8601) a YYYY-MM-DD.
 */
export function normalizeDateISO(val: unknown): { date: string; hadDateWarning: boolean } {
  const fallback = new Date().toISOString().split('T')[0];
  if (!val) return { date: fallback, hadDateWarning: false };

  const s = String(val).trim();
  if (!s) return { date: fallback, hadDateWarning: false };

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, hadDateWarning: false };
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return { date: `${year}-${month}-${day}`, hadDateWarning: false };
  }

  // YYYY/MM/DD
  const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ymdSlash) {
    return {
      date: `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`,
      hadDateWarning: false
    };
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return { date: parsed.toISOString().split('T')[0], hadDateWarning: false };
  }

  return { date: fallback, hadDateWarning: true };
}

/**
 * Normaliza unidades de medida al estándar de Ventas: UNIDAD, BULTO, PIEZA, KG.
 */
export function normalizeChainUnit(rawUnit: unknown, rawDesc?: string): string {
  const u = String(rawUnit || '').trim().toUpperCase().replace(/\./g, '');
  if (['KG', 'KGS', 'KILO', 'KILOS', 'KILOGRAMO', 'KILOGRAMOS'].includes(u)) return 'KG';
  if (['CJ', 'CJS', 'CAJA', 'CAJAS', 'BLT', 'BTO', 'BTOS', 'BULTO', 'BULTOS', 'EMP', 'PAQ', 'SACO'].includes(u)) return 'BULTO';
  if (['PZA', 'PZAS', 'PZ', 'PIEZA', 'PIEZAS'].includes(u)) return 'PIEZA';
  if (['UND', 'UNID', 'UNI', 'UNIDAD', 'UNIDADES', 'UN'].includes(u)) return 'UNIDAD';

  const descUpper = String(rawDesc || '').toUpperCase();
  if (/\bX\s*KG\b|\bPOR\s*KG\b|\bXKG\b/.test(descUpper)) return 'KG';
  return 'BULTO';
}

/**
 * Resuelve sucursal y cadena (Alkosto o Familia Center) por tag (AK01, FC01), código (7498, 7489) o nombre.
 */
export function resolveChainStore(
  rawTagOrCode?: unknown,
  rawName?: unknown,
  rawOrigin?: unknown
): { store?: ChainStoreDefinition; cadena: ChainOrigin; clienteNombre: string; idCliente: string } {
  const codeStr = String(rawTagOrCode || '').trim().toUpperCase();
  const nameStr = String(rawName || '').trim().toUpperCase();
  const origStr = String(rawOrigin || '').trim().toUpperCase();

  // 1. Por tag exacto (AK01..AK10, FC01..FC07) o código de cliente
  if (codeStr) {
    const byTagOrCode = CHAIN_STORES_CATALOG.find(
      s =>
        s.tag === codeStr ||
        s.codigo === codeStr ||
        s.codigoPadded === codeStr.padStart(6, '0') ||
        s.aliases.includes(codeStr)
    );
    if (byTagOrCode) {
      return {
        store: byTagOrCode,
        cadena: byTagOrCode.cadena,
        clienteNombre: nameStr && nameStr.length > 3 && !/^(AK|FC)\d+$/i.test(nameStr) ? nameStr : byTagOrCode.nombre,
        idCliente: byTagOrCode.codigoPadded
      };
    }
  }

  // 2. Por nombre de sucursal o alias
  if (nameStr) {
    const byName = CHAIN_STORES_CATALOG.find(
      s =>
        s.nombre === nameStr ||
        s.tag === nameStr ||
        s.aliases.some(a => a.length >= 4 && nameStr.includes(a))
    );
    if (byName) {
      return {
        store: byName,
        cadena: byName.cadena,
        clienteNombre: nameStr.length > 4 && !/^(AK|FC)\d+$/i.test(nameStr) ? nameStr : byName.nombre,
        idCliente: codeStr ? codeStr.padStart(6, '0') : byName.codigoPadded
      };
    }
  }

  // 3. Detección de cadena por texto
  const combined = `${codeStr} ${nameStr} ${origStr}`;
  let cadena: ChainOrigin = 'OTRA CADENA';
  if (combined.includes('FAMILIA') || /\bFC0?[1-7]\b|\bFCOP\b/.test(combined)) {
    cadena = 'FAMILIA CENTER';
  } else if (combined.includes('ALKOSTO') || /\bAK0?[1-9]\b|\bAK10\b|\bAKOP\b/.test(combined)) {
    cadena = 'ALKOSTO';
  }

  const finalCliente =
    nameStr ||
    (cadena === 'FAMILIA CENTER'
      ? 'FAMILIA CENTER, C.A.'
      : cadena === 'ALKOSTO'
        ? 'ALKOSTO DONDE COMPRAR ES GANAR, C.A.'
        : '');
  const finalId = codeStr && /^\d+$/.test(codeStr) ? codeStr.padStart(6, '0') : codeStr;

  return {
    cadena,
    clienteNombre: finalCliente,
    idCliente: finalId
  };
}

/**
 * Verifica si un registro corresponde a una prueba automatizada QA (`test-int-*`, `#9999`, `OC-TEST-INT`).
 */
export function isQAOrGhostTestOrder(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const id = String(raw.id || '').trim().toLowerCase();
  const num = String(raw.numero_pedido ?? raw.numeroPedido ?? raw.correlativo ?? '').trim();
  const obs = String(raw.observaciones ?? '').toUpperCase();
  const oc = String(raw.orden_compra ?? raw.ordenCompraAlkosto ?? raw.ordenNro ?? raw.numero_oc ?? '').toUpperCase();

  if (id.startsWith('test-int-') || id.startsWith('test-qa-')) return true;
  if (num === '9999') return true;
  if (obs.includes('OC-TEST-INT') || obs.includes('PRUEBA DE INTEGRAC')) return true;
  if (oc.includes('OC-TEST-INT')) return true;
  return false;
}

/**
 * Extrae el arreglo de renglones/artículos de cualquier clave empleada por Alkosto o Familia Center.
 */
function extractRawItemsArray(obj: any): any[] {
  if (!obj || typeof obj !== 'object') return [];
  const candidates = [
    obj.articulos,
    obj.items,
    obj.renglones,
    obj.productos,
    obj.detalle,
    obj.detalles,
    obj.lineas,
    obj.filas
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/**
 * Desglosa cualquier payload (individual, lote, AlkostoOrder o matriz multi-tienda `items[].tiendas`)
 * en una lista de órdenes candidatas por sucursal.
 */
function expandPayloadToCandidateOrders(body: any): any[] {
  if (!body || typeof body !== 'object') {
    return [{ __malformedPayload: body }];
  }

  if (Array.isArray(body)) {
    return body.length > 0 ? body.flatMap(expandPayloadToCandidateOrders) : [{ __emptyArray: true }];
  }

  // Envolturas de lote (pedidos, orders, data, sucursales, tiendas)
  const batchArrays = [body.pedidos, body.orders, body.data, body.sucursales, body.tiendas];
  for (const list of batchArrays) {
    if (Array.isArray(list) && list.length > 0) {
      return list.flatMap((item: any) =>
        expandPayloadToCandidateOrders({
          ruta: body.ruta || body.vendedora,
          supervisor: body.supervisor,
          chofer: body.chofer,
          orden_compra: body.orden_compra || body.ordenCompraAlkosto || body.ordenNro || body.numero_oc,
          fecha: body.fecha || body.fechaPedido || body.fechaEntrega,
          origen: body.origen || body.clienteCadena,
          ...item
        })
      );
    }
  }

  const rawItems = extractRawItemsArray(body);

  if (rawItems.length > 0) {
    // Caso A: Matriz multi-tienda en cada ítem (`it.tiendas = { AK01: 10, AK02: 20 }` o `{ FC01: 5 }`)
    const storeTagsSet = new Set<string>();
    for (const it of rawItems) {
      if (it && typeof it.tiendas === 'object' && it.tiendas !== null && !Array.isArray(it.tiendas)) {
        for (const [tag, qty] of Object.entries(it.tiendas)) {
          if (parseSafeNumber(qty) > 0) {
            storeTagsSet.add(String(tag).trim().toUpperCase());
          }
        }
      }
    }

    // Si el payload no especifica ya una sucursal única específica, sino que es una OC consolidada con mapa `tiendas`:
    const explicitSingleStore = body.sucursalNombre || body.tiendaSeleccionada;
    if (storeTagsSet.size > 0 && (!explicitSingleStore || String(explicitSingleStore).toUpperCase() === 'CONSOLIDADO')) {
      const expandedByTag: any[] = [];
      for (const tag of storeTagsSet) {
        const storeItems = rawItems
          .map((it: any) => {
            const qty = it?.tiendas ? parseSafeNumber(it.tiendas[tag] ?? it.tiendas[tag.toLowerCase()]) : 0;
            if (qty <= 0) return null;
            const unitPrice = parseSafeNumber(
              it.precio_unitario ?? it.precioUnitarioUSD ?? it.costoUnitario ?? it.precio ?? it.costo_unitario
            );
            return {
              ...it,
              cantidad_solicitada: qty,
              precio_unitario: unitPrice,
              sub_total: Number((qty * unitPrice).toFixed(2)),
              tiendas: undefined
            };
          })
          .filter(Boolean);

        if (storeItems.length > 0) {
          const resolved = resolveChainStore(tag, undefined, body.origen || body.clienteCadena || body.proveedorNombre);
          expandedByTag.push({
            ...body,
            id: body.id ? `${body.id}-${tag.toLowerCase()}` : undefined,
            cliente: resolved.clienteNombre,
            id_cliente: resolved.idCliente,
            origen: resolved.cadena,
            articulos: storeItems
          });
        }
      }
      if (expandedByTag.length > 0) return expandedByTag;
    }

    // Caso B: Artículos con propiedad plana `tienda` / `sucursal` / `nombre_tienda`
    const hasFlatStoreGrouping = rawItems.some((a: any) => a && (a.tienda || a.sucursal || a.nombre_tienda));
    if (hasFlatStoreGrouping) {
      const groups: Record<string, any[]> = {};
      for (const item of rawItems) {
        const storeKey = String(item.tienda || item.sucursal || item.nombre_tienda || body.cliente || 'SUCURSAL').trim();
        if (!groups[storeKey]) groups[storeKey] = [];
        groups[storeKey].push(item);
      }

      return Object.entries(groups).map(([storeName, items]) => ({
        ...body,
        cliente: storeName,
        articulos: items,
        id_cliente: items[0]?.id_cliente || items[0]?.codigo_cliente || body.id_cliente || ''
      }));
    }
  }

  return [body];
}

/**
 * Normaliza un renglón individual de Alkosto o Familia Center y audita su aritmética.
 */
function normalizeChainItem(
  rawItem: any,
  index: number,
  anomalies: string[]
): ArticuloItem | null {
  if (!rawItem || typeof rawItem !== 'object') {
    anomalies.push(`Renglón #${index + 1}: estructura de artículo inválida.`);
    return null;
  }

  const rawCode = String(
    rawItem.codigo ??
    rawItem.sku ??
    rawItem.skuCodizulca ??
    rawItem.codigoArticulo ??
    rawItem.codigo_articulo ??
    rawItem.codigoBarra ??
    rawItem.ean ??
    ''
  ).trim();

  // Limpiar sufijos de precio que el OCR a veces concatena en la descripción (ej. "MORTADELA ASTURIAS / 2.40")
  const rawDescOriginal = String(
    rawItem.descripcion ??
    rawItem.producto ??
    rawItem.descripcion_producto ??
    rawItem.nombre ??
    rawItem.articulo ??
    rawItem.detalle ??
    ''
  ).trim();
  const cleanedDesc = rawDescOriginal.replace(/\s+\/\s*\d+(?:[.,]\d+)?\s*$/, '').trim().toUpperCase();

  const mappedProduct =
    CHAIN_CODE_TO_CODIZULCA_SKU[rawCode.toUpperCase()] ||
    CHAIN_CODE_TO_CODIZULCA_SKU[rawCode.replace(/\D/g, '')];

  let finalCodigo = mappedProduct?.codigo || rawCode.toUpperCase();
  if (/^\d{1,6}$/.test(finalCodigo)) {
    finalCodigo = finalCodigo.padStart(6, '0');
  }

  const catalogDesc = PRODUCT_CATALOG_MAP.get(finalCodigo);
  const finalDescripcion = cleanedDesc || mappedProduct?.descripcion || catalogDesc || '';

  const cantidad = parseSafeNumber(
    rawItem.cantidad_solicitada ??
    rawItem.cantidadCajas ??
    rawItem.cantSolicitada ??
    rawItem.totalCantidad ??
    rawItem.total_cantidad ??
    rawItem.cantidad ??
    rawItem.cant ??
    rawItem.cajas ??
    rawItem.bultos
  );

  let precioUnitario = parseSafeNumber(
    rawItem.precio_unitario ??
    rawItem.precioUnitarioUSD ??
    rawItem.costoUnitario ??
    rawItem.costo_unitario ??
    rawItem.precio ??
    rawItem.costoBruto
  );

  let rawSubtotal = parseSafeNumber(
    rawItem.sub_total ??
    rawItem.subtotalUSD ??
    rawItem.totalRenglon ??
    rawItem.total_renglon ??
    rawItem.subtotal ??
    rawItem.monto ??
    rawItem.total
  );

  // Si todo el renglón está en blanco (fila de relleno vacía de 15 filas), ignorarlo silenciosamente
  if (!finalCodigo && !finalDescripcion && cantidad === 0 && precioUnitario === 0 && rawSubtotal === 0) {
    return null;
  }

  const unidad = normalizeChainUnit(
    rawItem.unidad_medida ?? rawItem.presentacion ?? rawItem.unid ?? rawItem.unidad,
    finalDescripcion || mappedProduct?.unidad
  );

  // Inferencia de precio si solo vino subtotal y cantidad
  if (precioUnitario <= 0 && rawSubtotal > 0 && cantidad > 0) {
    precioUnitario = Number((rawSubtotal / cantidad).toFixed(2));
  }

  // Auditoría y reconciliación aritmética (corrige descuadres OCR Bolívares vs USD)
  let finalSubtotal = rawSubtotal;
  if (cantidad > 0 && precioUnitario > 0) {
    const expectedSubtotal = Number((cantidad * precioUnitario).toFixed(2));
    if (rawSubtotal <= 0) {
      finalSubtotal = expectedSubtotal;
    } else if (Math.abs(rawSubtotal - expectedSubtotal) > 0.5) {
      anomalies.push(
        `Renglón #${index + 1} (${finalDescripcion || finalCodigo}): Subtotal OCR ($${rawSubtotal.toFixed(2)}) no coincide con ${cantidad} x $${precioUnitario.toFixed(2)} = $${expectedSubtotal.toFixed(2)}; ajustado automáticamente a $${expectedSubtotal.toFixed(2)}.`
      );
      finalSubtotal = expectedSubtotal;
    }
  }

  if (!finalDescripcion) {
    anomalies.push(`Renglón #${index + 1}: Falta descripción del producto (código: ${finalCodigo || 'S/C'}).`);
  }
  if (cantidad <= 0) {
    anomalies.push(`Renglón #${index + 1} (${finalDescripcion || 'Sin descripción'}): Cantidad solicitada en 0 o inválida.`);
  }
  if (precioUnitario <= 0) {
    anomalies.push(`Renglón #${index + 1} (${finalDescripcion || 'Sin descripción'}): Precio unitario en $0.00.`);
  }

  return {
    codigo: finalCodigo,
    descripcion: finalDescripcion || `PRODUCTO SIN DESCRIPCIÓN (${finalCodigo || 'S/C'})`,
    unidad_medida: unidad,
    cantidad_solicitada: cantidad,
    cantidad_despachada: 0,
    precio_unitario: precioUnitario,
    sub_total: Number(finalSubtotal.toFixed(2))
  };
}

/**
 * Procesa, valida y normaliza cualquier payload de órdenes de Alkosto y Familia Center.
 * Garantiza que toda orden caiga en la Sala de Espera ('POR_VALIDAR' o 'ERROR_FORMATO') y nunca se pierda.
 */
export function parseAndValidateChainOrders(rawPayload: unknown): BatchParseResult {
  const candidates = expandPayloadToCandidateOrders(rawPayload);
  const results: NormalizedChainOrderResult[] = [];
  let ignoredTestCount = 0;
  let validCount = 0;
  let errorFormatoCount = 0;

  for (let idx = 0; idx < candidates.length; idx++) {
    const rawOrder = candidates[idx];

    if (isQAOrGhostTestOrder(rawOrder) || isQAOrGhostTestOrder(rawPayload)) {
      ignoredTestCount++;
      continue;
    }

    const anomalies: string[] = [];
    let criticalFormatError = false;

    if (!rawOrder || typeof rawOrder !== 'object' || rawOrder.__malformedPayload !== undefined || rawOrder.__emptyArray) {
      criticalFormatError = true;
      anomalies.push('El payload recibido no tiene una estructura JSON válida de orden de compra.');
    }

    const safeObj = rawOrder && typeof rawOrder === 'object' ? rawOrder : {};

    // 1. Resolver sucursal y cadena (Alkosto / Familia Center)
    const rawClientCode =
      safeObj.id_cliente ??
      safeObj.sucursalCodigo ??
      safeObj.codigo_cliente ??
      safeObj.tiendaSeleccionada ??
      safeObj.sede ??
      '';
    const rawClientName =
      safeObj.cliente ??
      safeObj.sucursalNombre ??
      safeObj.nombre_tienda ??
      safeObj.tienda ??
      safeObj.sucursal ??
      safeObj.proveedorNombre ??
      '';
    const rawOrigin = safeObj.origen ?? safeObj.clienteCadena ?? safeObj.tipo ?? '';

    const resolvedStore = resolveChainStore(rawClientCode, rawClientName, rawOrigin);
    let cliente = resolvedStore.clienteNombre;
    const idCliente = resolvedStore.idCliente;
    const cadena = resolvedStore.cadena;

    if (!cliente) {
      criticalFormatError = true;
      cliente = `ORDEN SIN CLIENTE IDENTIFICADO (${cadena})`;
      anomalies.push('No se encontró nombre ni código de sucursal/cliente en la orden.');
    }

    // 2. Normalizar fecha
    const rawDate = safeObj.fecha ?? safeObj.fechaPedido ?? safeObj.fechaEntrega ?? safeObj.fechaEntregaEstimada;
    const { date: fechaISO, hadDateWarning } = normalizeDateISO(rawDate);
    if (hadDateWarning) {
      anomalies.push(`Fecha con formato inválido ("${String(rawDate)}"); reemplazada por ${fechaISO}.`);
    }

    // 3. Normalizar artículos
    const rawItemsList = extractRawItemsArray(safeObj);
    const normalizedItems: ArticuloItem[] = [];
    for (let i = 0; i < rawItemsList.length; i++) {
      const normItem = normalizeChainItem(rawItemsList[i], i, anomalies);
      if (normItem) normalizedItems.push(normItem);
    }

    if (normalizedItems.length === 0) {
      criticalFormatError = true;
      anomalies.push('La orden no contiene artículos/renglones válidos.');
      normalizedItems.push({
        codigo: 'ERROR',
        descripcion: 'ORDEN RECIBIDA SIN RENGLONES VÁLIDOS - REVISAR OC ORIGINAL',
        unidad_medida: 'BULTO',
        cantidad_solicitada: 0,
        cantidad_despachada: 0,
        precio_unitario: 0,
        sub_total: 0
      });
    } else {
      const hasZeroQtyOrPrice = normalizedItems.some(
        it => it.cantidad_solicitada <= 0 || it.precio_unitario <= 0 || it.codigo === 'ERROR'
      );
      if (hasZeroQtyOrPrice) {
        criticalFormatError = true;
      }
    }

    // 4. Calcular total validado y auditar contra el total declarado en cabecera
    const sumSubtotals = Number(
      normalizedItems.reduce((acc, it) => acc + (Number(it.sub_total) || 0), 0).toFixed(2)
    );
    const declaredTotal = parseSafeNumber(
      safeObj.total_pedido ?? safeObj.monto_pedido ?? safeObj.totalUSD ?? safeObj.totalGeneral ?? safeObj.total
    );

    let finalTotal = sumSubtotals > 0 ? sumSubtotals : declaredTotal;
    if (declaredTotal > 0 && sumSubtotals > 0 && Math.abs(declaredTotal - sumSubtotals) > 1) {
      anomalies.push(
        `Total de cabecera declarado ($${declaredTotal.toFixed(2)}) difería de la suma real de renglones en USD ($${sumSubtotals.toFixed(2)}); ajustado a $${sumSubtotals.toFixed(2)}.`
      );
      finalTotal = sumSubtotals;
    }

    // 5. Observaciones y referencia de Orden de Compra (OC)
    const ocNum = String(
      safeObj.orden_compra ??
      safeObj.ordenCompraAlkosto ??
      safeObj.ordenNro ??
      safeObj.numero_oc ??
      safeObj.numeroOrden ??
      safeObj.nroOrden ??
      ''
    ).trim();

    let obs = String(safeObj.observaciones ?? safeObj.direccionEntrega ?? '').trim();
    if (ocNum && !obs.toUpperCase().includes(ocNum.toUpperCase())) {
      const ocLabel = cadena === 'FAMILIA CENTER' ? `OC Familia: ${ocNum}` : `OC Alkosto: ${ocNum}`;
      obs = obs ? `${obs} | ${ocLabel}` : ocLabel;
    }
    if (!obs) {
      obs = `Enviado desde App FDV (${cadena})`;
    }

    // 6. Estado obligatorio en Sala de Espera:
    // NUNCA se permite que un payload externo inyecte 'PENDIENTE_CXC' o salte la Sala de Espera.
    const status: OrderStatus = criticalFormatError ? 'ERROR_FORMATO' : 'POR_VALIDAR';
    if (criticalFormatError) {
      errorFormatoCount++;
    } else {
      validCount++;
    }

    const externalId = String(safeObj.id || '').trim();
    const orderId = externalId ? externalId : `alk-${crypto.randomUUID()}`;
    const rawCorrelativo = String(safeObj.correlativo ?? safeObj.numeroPedido ?? safeObj.numero_pedido ?? '').trim();
    const numero_pedido =
      rawCorrelativo && rawCorrelativo !== 'AUTO' && rawCorrelativo !== 'PENDIENTE' && rawCorrelativo.length <= 6
        ? rawCorrelativo
        : 'APP-FDV';

    const ruta = String(safeObj.ruta ?? safeObj.vendedora ?? 'SAIRU VALLES / CUENTAS CLAVE 2').trim().toUpperCase();
    const supervisor = String(safeObj.supervisor ?? '').trim().toUpperCase();
    const chofer = String(safeObj.chofer ?? '').trim().toUpperCase();
    const createdAt = safeObj.createdAt && !Number.isNaN(new Date(safeObj.createdAt).getTime())
      ? new Date(safeObj.createdAt).toISOString()
      : new Date().toISOString();

    const formatNote =
      anomalies.length > 0
        ? `${criticalFormatError ? 'ERROR_FORMATO' : 'AVISO_PARSING'}: ${anomalies.join(' | ')}`
        : undefined;

    const orderData: OrderData = {
      cliente,
      id_cliente: idCliente,
      ruta,
      supervisor,
      chofer,
      observaciones: obs,
      fecha: fechaISO,
      total_pedido: Number(finalTotal.toFixed(2)),
      monto_pedido: Number(finalTotal.toFixed(2)),
      numero_pedido,
      origen: cadena,
      articulos: normalizedItems
    };

    const statusHistory: StatusHistoryItem[] = [
      {
        status,
        department: 'Ventas',
        changedBy: ruta,
        timestamp: createdAt,
        reason: criticalFormatError
          ? `Error de Formato detectado en ingesta (${cadena}): ${anomalies.join('; ')}`
          : anomalies.length > 0
            ? `Recibido en Sala de Espera (${cadena}) con ajuste automático: ${anomalies.join('; ')}`
            : `Recibido en Sala de Espera desde app externa (${cadena})`
      }
    ];

    const dbRow = {
      id: orderId,
      numero_pedido,
      cliente,
      id_cliente: idCliente,
      ruta,
      supervisor,
      chofer,
      observaciones: obs,
      fecha: fechaISO,
      total_pedido: orderData.total_pedido,
      monto_pedido: orderData.monto_pedido,
      status,
      cxc_note: formatNote || null,
      reject_reason: null,
      articulos: normalizedItems,
      raw_order: {
        ...orderData,
        original_payload: safeObj,
        anomalies
      },
      is_archived: false,
      created_at: createdAt,
      updated_at: new Date().toISOString(),
      status_history: statusHistory
    };

    results.push({
      id: orderId,
      numero_pedido,
      status,
      cadena,
      hasFormatError: criticalFormatError,
      anomalies,
      cxc_note: formatNote,
      orderData,
      statusHistory,
      dbRow
    });
  }

  return {
    orders: results,
    ignoredTestCount,
    validCount,
    errorFormatoCount
  };
}
