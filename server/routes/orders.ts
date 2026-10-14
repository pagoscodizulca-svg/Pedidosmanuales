import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { DbOrder, OrderStatus, StatusHistoryItem } from '../../src/types.js';

const router = Router();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function mapSupabaseToDbOrder(row: any): DbOrder {
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
      total_pedido: row.total_pedido || row.monto_pedido || 0,
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
  const { data, error } = await supabase
    .from('orders')
    .select('numero_pedido, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  let maxNum = 0;
  if (data && data.length > 0) {
    for (const r of data) {
      if (r.numero_pedido && /^\d+$/.test(String(r.numero_pedido).trim())) {
        const n = parseInt(String(r.numero_pedido).trim(), 10);
        if (!isNaN(n) && n > maxNum) {
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
      .is('is_archived', false);
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

// Columnas requeridas para los pedidos activos (se omite raw_order para reducir payload >60%)
const ACTIVE_ORDERS_COLUMNS = 'id, status, created_at, updated_at, status_history, reject_reason, cxc_note, fact_note, is_archived, cliente, id_cliente, ruta, supervisor, chofer, observaciones, fecha, articulos, numero_pedido, total_pedido, monto_pedido';

// GET todos los pedidos activos (optimizado para respuesta instantánea)
router.get('/', async (req, res) => {
  try {
    // Se dispara en segundo plano si ya pasaron 6 horas (no bloquea la respuesta HTTP)
    triggerCutoffIfDue();
    
    const { data, error } = await supabase
      .from('orders')
      .select(ACTIVE_ORDERS_COLUMNS)
      .is('is_archived', false)
      .order('created_at', { ascending: false })
      .range(0, 999);
      
    if (error) throw error;
    
    const orders = (data || []).map(row => {
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

// GET histórico de pedidos archivados (paginado seguro)
router.get('/history', async (req, res) => {
  try {
    let allData: any[] = [];
    let page = 0;
    const limit = 1000;
    let hasMore = true;
    
    while(hasMore) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .is('is_archived', true)
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
    
    const orders = allData.map(row => {
      const o = mapSupabaseToDbOrder(row);
      o.isArchived = true;
      return o;
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

    // Si viene de Sala de Espera ('POR_VALIDAR') y pasa a 'PENDIENTE_CXC', asignamos correlativo consecutivo
    let finalCorrelativo = existingData.numero_pedido;
    if (existingData.status === 'POR_VALIDAR' && status === 'PENDIENTE_CXC') {
      finalCorrelativo = await getNextCorrelativo();
      orderData.numero_pedido = finalCorrelativo;
    }

    const updateFields: any = {
      numero_pedido: finalCorrelativo,
      cliente: orderData.cliente,
      id_cliente: orderData.id_cliente,
      ruta: orderData.ruta,
      supervisor: orderData.supervisor,
      chofer: orderData.chofer,
      observaciones: orderData.observaciones,
      total_pedido: orderData.total_pedido,
      monto_pedido: orderData.monto_pedido,
      articulos: orderData.articulos,
      raw_order: { ...orderData, numero_pedido: finalCorrelativo },
      status: status || existingData.status,
      status_history: updatedHistory,
      updated_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabase
      .from('orders')
      .update(updateFields)
      .eq('id', id);

    if (updateErr) throw updateErr;

    res.json({ success: true, numero_pedido: finalCorrelativo });
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

export default router;
