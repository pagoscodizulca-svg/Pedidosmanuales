import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

router.get('/', async (req, res) => {
  try {
    let allOrders: any[] = [];
    let page = 0;
    let hasMore = true;
    const limit = 1000;

    // Fetch all orders from Supabase (Backend side)
    while (hasMore) {
      const { data, error } = await supabase
        .from('orders')
        .select('status, created_at, raw_order, reject_reason')
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allOrders = allOrders.concat(data);
        page++;
        if (data.length < limit) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    // --- AGGREGATIONS ---
    let kpiTotalManuales = allOrders.length;
    let kpiFacturados = 0;
    let kpiRechazados = 0;
    let kpiPendientes = 0;
    let montoFacturado = 0;
    let montoPendiente = 0;
    let totalVolumenFisico = 0;
    let totalLineas = 0;

    const vendorMap = new Map();
    const productMap = new Map();
    const rejectMap = new Map();
    const trendMap = new Map();

    allOrders.forEach(o => {
      const status = o.status;
      const order = o.raw_order;
      if (!order) return;

      // KPIs
      if (status === 'COMPLETADO') {
         kpiFacturados++;
         montoFacturado += (order.total_pedido || 0);
      }
      if (status === 'RECHAZADO') kpiRechazados++;
      if (status === 'PENDIENTE_CXC' || status === 'PENDIENTE_FACTURACION') {
         kpiPendientes++;
         montoPendiente += (order.total_pedido || 0);
      }

      // Vendor Stats
      const ruta = order.ruta?.toUpperCase() || 'SIN VENDEDOR';
      const isRechazado = status === 'RECHAZADO';
      const vStats = vendorMap.get(ruta) || { vendedor: ruta, aprob: 0, rech: 0, ventas: 0 };
      if (isRechazado) {
        vStats.rech += 1;
      } else {
        vStats.aprob += 1;
        vStats.ventas += (order.total_pedido || 0);
      }
      vendorMap.set(ruta, vStats);

      // Product Stats
      if (status !== 'RECHAZADO') {
        (order.articulos || []).forEach((art: any) => {
          if (!art.descripcion || art.cantidad_solicitada <= 0) return;
          totalLineas++;
          
          const key = art.codigo || art.descripcion;
          const pStats = productMap.get(key) || { desc: art.descripcion, pedidos: 0, volumen: 0, monto: 0, unidad: art.unidad_medida || 'UND' };
          
          pStats.pedidos += 1;
          pStats.volumen += art.cantidad_solicitada;
          pStats.monto += (art.sub_total || 0);
          totalVolumenFisico += art.cantidad_solicitada;
          
          productMap.set(key, pStats);
        });
      }

      // Reject Reasons
      if (status === 'RECHAZADO') {
        const reason = o.reject_reason || 'Rechazado (Sin motivo)';
        const mainReason = reason.split('-')[0].trim();
        rejectMap.set(mainReason, (rejectMap.get(mainReason) || 0) + 1);
      }

      // Daily Trend
      const date = order.fecha || o.created_at.split('T')[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    });

    const vendorStats = Array.from(vendorMap.values()).sort((a, b) => b.ventas - a.ventas);
    
    const arrProd = Array.from(productMap.values());
    const byVol = [...arrProd].sort((a, b) => b.volumen - a.volumen);
    const byFrec = [...arrProd].sort((a, b) => b.pedidos - a.pedidos);
    const productStats = byFrec.slice(0, 10);
    const topByVolumen = byVol[0] || null;
    const topByFrecuencia = byFrec[0] || null;

    const statusData = [
      { name: 'Facturacion Pendiente', value: kpiPendientes, fill: '#0ea5e9' },
      { name: 'Facturados (Completados)', value: kpiFacturados, fill: '#f59e0b' },
      { name: 'Rechazados', value: kpiRechazados, fill: '#10b981' }
    ].filter(d => d.value > 0);

    const rejectReasonsData = Array.from(rejectMap.entries())
      .map(([motivo, count]) => ({ motivo: motivo.length > 25 ? motivo.substring(0, 25) + '...' : motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const dailyTrendData = Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      kpis: { kpiTotalManuales, kpiFacturados, kpiRechazados, kpiPendientes, montoFacturado, montoPendiente },
      vendorStats,
      productStats,
      topByVolumen,
      topByFrecuencia,
      totalVolumenFisico,
      totalLineas,
      statusData,
      rejectReasonsData,
      dailyTrendData
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Analytics error' });
  }
});


router.get('/product', async (req, res) => {
  try {
    const { desc } = req.query;
    if (!desc) return res.status(400).json({ error: 'Missing desc' });
    
    let fullOrders: any[] = [];
    let page = 0; let hasMore = true;
    const limit = 1000;
    while (hasMore) {
      const { data, error } = await supabase
        .from('orders')
        .select('status, raw_order, created_at')
        .range(page * limit, (page + 1) * limit - 1);
      if (error) throw error;
      if (data && data.length > 0) {
         fullOrders = fullOrders.concat(data);
         page++;
         if (data.length < limit) hasMore = false;
      } else hasMore = false;
    }

    const pDescStr = String(desc).toUpperCase();
    let countPedidos = 0;
    let countFacturados = 0;
    let countRechazados = 0;
    let totalVendidos = 0;
    const sellersMap = new Map();

    fullOrders.forEach(o => {
      const order = o.raw_order;
      if (!order || !order.articulos) return;
      
      const productInOrder = order.articulos.find((a: any) => 
        (a.descripcion && a.descripcion.trim().toUpperCase() === pDescStr) ||
        (a.codigo && a.codigo.trim().toUpperCase() === pDescStr)
      );

      if (productInOrder) {
        countPedidos++;
        totalVendidos += (productInOrder.cantidad_solicitada || 0);

        if (o.status === 'COMPLETADO') countFacturados++;
        if (o.status === 'RECHAZADO') countRechazados++;

        const ruta = order.ruta?.trim().toUpperCase() || 'SIN VENDEDOR';
        const current = sellersMap.get(ruta) || { pedidos: 0, totalPrecio: 0 };
        sellersMap.set(ruta, {
          pedidos: current.pedidos + 1,
          totalPrecio: current.totalPrecio + (productInOrder.precio_unitario || 0)
        });
      }
    });

    const sellersData = Array.from(sellersMap.entries())
      .map(([name, data]) => ({ 
         name, 
         pedidos: data.pedidos,
         precioPromedio: data.pedidos > 0 ? (data.totalPrecio / data.pedidos) : 0
      }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 10);

    return res.json({
       countPedidos,
       countFacturados,
       countRechazados,
       totalVendidos,
       sellersData
    });
  } catch (err) {
     console.error(err);
     return res.status(500).json({ error: 'Error' });
  }
});

export default router;
