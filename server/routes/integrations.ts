import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Basic auth middleware using a static API key for external apps
// The app must send x-api-key: codizulca-secret-2026
const authenticateAPIKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'codizulca-secret-2026') {
    return res.status(403).json({ error: 'Acceso denegado. API Key inválido.' });
  }
  next();
};

// Función para extraer múltiples pedidos de una Orden de Compra o lote
function extractOrdersList(body: any): any[] {
  if (!body) return [];

  // 1. Si el body ya es un arreglo de pedidos
  if (Array.isArray(body)) {
    return body;
  }

  // 2. Si el body envuelve los pedidos en una propiedad (pedidos, orders, data, sucursales)
  const candidateLists = [body.pedidos, body.orders, body.data, body.sucursales, body.tiendas];
  for (const list of candidateLists) {
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item: any) => ({
        ...item,
        ruta: item.ruta || body.ruta || 'SAIRU VALLES',
        supervisor: item.supervisor || body.supervisor || '',
        chofer: item.chofer || body.chofer || '',
        orden_compra: item.orden_compra || body.orden_compra || body.numero_oc || '',
        fecha: item.fecha || body.fecha || new Date().toISOString().split('T')[0]
      }));
    }
  }

  // 3. Si viene una sola Orden de Compra con artículos desglosados por tienda/sucursal
  if (Array.isArray(body.articulos) && body.articulos.length > 0) {
    const hasStoreGrouping = body.articulos.some((a: any) => a.tienda || a.sucursal || a.nombre_tienda);
    if (hasStoreGrouping) {
      const groups: Record<string, any[]> = {};
      for (const item of body.articulos) {
        const storeKey = (item.tienda || item.sucursal || item.nombre_tienda || body.cliente || 'SUCURSAL').trim();
        if (!groups[storeKey]) groups[storeKey] = [];
        groups[storeKey].push(item);
      }

      return Object.entries(groups).map(([storeName, items]) => ({
        ...body,
        cliente: storeName,
        articulos: items,
        id_cliente: items[0]?.id_cliente || items[0]?.codigo_cliente || body.id_cliente || '',
        total_pedido: items.reduce((sum, it) => sum + (parseFloat(it.sub_total || it.monto || (it.precio_unitario * it.cantidad_solicitada)) || 0), 0)
      }));
    }
  }

  // 4. Si es un único pedido estándar
  if (body.cliente && Array.isArray(body.articulos)) {
    return [body];
  }

  return [];
}

// Detección inteligente de Cadena
function detectarCadena(cliente: string, explicitOrigin?: string): 'ALKOSTO' | 'FAMILIA CENTER' | 'OTRA CADENA' {
  const norm = (cliente || '').toUpperCase();
  if (norm.includes('ALKOSTO')) return 'ALKOSTO';
  if (norm.includes('FAMILIA')) return 'FAMILIA CENTER';
  if (explicitOrigin) {
    const origNorm = explicitOrigin.toUpperCase();
    if (origNorm.includes('ALKOSTO')) return 'ALKOSTO';
    if (origNorm.includes('FAMILIA')) return 'FAMILIA CENTER';
  }
  return 'OTRA CADENA';
}

router.post('/fdv', authenticateAPIKey, async (req, res) => {
  try {
    const rawPayload = req.body;
    const ordersToProcess = extractOrdersList(rawPayload);

    if (ordersToProcess.length === 0) {
      return res.status(400).json({ 
        error: 'No se encontraron pedidos válidos en la carga enviada. Debe contener cliente y artículos (en objeto o lista).' 
      });
    }

    const insertedRows: any[] = [];
    const createdOrdersSummary: any[] = [];

    for (let index = 0; index < ordersToProcess.length; index++) {
      const rawOrder = ordersToProcess[index];
      const clienteName = (rawOrder.cliente || `PEDIDO CADENA #${index + 1}`).trim().toUpperCase();
      const articulos = Array.isArray(rawOrder.articulos) ? rawOrder.articulos : [];
      const cadena = detectarCadena(clienteName, rawOrder.origen || rawPayload.origen);

      // Calcular total si viene en 0 o vacío
      let calculatedTotal = parseFloat(rawOrder.total_pedido || rawOrder.monto_pedido || 0);
      if (isNaN(calculatedTotal) || calculatedTotal <= 0) {
        calculatedTotal = articulos.reduce((acc: number, it: any) => {
          const precio = parseFloat(it.precio_unitario || it.precio || 0);
          const cant = parseFloat(it.cantidad_solicitada || it.cantidad || 0);
          const sub = parseFloat(it.sub_total || it.monto || 0);
          return acc + (sub > 0 ? sub : precio * cant);
        }, 0);
      }

      // Notas y observaciones
      let obs = (rawOrder.observaciones || rawPayload.observaciones || 'Enviado desde App FDV').trim();
      const ocNum = rawOrder.orden_compra || rawPayload.orden_compra || rawPayload.numero_oc;
      if (ocNum && !obs.includes(ocNum)) {
        obs = `OC: ${ocNum} | ${obs}`;
      }

      const orderId = crypto.randomUUID();
      const numero_pedido = 'APP-FDV';
      const status = rawOrder.status || 'POR_VALIDAR';
      const fecha = rawOrder.fecha || rawPayload.fecha || new Date().toISOString().split('T')[0];
      const ruta = (rawOrder.ruta || rawPayload.ruta || 'SAIRU VALLES').trim().toUpperCase();
      const idCliente = String(rawOrder.id_cliente || rawOrder.codigo_cliente || '').trim();

      const orderData = {
        cliente: clienteName,
        id_cliente: idCliente,
        ruta: ruta,
        supervisor: rawOrder.supervisor || rawPayload.supervisor || '',
        chofer: rawOrder.chofer || rawPayload.chofer || '',
        observaciones: obs,
        fecha: fecha,
        total_pedido: Number(calculatedTotal.toFixed(2)),
        monto_pedido: Number(calculatedTotal.toFixed(2)),
        numero_pedido,
        origen: cadena,
        articulos: articulos
      };

      const rowToInsert = {
        id: orderId,
        numero_pedido,
        cliente: clienteName,
        id_cliente: idCliente,
        ruta,
        supervisor: orderData.supervisor,
        chofer: orderData.chofer,
        observaciones: obs,
        fecha,
        total_pedido: orderData.total_pedido,
        monto_pedido: orderData.monto_pedido,
        status,
        articulos,
        raw_order: orderData,
        is_archived: false,
        status_history: [{
          status,
          department: 'Ventas',
          changedBy: ruta,
          timestamp: new Date().toISOString(),
          reason: `Recibido de app externa (${cadena})`
        }]
      };

      insertedRows.push(rowToInsert);
      createdOrdersSummary.push({
        id: orderId,
        cliente: clienteName,
        cadena,
        id_cliente: idCliente,
        total: orderData.total_pedido,
        items: articulos.length
      });
    }

    // Inserción en lote en Supabase
    const { error: insertErr } = await supabase.from('orders').insert(insertedRows);
    if (insertErr) throw insertErr;

    console.log(`[Webhook FDV] Se insertaron con éxito ${insertedRows.length} pedidos en Sala de Espera.`);

    return res.status(201).json({
      success: true,
      message: `Se integraron con éxito ${insertedRows.length} pedidos en la Sala de Espera.`,
      pedidos_procesados: insertedRows.length,
      detalle: createdOrdersSummary
    });

  } catch (err: any) {
    console.error('Error Integración FDV:', err);
    return res.status(500).json({ error: 'Hubo un error al procesar el webhook', details: err?.message });
  }
});

export default router;
