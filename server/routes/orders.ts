import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { DbOrder, OrderStatus } from '../../src/types.js';
import { parseAndValidateChainOrders, normalizeChainUnit } from '../services/chainOrderParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function isTestOrGhostOrder(row: any): boolean {
  if (!row) return false;
  const id = String(row.id || '').trim().toLowerCase();
  const num = String(row.numero_pedido ?? row.order?.numero_pedido ?? '').trim();
  const obs = String(row.observaciones ?? row.order?.observaciones ?? '').toUpperCase();
  const cli = String(row.cliente ?? row.order?.cliente ?? '').toUpperCase();
  const arts = Array.isArray(row.articulos) ? row.articulos : (Array.isArray(row.order?.articulos) ? row.order.articulos : []);

  if (id.startsWith('test-int-') || id.startsWith('test-qa-')) return true;
  if (num === '9999') return true;
  if (obs.includes('OC-TEST-INT') || obs.includes('PRUEBA DE INTEGRAC')) return true;
  if (cli.includes('ALKOSTO 01 - ZONA INDUSTRIAL') && arts.length === 1 && Number(arts[0]?.cantidad_solicitada) === 0) {
    return true;
  }
  return false;
}

const WAITING_ROOM_RAW_STATUSES = new Set([
  'POR_VALIDAR',
  'POR VALIDAR',
  'PENDIENTE',
  'EN_ESPERA',
  'EN ESPERA',
  'ENVIADO',
  'POR_APROBAR',
  'RECIBIDO'
]);

const WAITING_ROOM_QUERY_STATUSES = [
  'POR_VALIDAR',
  'POR VALIDAR',
  'ERROR_FORMATO',
  'PENDIENTE',
  'EN_ESPERA',
  'EN ESPERA',
  'ENVIADO',
  'POR_APROBAR',
  'RECIBIDO',
  'por_validar',
  'por validar',
  'error_formato',
  'pendiente',
  'en_espera',
  'en espera',
  'enviado',
  'por_aprobar',
  'recibido'
];

// Detecta pedidos enviados desde la app externa de cadenas (Sairú / Alkosto / Familia Center)
// que entraron con un estado pendiente/en espera o con 'PENDIENTE_CXC' y correlativo corto sin pasar por Sala de Espera
function isUnvalidatedExternalChainOrder(row: any): boolean {
  if (!row) return false;
  const id = String(row.id || '').trim().toLowerCase();
  const num = String(row.numero_pedido ?? row.order?.numero_pedido ?? '').trim().toUpperCase();
  const rawStatus = String(row.status || '').trim().toUpperCase();
  const rawOrd = row.raw_order && typeof row.raw_order === 'object' ? row.raw_order : {};
  const cadenaOrOrigen = String(rawOrd.cadena || rawOrd.origen || row.order?.cadena || row.order?.origen || '').trim().toUpperCase();

  if (rawStatus !== 'POR_VALIDAR' && WAITING_ROOM_RAW_STATUSES.has(rawStatus)) {
    return true;
  }

  const history = Array.isArray(row.status_history)
    ? row.status_history
    : Array.isArray(row.statusHistory)
      ? row.statusHistory
      : [];

  if (rawStatus === 'PENDIENTE_CXC') {
    const hasExternalCorrelativo =
      id.startsWith('alk-') ||
      num.length <= 4 ||
      num === 'APP-FDV' ||
      num === 'PENDIENTE' ||
      num === 'AUTO';
    const wasCreatedManuallyInVentas = history.some((h: any) => h && h.status === 'CREADO');
    const wasValidatedInManuales = history.some(
      (h: any) =>
        h &&
        h.status === 'PENDIENTE_CXC' &&
        (String(h.reason || '').includes('Validado') || String(h.reason || '').includes('Aprobado'))
    );
    const isExternalChainSource =
      id.startsWith('alk-') ||
      num === 'APP-FDV' ||
      num === 'PENDIENTE' ||
      (!wasCreatedManuallyInVentas && (cadenaOrOrigen.includes('ALKOSTO') || cadenaOrOrigen.includes('FAMILIA')));
    if (hasExternalCorrelativo && !wasValidatedInManuales && isExternalChainSource) {
      return true;
    }
  }
  return false;
}

// Conexión directa vía REST API con Firestore y Supabase de la App de Alkosto de Sairú (https://dashboard-fdv-planificador.onrender.com)
const SAIRU_FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/gen-lang-client-0359272213/databases/ai-studio-dashboardfdvplan-b71166f0-11d2-4bf0-8a16-d3a8accb0022/documents';
const SAIRU_SUPABASE_PEDIDOS_URL = 'https://nudltbgyewyiklqdyujk.supabase.co/rest/v1/pedidos_alkosto';
const SAIRU_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZGx0Ymd5ZXd5aWtscWR5dWprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTgzMDA3OCwiZXhwIjoyMTA3NDA2MDc4fQ.k92vdZiuVkTzAWNK8Fq71m1Xi_MoWtpx_eRQcZTw1cA';
const deletedAlkostoIdsMemory = new Set<string>();
let lastSairuSyncRun = 0;
const SAIRU_SYNC_INTERVAL_MS = 3 * 1000; // Intervalo corto (3s) para capturar lotes de 7+ pedidos en ráfaga sin bloqueos

function parseFirestoreVal(v: any): any {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseFirestoreVal);
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      out[k] = parseFirestoreVal(val);
    }
    return out;
  }
  return v;
}

function parseFirestoreDoc(doc: any): any {
  const id = String(doc.name || '').split('/').pop() || '';
  const out: Record<string, any> = { id };
  for (const [k, val] of Object.entries(doc.fields || {})) {
    out[k] = parseFirestoreVal(val);
  }
  return out;
}

async function markSairuFirestoreProcessed(id: string): Promise<void> {
  if (!String(id || '').startsWith('alk-')) return;
  try {
    await Promise.allSettled([
      fetch(`${SAIRU_FIRESTORE_BASE}/alkosto_orders/${encodeURIComponent(id)}?updateMask.fieldPaths=estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { estado: { stringValue: 'PROCESADO' } } })
      }),
      fetch(`${SAIRU_SUPABASE_PEDIDOS_URL}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SAIRU_SUPABASE_KEY,
          Authorization: `Bearer ${SAIRU_SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'PROCESADO', updated_at: new Date().toISOString() })
      })
    ]);
  } catch (e) {
    console.warn('Note: could not mark Alkosto order PROCESADO in external store:', e);
  }
}

async function deleteFromSairuFirestore(ids: string[], deletedBy = 'Sistema'): Promise<void> {
  const validIds = (ids || []).map(id => String(id || '').trim()).filter(Boolean);
  if (validIds.length === 0) return;

  for (const id of validIds) {
    deletedAlkostoIdsMemory.add(id);
  }

  const nowIso = new Date().toISOString();
  const deletedRows = validIds.map(id => ({
    id,
    deleted_at: nowIso,
    deleted_by: deletedBy
  }));

  const externalTasks: Promise<any>[] = [
    supabase.from('deleted_orders').upsert(deletedRows, { onConflict: 'id' })
  ];

  for (const id of validIds) {
    if (!id.startsWith('alk-')) continue;
    externalTasks.push(
      fetch(`${SAIRU_FIRESTORE_BASE}/alkosto_orders/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }).catch(() => {}),
      fetch(`${SAIRU_SUPABASE_PEDIDOS_URL}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SAIRU_SUPABASE_KEY,
          Authorization: `Bearer ${SAIRU_SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'ELIMINADO', updated_at: nowIso })
      }).catch(() => {}),
      fetch(`${SAIRU_SUPABASE_PEDIDOS_URL}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          apikey: SAIRU_SUPABASE_KEY,
          Authorization: `Bearer ${SAIRU_SUPABASE_KEY}`
        }
      }).catch(() => {})
    );
  }

  await Promise.allSettled(externalTasks);
}

async function syncSairuFirestoreToSupabase(_force = false): Promise<number> {
  try {
    const [fsResResult, sbResResult] = await Promise.allSettled([
      fetch(`${SAIRU_FIRESTORE_BASE}:runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'alkosto_orders' }]
          }
        })
      }),
      fetch(`${SAIRU_SUPABASE_PEDIDOS_URL}?select=*&order=created_at.desc&limit=500`, {
        headers: {
          apikey: SAIRU_SUPABASE_KEY,
          Authorization: `Bearer ${SAIRU_SUPABASE_KEY}`
        }
      })
    ]);

    const candidateMap = new Map<string, any>();
    const validExternalStatuses = new Set([
      'ENVIADO',
      'PENDIENTE',
      'EN_ESPERA',
      'EN ESPERA',
      'POR_VALIDAR',
      'POR VALIDAR',
      'RECIBIDO',
      'POR_APROBAR'
    ]);

    if (fsResResult.status === 'fulfilled' && fsResResult.value.ok) {
      const rawItems = await fsResResult.value.json().catch(() => []);
      if (Array.isArray(rawItems)) {
        const fsDocs = rawItems
          .filter((x: any) => x && x.document)
          .map((x: any) => parseFirestoreDoc(x.document));

        const testFsDocs = fsDocs.filter(
          (d: any) =>
            String(d.id || '').startsWith('test-int-') ||
            String(d.numeroPedido || '') === '9999' ||
            String(d.ordenCompraAlkosto || '').toUpperCase().includes('OC-TEST-INT')
        );
        for (const td of testFsDocs) {
          fetch(`${SAIRU_FIRESTORE_BASE}/alkosto_orders/${encodeURIComponent(td.id)}`, { method: 'DELETE' }).catch(() => {});
        }

        for (const d of fsDocs) {
          const st = String(d.estado || d.status || '').trim().toUpperCase();
          if (
            !testFsDocs.includes(d) &&
            d.id &&
            validExternalStatuses.has(st) &&
            !deletedAlkostoIdsMemory.has(d.id)
          ) {
            candidateMap.set(d.id, d);
          }
        }
      }
    }

    if (sbResResult.status === 'fulfilled' && sbResResult.value.ok) {
      const sbDocs = await sbResResult.value.json().catch(() => []);
      if (Array.isArray(sbDocs)) {
        for (const d of sbDocs) {
          const st = String(d?.status || d?.estado || '').trim().toUpperCase();
          if (
            d &&
            d.id &&
            !String(d.id).startsWith('test-int-') &&
            validExternalStatuses.has(st) &&
            !deletedAlkostoIdsMemory.has(d.id)
          ) {
            if (!candidateMap.has(d.id)) {
              candidateMap.set(d.id, d);
            } else {
              // Enriquecer con campos de Supabase si faltaban en Firestore (ej. orden_compra_alkosto)
              const prev = candidateMap.get(d.id);
              candidateMap.set(d.id, { ...d, ...prev, orden_compra_alkosto: prev.ordenCompraAlkosto || d.orden_compra_alkosto });
            }
          }
        }
      }
    }

    const enviados = Array.from(candidateMap.values());
    if (enviados.length === 0) return 0;

    const enviadoIds = enviados.map((d: any) => d.id);
    const [{ data: existingInSup }, { data: deletedInSup }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, numero_pedido, status_history, total_pedido, cxc_note, observaciones')
        .in('id', enviadoIds),
      supabase
        .from('deleted_orders')
        .select('id')
        .in('id', enviadoIds)
    ]);

    const persistedDeletedIds = new Set<string>((deletedInSup || []).map((r: any) => String(r.id)));
    for (const delId of persistedDeletedIds) {
      deletedAlkostoIdsMemory.add(delId);
    }

    const existingMap = new Map<string, any>((existingInSup || []).map((r: any) => [r.id, r]));
    const rowsToUpsert: any[] = [];
    const nowIso = new Date().toISOString();

    for (const d of enviados) {
      if (deletedAlkostoIdsMemory.has(d.id) || persistedDeletedIds.has(d.id)) {
        continue;
      }
      const parsed = parseAndValidateChainOrders(d);
      if (parsed.orders.length === 0) continue;
      const normOrder = parsed.orders[0];

      const existing = existingMap.get(d.id);
      if (existing) {
        const obsActual = String(existing.observaciones || '');
        const existingRawStatus = String(existing.status || '').trim().toUpperCase();
        const isWaitingStatus = WAITING_ROOM_RAW_STATUSES.has(existingRawStatus) || existingRawStatus === 'ERROR_FORMATO';
        const lacksStandardObs =
          isWaitingStatus && (!obsActual.includes(' | OC ') || !obsActual.includes(' | Dir: '));

        const needsNormalization =
          isUnvalidatedExternalChainOrder(existing) ||
          lacksStandardObs ||
          (isWaitingStatus &&
            Number(existing.total_pedido) !== Number(normOrder.orderData.total_pedido) &&
            !String(existing.cxc_note || '').includes('AVISO_PARSING'));

        if (needsNormalization) {
          normOrder.dbRow.created_at = nowIso;
          normOrder.dbRow.updated_at = nowIso;
          normOrder.dbRow.is_archived = false;
          rowsToUpsert.push(normOrder.dbRow);
        }
        continue;
      }

      normOrder.dbRow.created_at = nowIso;
      normOrder.dbRow.updated_at = nowIso;
      normOrder.dbRow.is_archived = false;
      rowsToUpsert.push(normOrder.dbRow);
    }

    if (rowsToUpsert.length > 0) {
      await supabase.from('orders').upsert(rowsToUpsert, { onConflict: 'id' });
    }

    return rowsToUpsert.length;
  } catch (err) {
    console.warn('Background Sairú Firestore/Supabase sync warning:', err);
    return 0;
  }
}

async function ensureSairuSyncIfDue(force = false): Promise<void> {
  const now = Date.now();
  if (force || now - lastSairuSyncRun >= SAIRU_SYNC_INTERVAL_MS) {
    lastSairuSyncRun = now;
    await Promise.race([
      syncSairuFirestoreToSupabase(force),
      new Promise(resolve => setTimeout(resolve, 8000))
    ]).catch(() => {});
  }
}

function mapSupabaseToDbOrder(row: any): DbOrder {
  const rawStatus = String(row.status || '').trim().toUpperCase();
  const normalizedStatus = (
    WAITING_ROOM_RAW_STATUSES.has(rawStatus)
      ? 'POR_VALIDAR'
      : rawStatus === 'ERROR FORMATO'
        ? 'ERROR_FORMATO'
        : rawStatus
  ) as OrderStatus;
  const rawOrd = row.raw_order && typeof row.raw_order === 'object' ? row.raw_order : {};
  const rawArticulosSource =
    Array.isArray(row.articulos) && row.articulos.length > 0
      ? row.articulos
      : Array.isArray(rawOrd.articulos) && rawOrd.articulos.length > 0
        ? rawOrd.articulos
        : Array.isArray(rawOrd.items) && rawOrd.items.length > 0
          ? rawOrd.items
          : Array.isArray(rawOrd.productos) && rawOrd.productos.length > 0
            ? rawOrd.productos
            : Array.isArray(rawOrd.renglones) && rawOrd.renglones.length > 0
              ? rawOrd.renglones
              : Array.isArray(rawOrd.detalle) && rawOrd.detalle.length > 0
                ? rawOrd.detalle
                : [];

  const articulos = rawArticulosSource.map((it: any) => {
    const cant = Number(
      it?.cantidad_solicitada ?? it?.cantidadCajas ?? it?.cantidad ?? it?.cant ?? it?.cajas ?? it?.bultos ?? 0
    );
    const precio = Number(
      it?.precio_unitario ?? it?.precioUnitarioUSD ?? it?.costoUnitario ?? it?.costo_unitario ?? it?.precio ?? 0
    );
    const rawSub = Number(it?.sub_total ?? it?.subtotalUSD ?? it?.subtotal ?? it?.total ?? it?.monto ?? 0);
    const subTotal =
      cant > 0 && precio > 0
        ? Number((cant * precio).toFixed(2))
        : Number.isFinite(rawSub) && rawSub >= 0
          ? Number(rawSub.toFixed(2))
          : 0;
    const rawCode = String(
      it?.codigo ?? it?.sku ?? it?.skuCodizulca ?? it?.codigo_producto ?? it?.codigo_articulo ?? ''
    ).trim();
    const codigo = /^\d{1,5}$/.test(rawCode) ? rawCode.padStart(6, '0') : rawCode;
    const descripcion = String(
      it?.descripcion ?? it?.producto ?? it?.nombre ?? it?.nombre_producto ?? it?.articulo ?? ''
    ).trim();
    return {
      codigo,
      descripcion,
      unidad_medida: normalizeChainUnit(
        it?.unidad_medida ?? it?.unidad ?? it?.presentacion ?? it?.unid,
        descripcion
      ),
      cantidad_solicitada: Number.isFinite(cant) ? cant : 0,
      cantidad_despachada: Number(it?.cantidad_despachada ?? 0) || 0,
      precio_unitario: Number.isFinite(precio) ? precio : 0,
      sub_total: subTotal
    };
  });

  const calculatedTotal = Number(
    articulos.reduce((acc: number, it: any) => acc + (Number(it.sub_total) || 0), 0).toFixed(2)
  );
  const declaredTotal = Number(row.total_pedido ?? row.monto_pedido ?? rawOrd.total_pedido ?? rawOrd.monto_pedido ?? 0);
  const finalTotal =
    calculatedTotal > 0 &&
    (declaredTotal <= 0 ||
      Number.isNaN(declaredTotal) ||
      ((normalizedStatus === 'POR_VALIDAR' || normalizedStatus === 'ERROR_FORMATO') &&
        Math.abs(declaredTotal - calculatedTotal) > 0.5))
      ? calculatedTotal
      : Number.isFinite(declaredTotal)
        ? Number(declaredTotal.toFixed(2))
        : 0;

  const obsText = String(row.observaciones || rawOrd.observacion_formateada || rawOrd.observaciones || '').trim();
  const ocMatch =
    obsText.match(/OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?|OTRA\s+CADENA)\s*:\s*([A-Z0-9-]+)/i) ||
    obsText.match(/\b(?:OC|ORDEN\s+DE\s+COMPRA)\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  const extractedOc =
    rawOrd.numero_oc ||
    rawOrd.orden_compra ||
    rawOrd.ordenCompraAlkosto ||
    rawOrd.orden_compra_alkosto ||
    (ocMatch ? ocMatch[1].trim() : undefined);

  const dirMatch = obsText.match(/\|\s*Dir:\s*(.+)$/i);
  const extractedDir =
    rawOrd.direccion_despacho ||
    rawOrd.direccionEntrega ||
    (dirMatch
      ? dirMatch[1].trim()
      : obsText
          .replace(/\s*\|\s*OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?|OTRA\s+CADENA)\s*:\s*[^|]+/gi, '')
          .replace(/\b(?:OC|ORDEN\s+DE\s+COMPRA)\s*[:#]?\s*[A-Z0-9-]{4,}\s*\|?\s*/gi, '')
          .trim() || undefined);

  const rowSucursal = String(row.sucursal || '').trim();
  const explicitBranch = String(
    rawOrd.sucursal_cliente ||
    rawOrd.sucursalNombre ||
    rawOrd.sucursal_nombre ||
    rawOrd.tienda ||
    (rowSucursal && rowSucursal.toUpperCase() !== 'MARACAIBO' ? rowSucursal : '') ||
    row.cliente ||
    rawOrd.cliente ||
    ''
  ).trim();
  const resolvedCliente = String(
    row.cliente && String(row.cliente).trim().toUpperCase() !== 'ALKOSTO'
      ? row.cliente
      : explicitBranch || row.cliente || rawOrd.cliente || ''
  ).trim();
  const explicitVendedorCol = String(
    row.vendedores || row.vendedor || rawOrd.vendedores || rawOrd.vendedor || rawOrd.vendedora || rawOrd.vendedor_nombre || ''
  ).trim();
  const explicitRutasCol = String(
    row.rutas || row.zona || row.ruta_zona || rawOrd.rutas || rawOrd.zona || rawOrd.ruta_zona || ''
  ).trim();
  const rawRutaCol = String(row.ruta || rawOrd.ruta || '').trim();
  const resolvedVendedor = explicitVendedorCol || rawRutaCol;
  const resolvedRuta = rawRutaCol || explicitRutasCol || explicitVendedorCol;
  const resolvedRutasZona =
    explicitRutasCol ||
    (explicitVendedorCol && rawRutaCol && explicitVendedorCol.toUpperCase() !== rawRutaCol.toUpperCase()
      ? rawRutaCol
      : '');
  const resolvedCadena =
    rawOrd.cadena ||
    rawOrd.origen ||
    (resolvedCliente.toUpperCase().includes('ALKOSTO') ? 'ALKOSTO' : undefined);

  return {
    id: row.id,
    status: normalizedStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sucursal: rowSucursal || rawOrd.sucursal || undefined,
    statusHistory: row.status_history || [],
    rejectReason: row.reject_reason || undefined,
    cxcNote: row.cxc_note || undefined,
    factNote: row.fact_note || undefined,
    isArchived: Boolean(row.is_archived),
    order: {
      cliente: resolvedCliente,
      sucursal_cliente: explicitBranch || resolvedCliente,
      sucursal: rowSucursal || rawOrd.sucursal || explicitBranch || undefined,
      cadena: resolvedCadena,
      numero_oc: extractedOc,
      direccion_despacho: extractedDir,
      observacion_formateada: obsText,
      vendedor: resolvedVendedor,
      vendedores: explicitVendedorCol || resolvedVendedor,
      total_renglones: articulos.length,
      id_cliente: row.id_cliente || rawOrd.id_cliente || '',
      ruta: resolvedRuta,
      rutas: resolvedRutasZona || undefined,
      zona: resolvedRutasZona || undefined,
      supervisor: row.supervisor || rawOrd.supervisor || '',
      chofer: row.chofer || rawOrd.chofer || '',
      observaciones: obsText,
      fecha: row.fecha || rawOrd.fecha || '',
      articulos,
      numero_pedido: row.numero_pedido || rawOrd.numero_pedido || '',
      total_pedido: finalTotal,
      monto_pedido: finalTotal,
      origen: rawOrd.origen || resolvedCadena,
    }
  };
}

// Extraer rol del usuario desde el JWT autenticado
function getUserRole(req: any): string {
  return (req.user?.user_metadata?.role || req.user?.role || 'ventas').toLowerCase();
}

// Extraer nombre de usuario autenticado
function getUserName(req: any): string {
  const meta = req.user?.user_metadata || {};
  if (meta.username && typeof meta.username === 'string' && meta.username.trim()) {
    return meta.username.trim();
  }
  if (req.user?.email && typeof req.user.email === 'string') {
    const prefix = req.user.email.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'Usuario';
}

// Generador atómico y secuencial de correlativos sin colisiones
async function getNextCorrelativo(): Promise<string> {
  const { data } = await supabase
    .from('orders')
    .select('numero_pedido, created_at')
    .or('is_archived.is.false,is_archived.is.null')
    .order('created_at', { ascending: false })
    .limit(100);

  let maxNum = 0;
  if (data && data.length > 0) {
    for (const r of data) {
      if (r.numero_pedido && /^\d+$/.test(String(r.numero_pedido).trim())) {
        const n = parseInt(String(r.numero_pedido).trim(), 10);
        if (!isNaN(n) && n < 400000 && n > maxNum) {
          maxNum = n;
        }
      }
    }
  }

  let nextNum = maxNum > 0 ? maxNum + 1 : 1;

  // Verificación atómica contra colisiones en la base de datos
  let candidate = String(nextNum);
  let isOccupied = true;
  while (isOccupied) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('numero_pedido', candidate)
      .limit(1);

    if (!existing || existing.length === 0) {
      isOccupied = false;
    } else {
      nextNum++;
      candidate = String(nextNum);
    }
  }

  return candidate;
}

// Corte mensual seguro: SOLO archiva pedidos finalizados (COMPLETADO o RECHAZADO)
// Los pedidos en proceso (PENDIENTE_CXC, PENDIENTE_FACTURACION, POR_VALIDAR) NUNCA se archivan
let lastCutoffRun = 0;
const CUTOFF_INTERVAL_MS = 6 * 60 * 60 * 1000; // Ejecutar máximo cada 6 horas en segundo plano

async function performMonthlyCutoff() {
  try {
    const firstDay = new Date();
    firstDay.setDate(1);
    firstDay.setHours(0, 0, 0, 0);
    const isoDate = firstDay.toISOString();
    
    await supabase
      .from('orders')
      .update({ is_archived: true })
      .lt('created_at', isoDate)
      .in('status', ['COMPLETADO', 'RECHAZADO'])
      .or('is_archived.is.false,is_archived.is.null');
  } catch (err) {
    console.error('Error in safe monthly cutoff:', err);
  }
}

function triggerCutoffIfDue() {
  const now = Date.now();
  if (now - lastCutoffRun >= CUTOFF_INTERVAL_MS) {
    lastCutoffRun = now;
    performMonthlyCutoff().catch(e => console.error('Background cutoff error:', e));
  }
}

// Columnas requeridas para los pedidos activos (incluye sucursal y raw_order para conservar metadatos completos de OC, sucursal y dirección)
const ACTIVE_ORDERS_COLUMNS = '*';

// GET todos los pedidos activos (optimizado para respuesta instantánea y sincronización garantizada de Sala de Espera)
router.get('/', async (req, res) => {
  try {
    // Se dispara en segundo plano si ya pasaron 6 horas (no bloquea la respuesta HTTP)
    triggerCutoffIfDue();
    // Asegura que las órdenes de compra cargadas hoy en la app de Sairú estén sincronizadas antes de responder
    const forceSync = req.query.forceSync === '1' || req.query.forceSync === 'true';
    await ensureSairuSyncIfDue(forceSync);
    
    const [activeQuery, waitingQuery] = await Promise.all([
      supabase
        .from('orders')
        .select(ACTIVE_ORDERS_COLUMNS)
        .or('is_archived.is.false,is_archived.is.null')
        .order('created_at', { ascending: false })
        .range(0, 999),
      supabase
        .from('orders')
        .select(ACTIVE_ORDERS_COLUMNS)
        .in('status', WAITING_ROOM_QUERY_STATUSES)
        .order('created_at', { ascending: false })
    ]);
      
    if (activeQuery.error) throw activeQuery.error;
    
    const mergedMap = new Map<string, any>();
    for (const r of waitingQuery.data || []) {
      if (r && r.id && r.is_archived !== true && !deletedAlkostoIdsMemory.has(r.id)) mergedMap.set(r.id, r);
    }
    for (const r of activeQuery.data || []) {
      if (r && r.id && r.is_archived !== true && !deletedAlkostoIdsMemory.has(r.id) && !mergedMap.has(r.id)) mergedMap.set(r.id, r);
    }
    const allRows = Array.from(mergedMap.values());

    const ghostIds = allRows.filter(isTestOrGhostOrder).map(r => r.id).filter(Boolean);
    if (ghostIds.length > 0) {
      // Auto-purgar pedidos fantasma de pruebas QA externas en segundo plano
      supabase.from('orders').delete().in('id', ghostIds).then(({ error: delErr }) => {
        if (delErr) console.error('Error auto-deleting ghost test orders:', delErr);
      });
    }

    // Normalizar automáticamente pedidos recién llegados de la App de Sairú a Sala de Espera ('POR_VALIDAR')
    const unvalidatedChainIds: string[] = [];
    for (const row of allRows) {
      if (isUnvalidatedExternalChainOrder(row)) {
        row.status = 'POR_VALIDAR';
        row.reject_reason = null;
        if (row.id) unvalidatedChainIds.push(row.id);
      }
    }
    if (unvalidatedChainIds.length > 0) {
      supabase
        .from('orders')
        .update({ status: 'POR_VALIDAR', reject_reason: null, updated_at: new Date().toISOString() })
        .in('id', unvalidatedChainIds)
        .then(({ error: normErr }) => {
          if (normErr) console.error('Error auto-normalizing external chain orders to POR_VALIDAR:', normErr);
        });
    }

    const orders = allRows
      .filter(row => !isTestOrGhostOrder(row) && !deletedAlkostoIdsMemory.has(row.id))
      .map(row => {
        const o = mapSupabaseToDbOrder(row);
        o.isArchived = false;
        return o;
      });
    res.json(orders);
  } catch (err: any) {
    console.error('Error fetching from Supabase:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST sincronizar bajo demanda desde la App de Alkosto de Sairú (https://dashboard-fdv-planificador.onrender.com)
router.post('/sync-alkosto', async (req, res) => {
  try {
    lastSairuSyncRun = Date.now();
    const force = req.body?.force !== false;
    const syncedCount = await syncSairuFirestoreToSupabase(force);

    const { data: waitingRows } = await supabase
      .from('orders')
      .select(ACTIVE_ORDERS_COLUMNS)
      .in('status', WAITING_ROOM_QUERY_STATUSES)
      .order('created_at', { ascending: false });

    const waitingOrders = (waitingRows || [])
      .filter(row => row && row.is_archived !== true && !isTestOrGhostOrder(row) && !deletedAlkostoIdsMemory.has(row.id))
      .map(row => {
        const o = mapSupabaseToDbOrder(row);
        o.isArchived = false;
        return o;
      });

    res.json({ success: true, syncedCount, waitingOrders });
  } catch (err: any) {
    console.error('Error syncing Alkosto orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fuentes de respaldo histórico de solo lectura (Google Sheets + archivos locales de cierre mensual)
const HISTORY_SHEET_ID = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';
const DEFAULT_HISTORY_GIDS = [
  '2109721203', '1931086704', '792036140', '877239853', '238739897',
  '2130133439', '1314022048', '1960659635', '1020397937', '2068143851',
  '875764522', '766844516', '1079374179', '895880905', '1136326469'
];
const HISTORY_CACHE_TTL_MS = 15 * 60 * 1000;
const SUPABASE_HISTORY_CACHE_TTL_MS = 60 * 1000;
let cachedArchiveHistoryOrders: DbOrder[] | null = null;
let cachedArchiveHistoryCutoff = '';
let lastArchiveHistoryFetch = 0;
let archiveLoadInFlight: Promise<DbOrder[]> | null = null;
let cachedSupabaseHistoryOrders: DbOrder[] | null = null;
let lastSupabaseHistoryFetch = 0;

function resolveServerDataPath(fileName: string): string | null {
  const candidates = [
    path.resolve(__dirname, '../data', fileName),
    path.resolve(process.cwd(), 'server', 'data', fileName)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function parseHistoryCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let curr = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(curr);
      curr = '';
    } else {
      curr += ch;
    }
  }
  result.push(curr);
  return result;
}

function standardizeHistoryDate(raw: unknown): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/"/g, '').trim();
  if (!d) return null;
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  return null;
}

async function fetchSheetTextWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function loadReadOnlyHistoricalArchiveOrders(firstDayDateStr: string): Promise<DbOrder[]> {
  const now = Date.now();
  if (
    cachedArchiveHistoryOrders &&
    cachedArchiveHistoryCutoff === firstDayDateStr &&
    now - lastArchiveHistoryFetch < HISTORY_CACHE_TTL_MS
  ) {
    return cachedArchiveHistoryOrders;
  }

  if (archiveLoadInFlight) {
    return archiveLoadInFlight;
  }

  archiveLoadInFlight = (async (): Promise<DbOrder[]> => {
    try {
      let allCsvLines: string[] = [];

      // 1. Leer respaldo CSV local (server/data/sheet.csv)
      const localSheetPath = resolveServerDataPath('sheet.csv');
      if (localSheetPath) {
        try {
          const localCsv = fs.readFileSync(localSheetPath, 'utf8');
          const lines = localCsv.split(/\r?\n/).filter(l => l.trim() !== '');
          if (lines.length > 0 && lines[0].toUpperCase().includes('ID PEDIDO')) {
            lines.shift();
          }
          allCsvLines = allCsvLines.concat(lines);
        } catch (csvErr) {
          console.warn('Warning reading local sheet.csv for history:', csvErr);
        }
      }

      // 2. Descargar pestañas CSV históricas de Google Sheets inmediatamente en paralelo (solo lectura GET)
      const sheetResults = await Promise.allSettled(
        DEFAULT_HISTORY_GIDS.map(gid =>
          fetchSheetTextWithTimeout(
            `https://docs.google.com/spreadsheets/d/${HISTORY_SHEET_ID}/export?format=csv&gid=${gid}`,
            8000
          )
        )
      );

      for (const res of sheetResults) {
        if (res.status === 'fulfilled' && res.value) {
          const lines = res.value.split(/\r?\n/).filter(l => l.trim() !== '');
          if (lines.length === 0 || !lines[0].toUpperCase().includes('ID PEDIDO')) continue;
          lines.shift();
          allCsvLines = allCsvLines.concat(lines);
        }
      }

      const ordersMap = new Map<string, any>();

      for (const line of allCsvLines) {
        const cols = parseHistoryCsvLine(line.trim());
        if (cols.length < 13) continue;

        const id = (cols[0] || '').replace(/"/g, '').trim();
        if (!id || id.toUpperCase() === 'ID PEDIDO' || id === '1793055537757') continue;

        const fecha = standardizeHistoryDate(cols[1]);
        if (!fecha || fecha >= firstDayDateStr) continue;

        const rawStatus = (cols[14] || '').replace(/"/g, '').trim().toUpperCase();
        const rawReason = (cols[15] || '').replace(/"/g, '').trim();
        const isRejected =
          rawStatus.includes('RECHAZAD') ||
          rawStatus.includes('NO FACTURAD') ||
          rawStatus.includes('ANULAD');

        if (!ordersMap.has(id)) {
          const cliente = (cols[2] || '').replace(/"/g, '').trim();
          const id_cliente = (cols[3] || '').replace(/"/g, '').trim();
          const ruta = (cols[4] || '').replace(/"/g, '').trim();
          const supervisor = (cols[5] || '').replace(/"/g, '').trim();
          const chofer = (cols[6] || '').replace(/"/g, '').trim();
          const observaciones = (cols[7] || '').replace(/"/g, '').trim();
          const declaredTotal = Number((cols[13] || '').replace(/"/g, '').trim() || 0) || 0;

          ordersMap.set(id, {
            id,
            cliente,
            id_cliente,
            ruta,
            supervisor,
            chofer,
            observaciones,
            fecha,
            articulos: [] as any[],
            seenArticles: new Set<string>(),
            numero_pedido: id.slice(-5),
            declaredTotal,
            status: isRejected ? 'RECHAZADO' : 'COMPLETADO',
            reject_reason: isRejected ? (rawReason || 'Rechazado en meses anteriores') : null
          });
        } else if (isRejected) {
          const existing = ordersMap.get(id);
          existing.status = 'RECHAZADO';
          existing.reject_reason = rawReason || existing.reject_reason || 'Rechazado en meses anteriores';
        }

        const qty = Number((cols[8] || '').replace(/"/g, '').trim() || 0);
        const unidad = (cols[9] || '').replace(/"/g, '').trim() || 'UNI';
        const desc = (cols[10] || '').replace(/"/g, '').trim();
        const precio = Number((cols[11] || '').replace(/"/g, '').trim() || 0) || 0;
        const rawSub = Number((cols[12] || '').replace(/"/g, '').trim() || 0) || 0;
        const subTotal = qty > 0 && precio > 0 ? Number((qty * precio).toFixed(2)) : Number(rawSub.toFixed(2));

        if (qty > 0 && desc) {
          const ord = ordersMap.get(id);
          const artKey = `${desc}|${qty}|${precio}|${subTotal}`;
          if (!ord.seenArticles.has(artKey)) {
            ord.seenArticles.add(artKey);
            ord.articulos.push({
              codigo: '',
              cantidad_solicitada: qty,
              unidad_medida: unidad,
              descripcion: desc,
              precio_unitario: precio,
              sub_total: subTotal
            });
          }
        }
      }

      const rowMap = new Map<string, any>();

      for (const o of ordersMap.values()) {
        const sumArticulos = Number(
          o.articulos.reduce((acc: number, a: any) => acc + (Number(a.sub_total) || 0), 0).toFixed(2)
        );
        const finalTotal = o.declaredTotal > 0 ? Number(o.declaredTotal.toFixed(2)) : sumArticulos;
        const createdIso = `${o.fecha}T12:00:00.000Z`;
        const statusHistory =
          o.status === 'RECHAZADO'
            ? [
                {
                  status: 'RECHAZADO',
                  department: 'Sistema',
                  changedBy: 'Admin',
                  timestamp: createdIso,
                  reason: o.reject_reason || 'Rechazado en meses anteriores',
                  note: o.reject_reason || 'Rechazado en meses anteriores'
                }
              ]
            : [
                {
                  status: 'COMPLETADO',
                  department: 'Facturación',
                  changedBy: 'Sistema',
                  timestamp: createdIso,
                  reason: 'Pedido histórico facturado'
                }
              ];

        rowMap.set(o.id, {
          id: o.id,
          numero_pedido: o.numero_pedido,
          cliente: o.cliente,
          id_cliente: o.id_cliente,
          ruta: o.ruta,
          supervisor: o.supervisor,
          chofer: o.chofer,
          observaciones: o.observaciones,
          fecha: o.fecha,
          articulos: o.articulos,
          total_pedido: finalTotal,
          monto_pedido: finalTotal,
          status: o.status,
          reject_reason: o.reject_reason,
          status_history: statusHistory,
          raw_order: {
            id_cliente: o.id_cliente,
            cliente: o.cliente,
            vendedor: o.ruta,
            vendedores: o.ruta,
            ruta: o.ruta,
            supervisor: o.supervisor,
            chofer: o.chofer,
            observaciones: o.observaciones,
            fecha: o.fecha,
            numero_pedido: o.numero_pedido,
            total_pedido: finalTotal,
            monto_pedido: finalTotal,
            total_renglones: o.articulos.length,
            articulos: o.articulos
          },
          created_at: createdIso,
          updated_at: createdIso,
          is_archived: true
        });
      }

      // 3. Leer respaldo JSON de cierre de Octubre (server/data/octubre_ultima_semana_2026.json)
      const lateOctPath = resolveServerDataPath('octubre_ultima_semana_2026.json');
      if (lateOctPath) {
        try {
          const lateOctOrders = JSON.parse(fs.readFileSync(lateOctPath, 'utf8'));
          if (Array.isArray(lateOctOrders)) {
            for (const lo of lateOctOrders) {
              if (!lo || !lo.id) continue;
              const normFecha = standardizeHistoryDate(lo.fecha || lo.raw_order?.fecha);
              if (!normFecha || normFecha >= firstDayDateStr) continue;
              rowMap.set(String(lo.id), {
                ...lo,
                id: String(lo.id),
                fecha: normFecha,
                status: lo.status || 'COMPLETADO',
                created_at: lo.created_at || `${normFecha}T16:00:00.000Z`,
                updated_at: lo.updated_at || lo.created_at || `${normFecha}T16:00:00.000Z`,
                is_archived: true
              });
            }
          }
        } catch (octErr) {
          console.warn('Warning reading octubre_ultima_semana_2026.json for history:', octErr);
        }
      }

      const mappedOrders = Array.from(rowMap.values())
        .filter(row => !isTestOrGhostOrder(row))
        .map(row => {
          const o = mapSupabaseToDbOrder(row);
          o.isArchived = true;
          return o;
        })
        .filter(o => o.status !== 'POR_VALIDAR' && o.status !== 'ERROR_FORMATO');

      if (mappedOrders.length > 0) {
        cachedArchiveHistoryOrders = mappedOrders;
        cachedArchiveHistoryCutoff = firstDayDateStr;
        lastArchiveHistoryFetch = Date.now();
      }
      return mappedOrders;
    } catch (err) {
      console.error('Error loading read-only historical archive orders:', err);
      return cachedArchiveHistoryOrders || [];
    } finally {
      archiveLoadInFlight = null;
    }
  })();

  return archiveLoadInFlight;
}

// Pre-cargar caché de historial en segundo plano al iniciar el servidor (solo lectura)
setTimeout(() => {
  const now = new Date();
  const firstDayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  loadReadOnlyHistoricalArchiveOrders(firstDayDateStr).catch(() => {});
}, 100);

// GET histórico de pedidos archivados y de meses anteriores (estrictamente SOLO LECTURA)
router.get('/history', async (_req, res) => {
  try {
    const now = new Date();
    const firstDayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const firstDayIsoStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)).toISOString();

    const fetchSupabaseHistoryOrders = async (): Promise<DbOrder[]> => {
      const nowMs = Date.now();
      if (cachedSupabaseHistoryOrders && nowMs - lastSupabaseHistoryFetch < SUPABASE_HISTORY_CACHE_TTL_MS) {
        return cachedSupabaseHistoryOrders;
      }

      let allData: any[] = [];
      let page = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .or(`is_archived.eq.true,fecha.lt.${firstDayDateStr},created_at.lt.${firstDayIsoStr}`)
          .order('created_at', { ascending: false })
          .range(page * limit, (page + 1) * limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          if (data.length < limit) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      const mapped = allData
        .filter(row => row && row.id && !isTestOrGhostOrder(row))
        .map(row => {
          const o = mapSupabaseToDbOrder(row);
          o.isArchived = true;
          return o;
        })
        .filter(o => o.status !== 'POR_VALIDAR' && o.status !== 'ERROR_FORMATO');

      cachedSupabaseHistoryOrders = mapped;
      lastSupabaseHistoryFetch = Date.now();
      return mapped;
    };

    const [supabaseOrdersResult, archiveOrdersResult] = await Promise.allSettled([
      fetchSupabaseHistoryOrders(),
      loadReadOnlyHistoricalArchiveOrders(firstDayDateStr)
    ]);

    const mergedById = new Map<string, DbOrder>();

    if (archiveOrdersResult.status === 'fulfilled' && Array.isArray(archiveOrdersResult.value)) {
      for (const ord of archiveOrdersResult.value) {
        if (ord && ord.id) mergedById.set(String(ord.id), ord);
      }
    }

    if (supabaseOrdersResult.status === 'fulfilled' && Array.isArray(supabaseOrdersResult.value)) {
      for (const ord of supabaseOrdersResult.value) {
        if (ord && ord.id) mergedById.set(String(ord.id), ord);
      }
    } else if (supabaseOrdersResult.status === 'rejected') {
      console.error('Warning querying Supabase orders for history:', supabaseOrdersResult.reason);
    }

    const orders = Array.from(mergedById.values()).sort((a, b) => {
      const fechaA = a.order?.fecha || '';
      const fechaB = b.order?.fecha || '';
      if (fechaA !== fechaB) return fechaB.localeCompare(fechaA);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    res.json(orders);
  } catch (err: any) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST nuevo pedido manual
router.post('/', async (req, res) => {
  const newOrder: DbOrder = req.body;
  const userRole = getUserRole(req);

  if (isTestOrGhostOrder(newOrder)) {
    return res.status(200).json({ ignored: true, message: 'Pedido de prueba QA ignorado.' });
  }

  // Validación de rol: solo ventas, gerencia o master pueden emitir pedidos nuevos
  if (!['ventas', 'gerencia', 'master'].includes(userRole)) {
    return res.status(403).json({ error: 'Acceso denegado: Solo Ventas puede emitir nuevos pedidos.' });
  }
  
  try {
    // --- Duplication Check ---
    let dupQuery = supabase
      .from('orders')
      .select('id, numero_pedido, fecha, observaciones, articulos')
      .eq('is_archived', false);
      
    if (newOrder.order.id_cliente) {
      dupQuery = dupQuery.eq('id_cliente', newOrder.order.id_cliente);
    } else if (newOrder.order.cliente) {
      dupQuery = dupQuery.eq('cliente', newOrder.order.cliente);
    }
    const { data: existingClientOrders, error: dupErr } = await dupQuery;
    
    if (!dupErr && existingClientOrders && existingClientOrders.length > 0) {
      for (const ex of existingClientOrders) {
        if (ex.articulos && ex.articulos.length === newOrder.order.articulos.length) {
           const isSameItems = newOrder.order.articulos.every((newArt: any) => {
             return ex.articulos.some((exArt: any) => 
               (exArt.descripcion === newArt.descripcion || exArt.codigo === newArt.codigo) &&
               exArt.cantidad_solicitada === newArt.cantidad_solicitada
             );
           });
           
           if (isSameItems) {
             const obs1 = (newOrder.order.observaciones || '').trim().toLowerCase();
             const obs2 = (ex.observaciones || '').trim().toLowerCase();
             if (obs1 === obs2) {
               return res.status(409).json({
                 error: `Ya este pedido lo envió. Fecha: ${ex.fecha}, Correlativo: ${ex.numero_pedido || 'N/A'}`
               });
             }
           }
        }
      }
    }
    // --- End Duplication Check ---

    // Asignación o Verificación de Correlativo (Evita Colisiones)
    let assignedNum = newOrder.order.numero_pedido;
    if (!assignedNum || assignedNum === 'APP-FDV' || !/^\d+$/.test(assignedNum.trim())) {
      assignedNum = await getNextCorrelativo();
      newOrder.order.numero_pedido = assignedNum;
    } else {
      // Verificar si el correlativo propuesto por el frontend ya existe
      const { data: col } = await supabase
        .from('orders')
        .select('id')
        .eq('numero_pedido', assignedNum.trim())
        .limit(1);

      if (col && col.length > 0) {
        // Colisión detectada: reasignar automáticamente el siguiente número único
        assignedNum = await getNextCorrelativo();
        newOrder.order.numero_pedido = assignedNum;
      }
    }

    const serverUser = getUserName(req);
    if (newOrder.statusHistory && Array.isArray(newOrder.statusHistory)) {
      newOrder.statusHistory.forEach((h: any) => {
        if (!h.changedBy || h.changedBy === 'Usuario Actual' || h.changedBy === 'Desconocido' || h.changedBy === 'Usuario') {
          h.changedBy = serverUser;
        }
      });
    }

    const { data, error } = await supabase.from('orders').insert({
      id: newOrder.id,
      cliente: newOrder.order.cliente,
      id_cliente: newOrder.order.id_cliente,
      ruta: newOrder.order.ruta,
      supervisor: newOrder.order.supervisor,
      chofer: newOrder.order.chofer,
      observaciones: newOrder.order.observaciones,
      fecha: newOrder.order.fecha,
      total_pedido: newOrder.order.total_pedido,
      monto_pedido: newOrder.order.total_pedido,
      numero_pedido: newOrder.order.numero_pedido,
      status: newOrder.status,
      articulos: newOrder.order.articulos,
      status_history: newOrder.statusHistory,
      raw_order: newOrder.order,
      sucursal: 'Maracaibo',
      version: 1,
      is_archived: false
    }).select().single();
    
    if (error) throw error;
    
    res.status(201).json(mapSupabaseToDbOrder(data));
  } catch (err: any) {
    console.error('Error saving to Supabase:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update order status (con validación estricta de Roles por transición)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, historyItem, cxcNote, factNote, rejectReason } = req.body;
  const userRole = getUserRole(req);
  const serverUser = getUserName(req);
  
  // Validación de Roles en el Backend:
  if (status === 'PENDIENTE_FACTURACION') {
    if (!['cxc', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado: Solo Cuentas por Cobrar puede aprobar a Facturación.' });
    }
  } else if (status === 'COMPLETADO') {
    if (!['facturacion', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado: Solo Facturación puede completar pedidos.' });
    }
  } else if (status === 'RECHAZADO') {
    if (!['cxc', 'facturacion', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado: No tiene permisos para rechazar pedidos.' });
    }
  }

  try {
    const { data: existingData, error: fetchErr } = await supabase
      .from('orders')
      .select('status_history')
      .eq('id', id)
      .single();
      
    if (fetchErr) throw fetchErr;

    const newHistory = existingData.status_history || [];
    if (historyItem) {
      if (!historyItem.changedBy || historyItem.changedBy === 'Usuario Actual' || historyItem.changedBy === 'Desconocido' || historyItem.changedBy === 'Usuario') {
        historyItem.changedBy = serverUser;
      }
      newHistory.push(historyItem);
    }

    const updatePayload: any = {
      status,
      status_history: newHistory,
      updated_at: new Date().toISOString()
    };

    if (cxcNote !== undefined) updatePayload.cxc_note = cxcNote;
    if (factNote !== undefined) updatePayload.fact_note = factNote;
    if (rejectReason !== undefined) updatePayload.reject_reason = rejectReason;

    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select(ACTIVE_ORDERS_COLUMNS)
      .single();

    if (error) throw error;
    
    res.json(mapSupabaseToDbOrder(data));
  } catch (err: any) {
    console.error('Error updating Supabase:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/batch-status (actualización masiva concurrente en lote para máxima velocidad)
router.post('/batch-status', async (req, res) => {
  const { ids, status, department: reqDept } = req.body;
  const userRole = getUserRole(req);
  const serverUser = getUserName(req);

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs requerida' });
  }

  // Validación de Roles en el Backend:
  if (status === 'PENDIENTE_FACTURACION') {
    if (!['cxc', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado: Solo Cuentas por Cobrar puede aprobar a Facturación.' });
    }
  } else if (status === 'COMPLETADO') {
    if (!['facturacion', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado: Solo Facturación puede completar pedidos.' });
    }
  } else if (status === 'RECHAZADO') {
    if (!['cxc', 'facturacion', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado: No tiene permisos para rechazar pedidos.' });
    }
  }

  const dept = reqDept || (status === 'COMPLETADO' ? 'Facturación' : status === 'PENDIENTE_FACTURACION' ? 'Cuentas por Cobrar' : 'Sistema');

  try {
    const { data: existingRows, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status_history')
      .in('id', ids);

    if (fetchErr) throw fetchErr;

    const nowIso = new Date().toISOString();

    const updatePromises = (existingRows || []).map(async (row) => {
      const history = Array.isArray(row.status_history) ? [...row.status_history] : [];
      history.push({
        status,
        department: dept,
        changedBy: serverUser,
        timestamp: nowIso
      });

      return supabase
        .from('orders')
        .update({
          status,
          status_history: history,
          updated_at: nowIso
        })
        .eq('id', row.id)
        .select(ACTIVE_ORDERS_COLUMNS)
        .single();
    });

    const results = await Promise.all(updatePromises);
    const updatedOrders = results.filter(r => r.data && !r.error).map(r => mapSupabaseToDbOrder(r.data));

    res.json({ success: true, count: updatedOrders.length, orders: updatedOrders });
  } catch (err: any) {
    console.error('Error in batch status update:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT full order edit (usado para editar o aprobar pedidos de la Sala de Espera)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { orderData, status, historyItem } = req.body;
  const userRole = getUserRole(req);
  
  try {
    const { data: existingData, error: fetchErr } = await supabase
      .from('orders').select('*').eq('id', id).single();
    if (fetchErr || !existingData) throw fetchErr || new Error('Pedido no encontrado');

    // REGLA ESTRICTA DE NEGOCIO:
    // El pedido solo puede ser modificado en el módulo de Ventas (o por Gerencia/Master).
    // Cuentas por Cobrar y Facturación tienen acceso de SOLO LECTURA a los pedidos y no pueden alterar precios, artículos ni conceptos.
    if (!['ventas', 'gerencia', 'master'].includes(userRole)) {
      return res.status(403).json({ 
        error: 'Acceso denegado: Los pedidos solo pueden ser modificados en el módulo de Ventas. Cuentas por Cobrar y Facturación no tienen permisos para modificar precios ni conceptos.' 
      });
    }

    const serverUser = getUserName(req);
    const updatedHistory = existingData.status_history ? [...existingData.status_history] : [];
    if (historyItem) {
      if (!historyItem.changedBy || historyItem.changedBy === 'Usuario Actual' || historyItem.changedBy === 'Desconocido' || historyItem.changedBy === 'Usuario') {
        historyItem.changedBy = serverUser;
      }
      updatedHistory.push(historyItem);
    }

    // Si viene de Sala de Espera ('POR_VALIDAR', 'ERROR_FORMATO' o estado pendiente externo) y pasa a 'PENDIENTE_CXC', asignamos correlativo consecutivo
    const existingRawStatus = String(existingData.status || '').trim().toUpperCase();
    const cameFromWaitingRoom =
      WAITING_ROOM_RAW_STATUSES.has(existingRawStatus) || existingRawStatus === 'ERROR_FORMATO';
    let finalCorrelativo = existingData.numero_pedido;
    if (cameFromWaitingRoom && status === 'PENDIENTE_CXC') {
      finalCorrelativo = await getNextCorrelativo();
      orderData.numero_pedido = finalCorrelativo;
    }

    const sanitizedArticulos = Array.isArray(orderData.articulos)
      ? orderData.articulos.map((it: any) => {
          const cant = Number(it?.cantidad_solicitada) || 0;
          const precio = Number(it?.precio_unitario) || 0;
          const subTotal = Number((cant * precio).toFixed(2));
          return {
            ...it,
            cantidad_solicitada: cant,
            precio_unitario: precio,
            sub_total: subTotal
          };
        })
      : [];
    const recalculatedTotal = Number(
      sanitizedArticulos.reduce((acc: number, it: any) => acc + (Number(it.sub_total) || 0), 0).toFixed(2)
    );
    const finalTotalPedido =
      recalculatedTotal > 0 ? recalculatedTotal : Number(orderData.total_pedido || orderData.monto_pedido || 0);

    const updateFields: any = {
      numero_pedido: finalCorrelativo,
      cliente: orderData.cliente,
      id_cliente: orderData.id_cliente,
      ruta: orderData.ruta,
      supervisor: orderData.supervisor,
      chofer: orderData.chofer,
      observaciones: orderData.observaciones,
      total_pedido: finalTotalPedido,
      monto_pedido: finalTotalPedido,
      articulos: sanitizedArticulos,
      raw_order: {
        ...(existingData.raw_order && typeof existingData.raw_order === 'object' ? existingData.raw_order : {}),
        ...orderData,
        articulos: sanitizedArticulos,
        total_pedido: finalTotalPedido,
        monto_pedido: finalTotalPedido,
        numero_pedido: finalCorrelativo
      },
      status: status || existingData.status,
      status_history: updatedHistory,
      updated_at: new Date().toISOString()
    };

    if (cameFromWaitingRoom && status === 'PENDIENTE_CXC') {
      const prevNote = String(existingData.cxc_note || '');
      if (prevNote.startsWith('ERROR_FORMATO:') || prevNote.startsWith('AVISO_PARSING:')) {
        updateFields.cxc_note = null;
      }
    }

    const { data: updatedRow, error: updateErr } = await supabase
      .from('orders')
      .update(updateFields)
      .eq('id', id)
      .select(ACTIVE_ORDERS_COLUMNS)
      .single();

    if (updateErr || !updatedRow) throw updateErr || new Error('No se pudo actualizar el pedido en base de datos');

    if (cameFromWaitingRoom && status === 'PENDIENTE_CXC') {
      markSairuFirestoreProcessed(id).catch(() => {});
    }

    const mappedOrder = mapSupabaseToDbOrder(updatedRow);
    res.json({ ...mappedOrder, success: true, numero_pedido: finalCorrelativo });
  } catch (err: any) {
    console.error('Update full order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update supervisor
router.put('/:id/supervisor', async (req, res) => {
  const { id } = req.params;
  const { supervisor } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ supervisor, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(mapSupabaseToDbOrder(data));
  } catch (err: any) {
    console.error('Error updating supervisor:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE single order
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userRole = getUserRole(req);

  if (!['ventas', 'gerencia', 'master', 'cxc'].includes(userRole)) {
    return res.status(403).json({ error: 'Acceso denegado: No tiene permisos para eliminar pedidos.' });
  }

  try {
    deletedAlkostoIdsMemory.add(id);
    const serverUser = getUserName(req);
    const [{ error }] = await Promise.all([
      supabase.from('orders').delete().eq('id', id),
      deleteFromSairuFirestore([id], serverUser)
    ]);

    if (error) throw error;
    res.json({ success: true, id });
  } catch (err: any) {
    console.error('Error deleting order:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST batch delete orders
router.post('/batch-delete', async (req, res) => {
  const { ids } = req.body;
  const userRole = getUserRole(req);

  if (!['ventas', 'gerencia', 'master', 'cxc'].includes(userRole)) {
    return res.status(403).json({ error: 'Acceso denegado: No tiene permisos para eliminar pedidos.' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs requerida' });
  }

  try {
    for (const id of ids) {
      if (id) deletedAlkostoIdsMemory.add(String(id));
    }
    const serverUser = getUserName(req);
    const [{ error }] = await Promise.all([
      supabase.from('orders').delete().in('id', ids),
      deleteFromSairuFirestore(ids, serverUser)
    ]);

    if (error) throw error;
    res.json({ success: true, count: ids.length, deletedIds: ids });
  } catch (err: any) {
    console.error('Error in batch delete orders:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
