import { apiFetch } from '../utils/api';
import { create } from 'zustand';
import { DbOrder, OrderData, OrderStatus } from '../types.js';
import { useAuthStore } from './auth';

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
}

export const useAppStore = create<AppState>((set, get) => ({
  orders: [],
  historyOrders: [],
  loading: false,
  error: null,
  
  fetchHistory: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiFetch('/api/orders/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      set({ historyOrders: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchOrders: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiFetch('/api/orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      set({ orders: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  
  createOrder: async (orderData) => {
    set({ loading: true, error: null });
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
      set({ orders: [...get().orders, created], loading: false });
      return created;
    } catch (err: any) {
      set({ error: err.message, loading: false });
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
       get().fetchOrders();
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
