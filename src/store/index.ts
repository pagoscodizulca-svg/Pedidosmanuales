import { apiFetch } from '../utils/api';
import { create } from 'zustand';
import { DbOrder, OrderData, OrderStatus } from '../types.js';
import { useAuthStore } from './auth';
import { supabase } from '../lib/supabase';

function mapDirectSupabaseRowToDbOrder(row: any): DbOrder {
  return {
    id: row.id,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusHistory: row.status_history || [],
    rejectReason: row.reject_reason || undefined,
    cxcNote: row.cxc_note || undefined,
    factNote: row.fact_note || undefined,
    isArchived: Boolean(row.is_archived),
    order: {
      cliente: row.cliente || '',
      id_cliente: row.id_cliente || '',
      ruta: row.ruta || '',
      supervisor: row.supervisor || '',
      chofer: row.chofer || '',
      observaciones: row.observaciones || '',
      fecha: row.fecha || '',
      articulos: row.articulos || [],
      numero_pedido: row.numero_pedido || '',
      total_pedido: Number(row.total_pedido ?? row.monto_pedido ?? 0),
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
}

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
  const num = String(item.order?.numero_pedido || '').trim();
  const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
  if (id.startsWith('alk-') && item.status === 'PENDIENTE_CXC') {
    const hasShortCorrelativo = num.length <= 4 || num === 'APP-FDV' || num === 'PENDIENTE';
    const wasValidatedInManuales = history.some(
      (h: any) => h && h.status === 'PENDIENTE_CXC' && h.reason === 'Validado y actualizado'
    );
    if (hasShortCorrelativo && !wasValidatedInManuales) {
      return { ...item, status: 'POR_VALIDAR', rejectReason: undefined };
    }
  }
  return item;
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
          .in('status', ['POR_VALIDAR', 'ERROR_FORMATO'])
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
    try {
       const { username, department } = getCurrentUserActor();

       const historyItem = newStatus ? {
          status: newStatus,
          department,
          changedBy: username,
          timestamp: new Date().toISOString(),
          reason: 'Validado y actualizado'
       } : undefined;

       const response = await apiFetch(`/api/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderData, status: newStatus, historyItem })
       });
       if (!response.ok) throw new Error('Error al actualizar pedido');
       const updated = await response.json().catch(() => null);
       if (updated && updated.id) {
         set({ orders: get().orders.map(o => o.id === id ? updated : o) });
       } else {
         await get().fetchOrders();
       }
    } catch(err) {
       console.error(err);
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
