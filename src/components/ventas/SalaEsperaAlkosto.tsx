import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/index';
import {
  Clock,
  Eye,
  Smartphone,
  Search,
  CheckCircle2,
  Building2,
  Store,
  ShoppingBag,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  MapPin,
  FileText,
  UserCheck,
  Package,
  Hash
} from 'lucide-react';
import { OrderModal } from '../shared/OrderModal';
import { DbOrder } from '../../types';

const ALKOSTO_CODES = new Set([
  '7497', '7498', '7499', '7500', '7501', '7502', '7503', '7680', '7905', '8160', '8306', '1560',
  '007497', '007498', '007499', '007500', '007501', '007502', '007503', '007680', '007905', '008160', '008306', '001560'
]);
const FAMILIA_CODES = new Set([
  '7489', '7490', '7491', '7492', '7493', '7494', '8229', '5373',
  '007489', '007490', '007491', '007492', '007493', '007494', '008229', '005373'
]);

const WAITING_ROOM_STATUSES = new Set([
  'POR_VALIDAR',
  'POR VALIDAR',
  'ERROR_FORMATO',
  'PENDIENTE',
  'EN_ESPERA',
  'EN ESPERA',
  'ENVIADO',
  'POR_APROBAR',
  'RECIBIDO'
]);

export function detectOrderChain(o: DbOrder): 'ALKOSTO' | 'FAMILIA' | 'OTRA' {
  const cad = String(o.order?.cadena || '').trim().toUpperCase();
  const cli = String(o.order?.sucursal_cliente || o.order?.cliente || '').trim().toUpperCase();
  const idCli = String(o.order?.id_cliente || '').trim().toUpperCase();
  const idCliPadded = /^\d+$/.test(idCli) ? idCli.padStart(6, '0') : idCli;
  const orig = String(o.order?.origen || '').trim().toUpperCase();
  const obs = String(o.order?.observacion_formateada || o.order?.observaciones || '').trim().toUpperCase();
  const id = String(o.id || '').trim().toUpperCase();
  const combined = `${cad} ${cli} ${idCli} ${orig} ${obs}`;

  if (
    cad.includes('FAMILIA') ||
    cli.includes('FAMILIA') ||
    orig.includes('FAMILIA') ||
    obs.includes('OC FAMILIA') ||
    id.startsWith('ALK-FC') ||
    FAMILIA_CODES.has(idCli) ||
    FAMILIA_CODES.has(idCliPadded) ||
    /\bFC0?[1-7]\b|\bFCOP\b/.test(combined)
  ) {
    return 'FAMILIA';
  }

  if (
    cad.includes('ALKOSTO') ||
    cli.includes('ALKOSTO') ||
    orig.includes('ALKOSTO') ||
    obs.includes('OC ALKOSTO') ||
    id.startsWith('ALK-AK') ||
    ALKOSTO_CODES.has(idCli) ||
    ALKOSTO_CODES.has(idCliPadded) ||
    /\bAK0?[1-9]\b|\bAK10\b|\bAKOP\b/.test(combined)
  ) {
    return 'ALKOSTO';
  }

  return 'OTRA';
}

export function isAlkostoSairuOrder(o: DbOrder): boolean {
  if (!o || detectOrderChain(o) !== 'ALKOSTO') return false;
  const ord = o.order || ({} as any);
  const firstHistoryActor = Array.isArray(o.statusHistory) && o.statusHistory.length > 0 ? o.statusHistory[0]?.changedBy : '';
  const rawSellerSignal = `${ord.vendedor || ''} ${ord.ruta || ''} ${ord.supervisor || ''} ${firstHistoryActor || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (!rawSellerSignal) return true; // Pedidos externos de pestaña ALKOSTO sin vendedor explícito pertenecen a Sairu Valles
  return (
    rawSellerSignal.includes('SAIRU') ||
    rawSellerSignal.includes('VALLES') ||
    rawSellerSignal.includes('CUENTAS CLAVE')
  );
}

export function isRecentlyArrivedOrder(o: DbOrder, maxMinutes = 60): boolean {
  if (!o) return false;
  const rawTs = o.updatedAt || o.createdAt;
  if (!rawTs) return false;
  const ts = new Date(rawTs).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts <= maxMinutes * 60 * 1000;
}

export const AlkostoSairuCorporateBadge: React.FC<{ isRecent?: boolean }> = ({ isRecent = false }) => (
  <span
    style={{
      backgroundColor: '#DC2626',
      color: '#FFFFFF',
      borderColor: '#09090B'
    }}
    className="inline-flex items-center overflow-hidden rounded-full border-[1.5px] text-[10px] font-black uppercase tracking-wider shadow-sm"
    title="Pedido recibido desde la pestaña ALKOSTO - Perfil Sairu Valles (App de Vendedores)"
  >
    <span
      style={{ backgroundColor: '#09090B', color: '#FFFFFF' }}
      className="inline-flex items-center gap-1 px-2 py-0.5 font-black"
    >
      {isRecent && (
        <span
          style={{ backgroundColor: '#DC2626' }}
          className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
        />
      )}
      <Store size={10} style={{ color: '#FFFFFF' }} />
      <span>ALKOSTO</span>
    </span>
    <span
      style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
      className="inline-flex items-center gap-1 px-2 py-0.5 font-extrabold"
    >
      <span>SAIRU VALLES</span>
      {isRecent && (
        <span
          style={{ backgroundColor: '#09090B', color: '#FFFFFF' }}
          className="ml-0.5 rounded px-1 py-[1px] text-[8px] font-black leading-none tracking-widest"
        >
          NUEVO
        </span>
      )}
    </span>
  </span>
);

export function extractOrderReferenceMeta(o: DbOrder): {
  formattedOrderId: string;
  clientCode: string;
  chainLabel: string;
  sedeName: string;
  numeroOc: string;
  direccionDespacho: string;
  vendedorCanal: string;
  validItemCount: number;
  verifiedTotal: number;
  standardizedObs: string;
} {
  const ord = o.order || ({} as any);
  const chainType = detectOrderChain(o);
  const chainLabel =
    chainType === 'FAMILIA'
      ? 'FAMILIA CENTER'
      : chainType === 'ALKOSTO'
        ? 'ALKOSTO'
        : 'SIN CLASIFICAR / REVISIÓN';

  const rawNum = String(ord.numero_pedido || '').trim();
  const shortIdFallback = String(o.id || '')
    .replace(/^alk-(?:doc|ak\d+|fc\d+)-/i, '')
    .slice(0, 8)
    .toUpperCase();
  const formattedOrderId =
    rawNum && rawNum !== 'APP-FDV' && rawNum !== 'PENDIENTE' && rawNum !== 'AUTO'
      ? `#${rawNum.padStart(4, '0')}`
      : shortIdFallback
        ? `#${shortIdFallback}`
        : '#S/N';

  const rawClientCode = String(ord.id_cliente || '').trim();
  const clientCode = /^\d+$/.test(rawClientCode) ? rawClientCode.padStart(6, '0') : rawClientCode || 'S/C';

  const rawSucursal = String(ord.sucursal || o.sucursal || '').trim();
  const cleanSucursalFallback =
    rawSucursal && rawSucursal.toUpperCase() !== 'MARACAIBO' ? rawSucursal : '';
  const sedeName = String(
    ord.sucursal_cliente ||
      (ord.cliente && String(ord.cliente).trim().toUpperCase() !== 'ALKOSTO' ? ord.cliente : '') ||
      cleanSucursalFallback ||
      ord.cliente ||
      'SUCURSAL POR DEFINIR'
  )
    .trim()
    .toUpperCase();
  const rawObs = String(ord.observacion_formateada || ord.observaciones || '').trim();

  const ocMatch =
    rawObs.match(/OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?|OTRA\s+CADENA)\s*:\s*([A-Z0-9-]+)/i) ||
    rawObs.match(/\b(?:OC|ORDEN\s+DE\s+COMPRA)\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  const numeroOc = String(ord.numero_oc || (ocMatch ? ocMatch[1] : '') || 'S/N').trim();

  const dirFromObsMatch = rawObs.match(/\|\s*Dir:\s*(.+)$/i);
  const cleanedRawObsDir = rawObs
    .replace(/\s*\|\s*OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?|OTRA\s+CADENA)\s*:\s*[^|]+/gi, '')
    .replace(/\b(?:OC|ORDEN\s+DE\s+COMPRA)\s*[:#]?\s*[A-Z0-9-]{4,}\s*\|?\s*/gi, '')
    .replace(/\bRef\.\s*Cadenas\s*:\s*#[A-Z0-9-]+\s*\|?\s*/gi, '')
    .replace(/^.*\|\s*Dir:\s*/i, '')
    .trim();

  const direccionDespacho = String(
    ord.direccion_despacho || (dirFromObsMatch ? dirFromObsMatch[1].trim() : cleanedRawObsDir) || sedeName
  ).trim();

  const vendedorCanal = String(ord.vendedor || ord.ruta || 'SAIRU VALLES / CUENTAS CLAVE 2').trim().toUpperCase();

  const arts = Array.isArray(ord.articulos) ? ord.articulos : [];
  const validItems = arts.filter(
    a =>
      a &&
      (String(a.descripcion || '').trim() !== '' ||
        String(a.codigo || '').trim() !== '' ||
        Number(a.cantidad_solicitada) > 0) &&
      String(a.codigo || '').toUpperCase() !== 'ERROR'
  );
  const validItemCount = validItems.length;

  const calculatedSum = Number(
    arts
      .reduce((acc, a) => {
        const cant = Number(a?.cantidad_solicitada) || 0;
        const precio = Number(a?.precio_unitario) || 0;
        const sub = cant > 0 && precio > 0 ? Number((cant * precio).toFixed(2)) : Number(a?.sub_total) || 0;
        return acc + sub;
      }, 0)
      .toFixed(2)
  );
  const declaredTotal = Number(ord.total_pedido ?? ord.monto_pedido ?? 0);
  const verifiedTotal =
    calculatedSum > 0
      ? calculatedSum
      : Number.isFinite(declaredTotal) && declaredTotal > 0
        ? Number(declaredTotal.toFixed(2))
        : 0;

  const standardizedObs =
    rawObs.includes(' | OC ') && rawObs.includes(' | Dir: ')
      ? rawObs
      : `${sedeName} | OC ${chainType === 'FAMILIA' ? 'FAMILIA CENTER' : 'ALKOSTO'}: ${numeroOc} | Dir: ${direccionDespacho}`;

  return {
    formattedOrderId,
    clientCode,
    chainLabel,
    sedeName,
    numeroOc,
    direccionDespacho,
    vendedorCanal,
    validItemCount,
    verifiedTotal,
    standardizedObs
  };
}

export const SalaEsperaAlkosto: React.FC = () => {
  const {
    orders,
    fetchOrders,
    updateFullOrder,
    deleteOrder,
    deleteBatchOrders,
    syncAlkostoOrders,
    subscribeToWaitingRoomRealtime
  } = useAppStore();
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);
  const [selectedChain, setSelectedChain] = useState<'TODAS' | 'ALKOSTO' | 'FAMILIA' | 'OTRA'>('TODAS');
  const [search, setSearch] = useState('');
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Sincronización en Tiempo Real (Supabase postgres_changes INSERT/UPDATE) + Re-consulta inmediata al recuperar foco
  useEffect(() => {
    const unsubscribeRealtime = subscribeToWaitingRoomRealtime();
    fetchOrders().catch(() => {});
    syncAlkostoOrders().catch(() => {});

    const interval = setInterval(() => {
      syncAlkostoOrders().catch(() => {});
    }, 10000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders().catch(() => {});
        syncAlkostoOrders().catch(() => {});
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      unsubscribeRealtime();
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [fetchOrders, syncAlkostoOrders, subscribeToWaitingRoomRealtime]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedbackBanner(null);
    try {
      const count = await syncAlkostoOrders();
      setFeedbackBanner({
        type: 'success',
        message:
          count > 0
            ? `Sincronización completada: se incorporaron/actualizaron ${count} pedido(s) desde la App FDV.`
            : 'Sincronización al día: el 100% de los pedidos emitidos por vendedores están en pantalla.'
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: `Error al sincronizar con App FDV: ${err?.message || 'Verifique su conexión'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtrado sin restricciones + Ordenamiento descendente por llegada para que los pedidos nuevos aparezcan al inicio
  const pendingOrders = useMemo(() => {
    const getArrivalTs = (ord: DbOrder): number => {
      const rawTs = ord.updatedAt || ord.createdAt || '';
      const parsed = rawTs ? new Date(rawTs).getTime() : 0;
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
      const created = ord.createdAt ? new Date(ord.createdAt).getTime() : 0;
      return Number.isFinite(created) ? created : 0;
    };

    return orders
      .filter(o => {
        if (o.isArchived) return false;
        const st = String(o.status || '').trim().toUpperCase();
        return WAITING_ROOM_STATUSES.has(st);
      })
      .sort((a, b) => getArrivalTs(b) - getArrivalTs(a));
  }, [orders]);

  // Clasificación insensible a mayúsculas/minúsculas y espacios (con pestaña Sin Clasificar / Revisión)
  const alkostoOrders = useMemo(() => {
    return pendingOrders.filter(o => detectOrderChain(o) === 'ALKOSTO');
  }, [pendingOrders]);

  const familiaOrders = useMemo(() => {
    return pendingOrders.filter(o => detectOrderChain(o) === 'FAMILIA');
  }, [pendingOrders]);

  const sinClasificarOrders = useMemo(() => {
    return pendingOrders.filter(o => detectOrderChain(o) === 'OTRA');
  }, [pendingOrders]);

  // Cuadre matemático de KPIs: suma dinámica verificada del 100% de los pedidos en Sala de Espera
  const totalMontoGeneral = useMemo(() => {
    return Number(
      pendingOrders.reduce((sum, o) => sum + extractOrderReferenceMeta(o).verifiedTotal, 0).toFixed(2)
    );
  }, [pendingOrders]);

  // Filtrado según la pestaña activa y el buscador
  const filteredOrders = useMemo(() => {
    let list = pendingOrders;
    if (selectedChain === 'ALKOSTO') list = alkostoOrders;
    else if (selectedChain === 'FAMILIA') list = familiaOrders;
    else if (selectedChain === 'OTRA') list = sinClasificarOrders;

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(o => {
        const meta = extractOrderReferenceMeta(o);
        return (
          meta.sedeName.toLowerCase().includes(term) ||
          meta.clientCode.toLowerCase().includes(term) ||
          meta.formattedOrderId.toLowerCase().includes(term) ||
          meta.numeroOc.toLowerCase().includes(term) ||
          meta.direccionDespacho.toLowerCase().includes(term) ||
          meta.vendedorCanal.toLowerCase().includes(term)
        );
      });
    }

    return list;
  }, [pendingOrders, selectedChain, alkostoOrders, familiaOrders, sinClasificarOrders, search]);

  // Log de diagnóstico de auditoría en consola (Fase 4.3)
  useEffect(() => {
    console.info(
      `[Auditoría Sala de Espera] Total pedidos activos en BD: ${orders.length} | En Sala de Espera (BD): ${pendingOrders.length} | Clasificación [Alkosto: ${alkostoOrders.length} + Familia Center: ${familiaOrders.length} + Sin Clasificar: ${sinClasificarOrders.length} = ${alkostoOrders.length + familiaOrders.length + sinClasificarOrders.length}] | Renderizados en vista actual (${selectedChain}): ${filteredOrders.length} | Monto en Espera Verificado: $${totalMontoGeneral.toFixed(2)}`
    );
  }, [orders.length, pendingOrders.length, alkostoOrders.length, familiaOrders.length, sinClasificarOrders.length, selectedChain, filteredOrders.length, totalMontoGeneral]);

  const getChainBadge = (o: DbOrder) => {
    const chain = detectOrderChain(o);
    if (chain === 'ALKOSTO') {
      if (isAlkostoSairuOrder(o)) {
        return <AlkostoSairuCorporateBadge isRecent={isRecentlyArrivedOrder(o)} />;
      }
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
          <Store size={11} className="text-red-600" /> ALKOSTO
        </span>
      );
    }
    if (chain === 'FAMILIA') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
          <Building2 size={11} className="text-emerald-600" /> FAMILIA CENTER
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
        <ShoppingBag size={11} className="text-amber-700" /> SIN CLASIFICAR / REVISIÓN
      </span>
    );
  };

  const handleQuickApprove = async (order: DbOrder) => {
    if (approvingIds.has(order.id)) return; // Protección anti doble-clic

    const meta = extractOrderReferenceMeta(order);
    const isFormatError =
      order.status === 'ERROR_FORMATO' || String(order.cxcNote || '').startsWith('ERROR_FORMATO:');

    // Validación estricta antes de pasar a Ventas / CxC (Fase 3.2)
    const missingReasons: string[] = [];
    if (isFormatError) {
      missingReasons.push('el pedido presenta alerta de Error de Formato');
    }
    if (meta.validItemCount === 0 || meta.verifiedTotal <= 0) {
      missingReasons.push('debe tener al menos 1 renglón válido con cantidad y precio mayores a $0.00');
    }
    if (!meta.sedeName || meta.sedeName === 'SUCURSAL POR DEFINIR') {
      missingReasons.push('falta identificar el cliente/sucursal');
    }
    if (!meta.numeroOc || meta.numeroOc === 'S/N') {
      missingReasons.push('falta el número de Orden de Compra (OC)');
    }
    if (!meta.direccionDespacho) {
      missingReasons.push('falta la Dirección de Despacho');
    }

    if (missingReasons.length > 0) {
      setFeedbackBanner({
        type: 'warning',
        message: `Atención (${meta.formattedOrderId} - ${meta.sedeName}): Antes de aprobar a CxC ${missingReasons.join(', ')}. Se abrió "Validar Formato" para completar los datos.`
      });
      setSelectedOrder({
        ...order,
        order: {
          ...order.order,
          numero_oc: meta.numeroOc,
          direccion_despacho: meta.direccionDespacho,
          observaciones: meta.standardizedObs,
          observacion_formateada: meta.standardizedObs,
          total_pedido: meta.verifiedTotal,
          monto_pedido: meta.verifiedTotal
        }
      });
      return;
    }

    if (
      !window.confirm(
        `¿Aprobar el pedido ${meta.formattedOrderId} de "${meta.sedeName}" (OC: ${meta.numeroOc} | Monto: $${meta.verifiedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) y enviarlo a Cuentas por Cobrar?`
      )
    ) {
      return;
    }

    setApprovingIds(prev => new Set(prev).add(order.id));
    setFeedbackBanner(null);
    try {
      await updateFullOrder(
        order.id,
        {
          ...order.order,
          numero_oc: meta.numeroOc,
          direccion_despacho: meta.direccionDespacho,
          observaciones: meta.standardizedObs,
          observacion_formateada: meta.standardizedObs,
          total_pedido: meta.verifiedTotal,
          monto_pedido: meta.verifiedTotal
        },
        'PENDIENTE_CXC'
      );
      setFeedbackBanner({
        type: 'success',
        message: `Pedido ${meta.formattedOrderId} (${meta.sedeName}) aprobado exitosamente y enviado a Cuentas por Cobrar.`
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: `No se pudo aprobar el pedido ${meta.formattedOrderId}: ${err?.message || 'Error de comunicación con el servidor'}`
      });
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleDeleteOrder = async (order: DbOrder) => {
    if (deletingId === order.id) return;
    const meta = extractOrderReferenceMeta(order);
    if (
      !window.confirm(
        `¿Estás seguro de eliminar el pedido ${meta.formattedOrderId} de "${meta.sedeName}" de la Sala de Espera? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setDeletingId(order.id);
    setFeedbackBanner(null);
    try {
      await deleteOrder(order.id);
      setFeedbackBanner({
        type: 'success',
        message: `Pedido ${meta.formattedOrderId} (${meta.sedeName}) eliminado correctamente de la Sala de Espera.`
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: `Error al eliminar pedido: ${err?.message || 'Intente nuevamente'}`
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearWaitingRoom = async () => {
    if (pendingOrders.length === 0 || isClearingAll) return;
    const count = pendingOrders.length;
    if (
      !window.confirm(
        `¿Estás seguro de ELIMINAR TODOS los ${count} pedidos de la Sala de Espera? Esta acción eliminará permanentemente estos pedidos del sistema.`
      )
    ) {
      return;
    }
    setIsClearingAll(true);
    setFeedbackBanner(null);
    try {
      const ids = pendingOrders.map(o => o.id);
      await deleteBatchOrders(ids);
      setFeedbackBanner({
        type: 'success',
        message: `Se eliminaron los ${count} pedidos de la Sala de Espera.`
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: `Error al vaciar la Sala de Espera: ${err?.message || 'Intente nuevamente'}`
      });
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
            <Smartphone className="text-codizulca-red" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                Sala de Espera - Cadenas Comerciales
              </h2>
              <span className="bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                App FDV
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Recepción y validación de órdenes de compra (Alkosto y Familia Center) emitidas por los vendedores
            </p>
          </div>
        </div>

        {/* Resumen Global */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Monto en Espera</p>
            <p className="text-sm font-black text-slate-800">${totalMontoGeneral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="flex items-center justify-center bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs h-10 px-4 rounded-xl shadow-sm">
            {pendingOrders.length} {pendingOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
          </div>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-black h-10 px-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
            title="Sincronizar con App de Alkosto de Sairú"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>Sincronizar</span>
          </button>
          {pendingOrders.length > 0 && (
            <button
              onClick={handleClearWaitingRoom}
              disabled={isClearingAll}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 text-xs font-black h-10 px-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
              title="Eliminar todos los pedidos de la sala de espera"
            >
              {isClearingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>Vaciar Sala</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas visuales de operación y clasificación */}
      {feedbackBanner && (
        <div
          className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
            feedbackBanner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : feedbackBanner.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-[11px] font-black uppercase px-2 py-0.5 rounded hover:bg-black/5 shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {sinClasificarOrders.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>
              Atención: Hay <strong>{sinClasificarOrders.length}</strong> pedido(s) con nombre de cadena no estándar en la pestaña{' '}
              <strong>"Sin Clasificar / Revisión"</strong>.
            </span>
          </div>
          <button
            onClick={() => setSelectedChain('OTRA')}
            className="bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[11px] px-3 py-1 rounded-lg uppercase tracking-wide shrink-0 transition-colors"
          >
            Ver Revisión ({sinClasificarOrders.length})
          </button>
        </div>
      )}

      {/* Pestañas de Cadenas y Buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4 mb-5">
        {/* Tabs de Filtro (Todas = Alkosto + Familia Center + Sin Clasificar) */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit flex-wrap">
          <button
            onClick={() => setSelectedChain('TODAS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'TODAS'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todas ({pendingOrders.length})
          </button>
          <button
            onClick={() => setSelectedChain('ALKOSTO')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'ALKOSTO'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-red-600'
            }`}
          >
            <span>Alkosto</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedChain === 'ALKOSTO' ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {alkostoOrders.length}
            </span>
          </button>
          <button
            onClick={() => setSelectedChain('FAMILIA')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'FAMILIA'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-emerald-600'
            }`}
          >
            <span>Familia Center</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedChain === 'FAMILIA' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {familiaOrders.length}
            </span>
          </button>
          <button
            onClick={() => setSelectedChain('OTRA')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'OTRA'
                ? 'bg-amber-600 text-white shadow-sm'
                : sinClasificarOrders.length > 0
                  ? 'text-amber-800 bg-amber-100/80 hover:bg-amber-200/80'
                  : 'text-slate-500 hover:text-amber-700'
            }`}
          >
            <span>Sin Clasificar / Revisión</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedChain === 'OTRA' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {sinClasificarOrders.length}
            </span>
          </button>
        </div>

        {/* Buscador de Sucursal / Tienda / OC */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sucursal, OC, ID o vendedor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-codizulca-cyan focus:bg-white transition-all"
          />
        </div>
      </div>
      
      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <Clock className="text-slate-300 mb-3" size={36} />
          <p className="text-slate-700 font-extrabold text-sm uppercase tracking-wide">
            {pendingOrders.length === 0 ? 'Bandeja al día' : 'No hay pedidos con este filtro'}
          </p>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            {pendingOrders.length === 0 
              ? 'Todos los pedidos de las cadenas Alkosto y Familia Center han sido procesados y enviados a Cuentas por Cobrar.' 
              : 'Intenta cambiar de pestaña o limpiar el cuadro de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(o => {
            const meta = extractOrderReferenceMeta(o);
            const isApproving = approvingIds.has(o.id);
            const isFormatError = o.status === 'ERROR_FORMATO' || String(o.cxcNote || '').startsWith('ERROR_FORMATO:');
            const isAlkostoSairu = isAlkostoSairuOrder(o);
            const parsingNotice = String(o.cxcNote || '').replace(/^(ERROR_FORMATO|AVISO_PARSING):\s*/i, '').trim();

            return (
              <div 
                key={o.id} 
                style={
                  isAlkostoSairu && !isFormatError
                    ? { borderTopColor: '#DC2626', borderTopWidth: '3px' }
                    : undefined
                }
                className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  isFormatError
                    ? 'border-red-300 ring-1 ring-red-100'
                    : isAlkostoSairu
                      ? 'border-slate-300 hover:border-[#09090B]'
                      : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Encabezado Tarjeta: ID Pedido + Cadena + ID Cliente + Estado */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-0.5 bg-slate-900 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded-md tracking-wider">
                          <Hash size={10} className="text-cyan-400" />
                          {meta.formattedOrderId.replace(/^#/, '')}
                        </span>
                        {getChainBadge(o)}
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                          ID: {meta.clientCode}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight break-words leading-snug">
                        {meta.sedeName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isFormatError ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 border border-red-300 text-red-800 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          <AlertTriangle size={11} /> ERROR FORMATO
                        </span>
                      ) : (
                        <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          POR VALIDAR
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteOrder(o)}
                        disabled={deletingId === o.id}
                        title="Eliminar pedido de la sala de espera"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 disabled:opacity-50"
                      >
                        {deletingId === o.id ? <Loader2 size={13} className="animate-spin text-red-500" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Alerta de Error de Formato o Aviso de Auditoría OCR */}
                  {parsingNotice && (
                    <div className={`mb-3 p-2.5 rounded-xl border text-[11px] leading-snug ${
                      isFormatError
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}>
                      <p className="font-extrabold uppercase text-[10px] mb-0.5 flex items-center gap-1">
                        <AlertTriangle size={11} />
                        {isFormatError ? 'Requiere Corrección Manual:' : 'Ajuste Automático de Auditoría OCR:'}
                      </p>
                      <p className="whitespace-normal break-words">{parsingNotice}</p>
                    </div>
                  )}

                  {/* Datos Operativos: Vendedor/Canal y Conteo Exacto de Artículos */}
                  <div className="space-y-1.5 text-xs text-slate-600 mb-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400 font-bold inline-flex items-center gap-1 shrink-0">
                        <UserCheck size={12} className="text-slate-400" /> Vendedor:
                      </span>
                      <span className="font-extrabold text-slate-800 text-right break-words">
                        {meta.vendedorCanal}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 font-bold inline-flex items-center gap-1 shrink-0">
                        <Package size={12} className="text-slate-400" /> Artículos:
                      </span>
                      <span className="font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {meta.validItemCount} {meta.validItemCount === 1 ? 'renglón' : 'renglones'}
                      </span>
                    </div>

                    {/* Bloque de Referencia Unificado y Limpio (OC + Sede + Dirección de Despacho Completa sin truncar) */}
                    <div className="pt-2 mt-1.5 border-t border-slate-200/80 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-slate-500 uppercase inline-flex items-center gap-1">
                          <FileText size={11} className="text-amber-600" /> Orden de Compra (OC):
                        </span>
                        <span className="font-mono font-black text-amber-900 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded">
                          {meta.numeroOc}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-700 pt-0.5">
                        <MapPin size={12} className="text-codizulca-red shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-snug whitespace-normal break-words">
                          <span className="font-extrabold text-slate-700">Sede / Despacho: </span>
                          <span className="font-semibold text-slate-600">{meta.sedeName} — {meta.direccionDespacho}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Footer Tarjeta: Monto Verificado y Botones */}
                <div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-3 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        Monto Pedido (Verificado)
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Suma real de {meta.validItemCount} {meta.validItemCount === 1 ? 'renglón' : 'renglones'}
                      </span>
                    </div>
                    <span className="text-lg font-black text-slate-900">
                      ${meta.verifiedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteOrder(o)}
                      disabled={deletingId === o.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl text-xs font-bold transition-all border border-red-200 disabled:opacity-50 shrink-0"
                      title="Eliminar pedido de la sala de espera"
                    >
                      {deletingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                    <button
                      onClick={() =>
                        setSelectedOrder({
                          ...o,
                          order: {
                            ...o.order,
                            cliente: meta.sedeName !== 'SUCURSAL POR DEFINIR' ? meta.sedeName : o.order.cliente,
                            sucursal_cliente: meta.sedeName !== 'SUCURSAL POR DEFINIR' ? meta.sedeName : o.order.sucursal_cliente,
                            numero_oc: meta.numeroOc,
                            direccion_despacho: meta.direccionDespacho,
                            observaciones: meta.standardizedObs,
                            observacion_formateada: meta.standardizedObs,
                            total_pedido: meta.verifiedTotal,
                            monto_pedido: meta.verifiedTotal
                          }
                        })
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-extrabold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      <Eye size={14} /> Validar Formato
                    </button>
                    <button
                      onClick={() => handleQuickApprove(o)}
                      disabled={isApproving}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-codizulca-cyan text-slate-800 py-2.5 rounded-xl text-xs font-black hover:bg-cyan-400 hover:shadow-sm transition-all border border-cyan-300 disabled:opacity-50"
                    >
                      {isApproving ? (
                        <Loader2 size={14} className="animate-spin text-slate-800" />
                      ) : (
                        <CheckCircle2 size={14} className="text-slate-800" />
                      )}
                      {isApproving ? 'Aprobando...' : 'Aprobar a CxC'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
};
