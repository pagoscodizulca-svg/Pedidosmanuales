const fs = require('fs');
let code = fs.readFileSync('server/routes/analytics.ts', 'utf8');

const newProductLogic = `
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
`;

code = code.replace(/router\.get\('\/product', async \(req, res\) => \{[\s\S]*\}\);\nexport default router;/, newProductLogic + '\nexport default router;');

fs.writeFileSync('server/routes/analytics.ts', code, 'utf8');
console.log('Updated /product endpoint in analytics.ts');
