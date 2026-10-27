import { apiFetch } from '../utils/api';
import { create } from 'zustand';
import { DbOrder, OrderData, OrderStatus } from '../types.js';
import { useAuthStore } from './auth';
import { supabase } from '../lib/supabase';

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

function mapDirectSupabaseRowToDbOrder(row: any): DbOrder {
  const rawStatus = String(row.status || '').trim().toUpperCase();
  const normalizedStatus = (
    WAITING_ROOM_RAW_STATUSES.has(rawStatus) ? 'POR_VALIDAR' : rawStatus
  ) as OrderStatus;
  const rawOrd = row.raw_order && typeof row.raw_order === 'object' ? row.raw_order : {};
  const rawArticulosSource =
    Array.isArray(row.articulos) && row.articulos.length > 0
      ? row.articulos
      : Array.isArray(rawOrd.articulos) && rawOrd.articulos.length > 0
        ? rawOrd.articulos
        : Array.isArray(rawOrd.items) && rawOrd.items.length > 0
          ? rawOrd.items
          : Array.isArray(rawOrd.renglones) && rawOrd.renglones.length > 0
            ? rawOrd.renglones
            : [];

  const articulos = rawArticulosSource.map((it: any) => {
    const cant = Number(it?.cantidad_solicitada ?? it?.cantidadCajas ?? it?.cantidad ?? 0);
    const precio = Number(it?.precio_unitario ?? it?.precioUnitarioUSD ?? it?.precio ?? 0);
    const rawSub = Number(it?.sub_total ?? it?.subtotalUSD ?? it?.subtotal ?? 0);
    const subTotal =
      cant > 0 && precio > 0
        ? Number((cant * precio).toFixed(2))
        : Number.isFinite(rawSub) && rawSub >= 0
          ? Number(rawSub.toFixed(2))
          : 0;
    return {
      codigo: String(it?.codigo ?? it?.sku ?? '').trim(),
      descripcion: String(it?.descripcion ?? it?.producto ?? '').trim(),
      unidad_medida: String(it?.unidad_medida ?? it?.presentacion ?? 'BULTO').trim(),
      cantidad_solicitada: Number.isFinite(cant) ? cant : 0,
      cantidad_despachada: Number(it?.cantidad_despachada ?? 0) || 0,
      precio_unitario: Number.isFinite(precio) ? precio : 0,
      sub_total: subTotal
    };
  });

  const calculatedTotal = Number(
    articulos.reduce((acc: number, it: any) => acc + (Number(it.sub_total) || 0), 0).toFixed(2)
  );
  const declaredTotal = Number(row.total_pedido ?? row.monto_pedido ?? rawOrd.monto_pedido ?? 0);
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

  return {
    id: row.id,
    status: normalizedStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusHistory: row.status_history || [],
    rejectReason: row.reject_reason || undefined,
    cxcNote: row.cxc_note || undefined,
    factNote: row.fact_note || undefined,
    isArchived: Boolean(row.is_archived),
    order: {
      cliente: row.cliente || rawOrd.sucursal_cliente || rawOrd.cliente || '',
      sucursal_cliente: rawOrd.sucursal_cliente || row.cliente || '',
      cadena: rawOrd.cadena || rawOrd.origen || undefined,
      numero_oc: extractedOc,
      direccion_despacho: extractedDir,
      observacion_formateada: obsText,
      vendedor: row.ruta || rawOrd.vendedor || '',
      total_renglones: articulos.length,
      id_cliente: row.id_cliente || rawOrd.id_cliente || '',
      ruta: row.ruta || rawOrd.vendedor || '',
      supervisor: row.supervisor || rawOrd.supervisor || '',
      chofer: row.chofer || rawOrd.chofer || '',
      observaciones: obsText,
      fecha: row.fecha || rawOrd.fecha || '',
      articulos,
      numero_pedido: row.numero_pedido || rawOrd.numero_pedido || '',
      total_pedido: finalTotal,
      monto_pedido: finalTotal,
      origen: rawOrd.cadena || rawOrd.origen || undefined,
    },
  };
}

function getCurrentUserActor(): { username: string; department: string } {
  const user = useAuthStore.getState().user;
  let username = user?.username?.trim();
  let role = user?.role;

  if (!username) {
    try {
      const raw = localStorage.getItem('codizulca-session') || localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        const u = parsed.state?.user || parsed.user;
        if (u?.username) {
          username = u.username.trim();
          role = u.role;
        }
      }
    } catch {}
  }

  const roleToDept: Record<string, string> = {
    ventas: 'Ventas',
    cxc: 'Cuentas por Cobrar',
    facturacion: 'Facturación',
    gerencia: 'Gerencia',
    master: 'Master',
  };

  return {
    username: username || 'Usuario',
    department: (role && roleToDept[role]) || 'Ventas',
  };
}

interface AppState {
  orders: DbOrder[];
  historyOrders: DbOrder[];
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  createOrder: (order: OrderData) => Promise<DbOrder>;
  updateFullOrder: (id: string, orderData: OrderData, newStatus?: OrderStatus) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus, cxcNote?: string, factNote?: string, rejectReason?: string, departmentParam?: string) => Promise<void>;
  updateBatchOrderStatus: (ids: string[], status: OrderStatus, department?: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  deleteBatchOrders: (ids: string[]) => Promise<void>;
  updateSupervisor: (id: string, supervisor: string) => Promise<void>;
  parseOrderWithAI: (text: string) => Promise<Partial<OrderData>>;
  syncAlkostoOrders: () => Promise<number>;
  subscribeToWaitingRoomRealtime: () => () => void;
}

let activeRealtimeChannel: any = null;
let activeRealtimeSubscribers = 0;
let realtimeBurstTimeout: ReturnType<typeof setTimeout> | null = null;

function isGhostTestOrder(o: DbOrder): boolean {
  if (!o) return false;
  const id = String(o.id || '').trim().toLowerCase();
  const num = String(o.order?.numero_pedido || '').trim();
  const obs = String(o.order?.observaciones || '').toUpperCase();
  const cli = String(o.order?.cliente || '').toUpperCase();
  const arts = Array.isArray(o.order?.articulos) ? o.order.articulos : [];

  if (id.startsWith('test-int-') || id.startsWith('test-qa-')) return true;
  if (num === '9999') return true;
  if (obs.includes('OC-TEST-INT') || obs.includes('PRUEBA DE INTEGRAC')) return true;
  if (cli.includes('ALKOSTO 01 - ZONA INDUSTRIAL') && arts.length === 1 && Number(arts[0]?.cantidad_solicitada) === 0) {
    return true;
  }
  return false;
}

function normalizeExternalChainOrder(item: DbOrder): DbOrder {
  const id = String(item.id || '').trim().toLowerCase();
  const num = String(item.order?.numero_pedido || '').trim().toUpperCase();
  const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
  const rawSt = String(item.status || '').trim().toUpperCase();
  let nextStatus: OrderStatus = (
    WAITING_ROOM_RAW_STATUSES.has(rawSt) ? 'POR_VALIDAR' : item.status
  ) as OrderStatus;

  if (nextStatus === 'PENDIENTE_CXC') {
    const hasShortCorrelativo =
      id.startsWith('alk-') ||
      num.length <= 4 ||
      num === 'APP-FDV' ||
      num === 'PENDIENTE' ||
      num === 'AUTO';
    const wasValidatedInManuales = history.some(
      (h: any) =>
        h &&
        h.status === 'PENDIENTE_CXC' &&
        (String(h.reason || '').includes('Validado') || String(h.reason || '').includes('Aprobado'))
    );
    if (hasShortCorrelativo && !wasValidatedInManuales && (id.startsWith('alk-') || num === 'APP-FDV' || num === 'PENDIENTE')) {
      nextStatus = 'POR_VALIDAR';
    }
  }

  // Recalcular total_pedido desde renglones si existe discrepancia o valor en 0 / NaN
  const arts = Array.isArray(item.order?.articulos) ? item.order.articulos : [];
  let sumRenglones = 0;
  const normalizedArts = arts.map((a: any) => {
    const cant = Number(a?.cantidad_solicitada) || 0;
    const precio = Number(a?.precio_unitario) || 0;
    const rawSub = Number(a?.sub_total) || 0;
    const subTotal = cant > 0 && precio > 0 ? Number((cant * precio).toFixed(2)) : Number(rawSub.toFixed(2));
    sumRenglones += subTotal;
    return {
      ...a,
      cantidad_solicitada: cant,
      precio_unitario: precio,
      sub_total: subTotal
    };
  });
  sumRenglones = Number(sumRenglones.toFixed(2));
  const declaredTotal = Number(item.order?.total_pedido ?? item.order?.monto_pedido ?? 0);
  const verifiedTotal =
    sumRenglones > 0 &&
    (declaredTotal <= 0 ||
      Number.isNaN(declaredTotal) ||
      ((nextStatus === 'POR_VALIDAR' || nextStatus === 'ERROR_FORMATO') && Math.abs(declaredTotal - sumRenglones) > 0.5))
      ? sumRenglones
      : Number.isFinite(declaredTotal)
        ? Number(declaredTotal.toFixed(2))
        : 0;

  return {
    ...item,
    status: nextStatus,
    rejectReason: nextStatus === 'POR_VALIDAR' ? undefined : item.rejectReason,
    order: {
      ...item.order,
      articulos: normalizedArts,
      total_renglones: normalizedArts.length,
      total_pedido: verifiedTotal,
      monto_pedido: verifiedTotal
    }
  };
}

function dedupeAndFilterOrders(list: DbOrder[]): DbOrder[] {
  const seen = new Set<string>();
  const result: DbOrder[] = [];
  for (const item of list || []) {
    if (!item || !item.id || isGhostTestOrder(item)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(normalizeExternalChainOrder(item));
  }
  return result;
}

export const useAppStore = create<AppState>((set, get) => ({
  orders: [],
  historyOrders: [],
  loading: false,
  error: null,
  
  fetchHistory: async () => {
    const isInitial = get().historyOrders.length === 0;
    if (isInitial) set({ loading: true, error: null });
    try {
      const response = await apiFetch('/api/orders/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      set({ historyOrders: dedupeAndFilterOrders(data), loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchOrders: async () => {
    const isInitial = get().orders.length === 0;
    if (isInitial) set({ loading: true, error: null });
    try {
      const [apiResult, directWaitingResult] = await Promise.allSettled([
        apiFetch('/api/orders'),
        supabase
          .from('orders')
          .select('*')
          .in('status', [
            'POR_VALIDAR',
            'POR VALIDAR',
            'ERROR_FORMATO',
            'PENDIENTE',
            'EN_ESPERA',
            'EN ESPERA',
            'ENVIADO',
            'POR_APROBAR',
            'RECIBIDO'
          ])
          .order('created_at', { ascending: false })
      ]);

      const directWaitingOrders: DbOrder[] =
        directWaitingResult.status === 'fulfilled' && Array.isArray(directWaitingResult.value.data)
          ? directWaitingResult.value.data.map(mapDirectSupabaseRowToDbOrder)
          : [];

      if (apiResult.status === 'fulfilled' && apiResult.value.ok) {
        const data = await apiResult.value.json();
        const combined = [...directWaitingOrders, ...(Array.isArray(data) ? data : [])];
        set({ orders: dedupeAndFilterOrders(combined), loading: false, error: null });
        return;
      }

      // Fallback directo a Supabase si el backend está reiniciando o el token falló temporalmente
      const { data: fallbackRows, error: fbError } = await supabase
        .from('orders')
        .select('*')
        .is('is_archived', false)
        .order('created_at', { ascending: false })
        .range(0, 999);

      if (fbError) throw fbError;
      const mappedFallback = (fallbackRows || []).map(mapDirectSupabaseRowToDbOrder);
      set({
        orders: dedupeAndFilterOrders([...directWaitingOrders, ...mappedFallback]),
        loading: false,
        error: null,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  syncAlkostoOrders: async () => {
    try {
      const response = await apiFetch('/api/orders/sync-alkosto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await response.json().catch(() => ({ syncedCount: 0 }));
      if (Array.isArray(data?.waitingOrders) && data.waitingOrders.length > 0) {
        set({ orders: dedupeAndFilterOrders([...data.waitingOrders, ...get().orders]) });
      }
      await get().fetchOrders();
      return Number(data?.syncedCount || 0);
    } catch (err: any) {
      console.warn('Error syncing Alkosto orders:', err);
      await get().fetchOrders();
      return 0;
    }
  },

  subscribeToWaitingRoomRealtime: () => {
    activeRealtimeSubscribers++;
    if (!activeRealtimeChannel) {
      activeRealtimeChannel = supabase
        .channel('sala-espera-orders-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload: any) => {
            try {
              const eventType = payload?.eventType;
              if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const newRow = payload.new;
                if (newRow && newRow.id) {
                  const mapped = normalizeExternalChainOrder(mapDirectSupabaseRowToDbOrder(newRow));
                  if (!isGhostTestOrder(mapped)) {
                    const current = get().orders;
                    const exists = current.some(o => o.id === mapped.id);
                    const nextOrders = exists
                      ? current.map(o => (o.id === mapped.id ? mapped : o))
                      : [mapped, ...current];
                    set({ orders: dedupeAndFilterOrders(nextOrders) });
                  }
                }
              } else if (eventType === 'DELETE') {
                const deletedId = payload?.old?.id;
                if (deletedId) {
                  set({ orders: get().orders.filter(o => o.id !== deletedId) });
                }
              }

              // Reconciliación diferida con buffer para ráfagas de 7+ pedidos simultáneos
              if (realtimeBurstTimeout) clearTimeout(realtimeBurstTimeout);
              realtimeBurstTimeout = setTimeout(() => {
                get().fetchOrders().catch(() => {});
              }, 450);
            } catch (rtErr) {
              console.warn('Error en listener Real-Time de Sala de Espera:', rtErr);
            }
          }
        )
        .subscribe();
    }

    return () => {
      activeRealtimeSubscribers = Math.max(0, activeRealtimeSubscribers - 1);
      if (activeRealtimeSubscribers === 0 && activeRealtimeChannel) {
        supabase.removeChannel(activeRealtimeChannel).catch(() => {});
        activeRealtimeChannel = null;
      }
    };
  },
  
  createOrder: async (orderData) => {
    set({ error: null });
    try {
      const { username, department } = getCurrentUserActor();
      const newOrder: Omit<DbOrder, 'id' | 'statusHistory'> = {
        status: 'PENDIENTE_CXC',
        order: orderData,
        createdAt: new Date().toISOString(),
      };
      
      const response = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newOrder, id: crypto.randomUUID(), statusHistory: [{
          status: 'CREADO',
          department,
          changedBy: username,
          timestamp: new Date().toISOString()
        }]})
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create order');
      }
      const created = await response.json();
      const exists = get().orders.some(o => o.id === created.id);
      set({ orders: exists ? get().orders.map(o => o.id === created.id ? created : o) : [created, ...get().orders] });
      return created;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
  
  updateFullOrder: async (id, orderData, newStatus) => {
    set({ error: null });
    try {
      const { username, department } = getCurrentUserActor();

      const historyItem = newStatus
        ? {
            status: newStatus,
            department,
            changedBy: username,
            timestamp: new Date().toISOString(),
            reason: 'Validado y actualizado'
          }
        : undefined;

      const response = await apiFetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderData, status: newStatus, historyItem })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Error al actualizar o aprobar el pedido');
      }

      const updated = await response.json().catch(() => null);
      if (updated && updated.id) {
        const normalizedUpdated = normalizeExternalChainOrder(updated);
        set({
          orders: get().orders.map(o => (o.id === id ? normalizedUpdated : o)),
          error: null
        });
      } else {
        await get().fetchOrders();
      }
    } catch (err: any) {
      console.error('Error en updateFullOrder:', err);
      set({ error: err?.message || 'Error al actualizar el pedido' });
      throw err;
    }
  },

  updateOrderStatus: async (id, status, cxcNote, factNote, rejectReason, departmentParam) => {
    try {
      const { username, department: defaultDept } = getCurrentUserActor();
      // Determine department if not passed explicitly
      let dept = departmentParam;
      if (!dept) {
        const currentOrder = get().orders.find(o => o.id === id);
        if (status === 'PENDIENTE_FACTURACION') dept = 'Cuentas por Cobrar';
        else if (status === 'COMPLETADO') dept = 'Facturación';
        else if (status === 'RECHAZADO') {
           dept = currentOrder?.status === 'PENDIENTE_CXC' ? 'Cuentas por Cobrar' : 'Facturación';
        } else {
           dept = defaultDept || 'Sistema';
        }
      }

      const historyItem = {
        status,
        department: dept,
        changedBy: username,
        timestamp: new Date().toISOString(),
        reason: rejectReason
      };

      const response = await apiFetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, historyItem, cxcNote, factNote, rejectReason })
      });
      if (!response.ok) throw new Error('Failed to update status');
      
      const updated = await response.json();
      set({ orders: get().orders.map(o => o.id === id ? updated : o) });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateBatchOrderStatus: async (ids, status, departmentParam) => {
    try {
      const { department: defaultDept } = getCurrentUserActor();
      let dept = departmentParam;
      if (!dept) {
        if (status === 'PENDIENTE_FACTURACION') dept = 'Cuentas por Cobrar';
        else if (status === 'COMPLETADO') dept = 'Facturación';
        else dept = defaultDept || 'Sistema';
      }

      const response = await apiFetch('/api/orders/batch-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status, department: dept })
      });

      if (!response.ok) throw new Error('Error al actualizar pedidos en lote');

      const data = await response.json();
      if (data.orders && Array.isArray(data.orders)) {
        const mapUpdated = new Map<string, DbOrder>(data.orders.map((o: DbOrder) => [o.id, o]));
        set({ orders: get().orders.map(o => (mapUpdated.get(o.id) || o) as DbOrder) });
      } else {
        await get().fetchOrders();
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteOrder: async (id) => {
    try {
      const response = await apiFetch(`/api/orders/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Error al eliminar el pedido');
      set({
        orders: get().orders.filter(o => o.id !== id),
        historyOrders: get().historyOrders.filter(o => o.id !== id)
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteBatchOrders: async (ids) => {
    try {
      const response = await apiFetch('/api/orders/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('Error al eliminar pedidos en lote');
      const idSet = new Set(ids);
      set({
        orders: get().orders.filter(o => !idSet.has(o.id)),
        historyOrders: get().historyOrders.filter(o => !idSet.has(o.id))
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateSupervisor: async (id, supervisor) => {
    try {
      const response = await apiFetch(`/api/orders/${id}/supervisor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisor })
      });
      if (!response.ok) throw new Error('Failed to update supervisor');
      
      const updated = await response.json();
      set({ orders: get().orders.map(o => o.id === id ? updated : o) });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  parseOrderWithAI: async (text) => {
    set({ error: null });
    try {
      const response = await apiFetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error('AI Parsing failed');
      return await response.json();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  }
}));
