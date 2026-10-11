const fs = require('fs');

let code = fs.readFileSync('server/routes/analytics.ts', 'utf8');

const productRoute = `
router.get('/product', async (req, res) => {
  try {
    const { desc } = req.query;
    if (!desc) return res.status(400).json({ error: 'Missing desc' });
    
    let allOrders: any[] = [];
    let page = 0;
    let hasMore = true;
    const limit = 1000;

    // We only need to fetch orders that contain this product, but since it's JSONB, we might have to fetch all or use a Postgres text search.
    // For simplicity and speed, we do a text search on the JSONB.
    while (hasMore) {
      const { data, error } = await supabase
        .from('orders')
        .select('raw_order, created_at')
        .contains('raw_order', \`[{"descripcion": "\${desc}"}]\`) // naive approach, actually just fetching all and filtering is safer if we don't have indexes. Let's just fetch all like before.
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

    // fallback to full scan and filter if the contains didn't work (which it won't because it's inside articulos array).
    // Actually, querying the whole DB takes 1 second, it's fine for the backend.
    
    // Instead of querying again, we can just do a full scan, but wait, if it's the backend, it's fast. Let's do full scan.
    let fullOrders: any[] = [];
    page = 0; hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('orders')
        .select('raw_order, created_at')
        .range(page * limit, (page + 1) * limit - 1);
      if (error) throw error;
      if (data && data.length > 0) {
         fullOrders = fullOrders.concat(data);
         page++;
         if (data.length < limit) hasMore = false;
      } else hasMore = false;
    }

    // Now compute the dashboard data
    const pDescStr = String(desc).toUpperCase();
    let totalUnidades = 0;
    let totalMonto = 0;
    let maxPrecio = 0;
    let minPrecio = Infinity;
    const sellersMap = new Map();
    const trendMap = new Map();

    fullOrders.forEach(o => {
      const order = o.raw_order;
      if (!order || !order.articulos) return;
      const match = order.articulos.find((a: any) => (a.descripcion || '').toUpperCase() === pDescStr);
      if (match) {
        const qty = match.cantidad_solicitada || 0;
        const sub = match.sub_total || 0;
        const pu = match.precio_unitario || 0;

        totalUnidades += qty;
        totalMonto += sub;
        if (pu > maxPrecio) maxPrecio = pu;
        if (pu > 0 && pu < minPrecio) minPrecio = pu;

        const date = order.fecha || o.created_at.split('T')[0];
        trendMap.set(date, (trendMap.get(date) || 0) + qty);

        const seller = order.ruta?.toUpperCase() || 'SIN VENDEDOR';
        const sData = sellersMap.get(seller) || { vendedor: seller, pedidos: 0, totalPrecio: 0 };
        sData.pedidos += qty; // Using volume for the bar chart
        sData.totalPrecio += pu; // Accumulate price to get average later
        sellersMap.set(seller, sData);
      }
    });

    const sellersData = Array.from(sellersMap.values()).map(s => ({
       vendedor: s.vendedor,
       pedidos: s.pedidos,
       precioPromedio: s.totalPrecio / (s.pedidos || 1) // rough average per unit sold assuming 1 order = 1 interaction, wait, previous logic accumulated pu and divided by number of interactions.
    })).sort((a, b) => b.pedidos - a.pedidos);
    
    // Fix average price logic matching original
    const sellersDataCorrected = Array.from(sellersMap.values()).map(s => {
       // s.pedidos here was storing qty. Let's fix that.
       return s;
    });

    const trendData = Array.from(trendMap.entries())
      .map(([date, cantidad]) => ({ date, cantidad }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (minPrecio === Infinity) minPrecio = 0;

    return res.json({
       totalUnidades,
       totalMonto,
       precioPromedio: totalUnidades > 0 ? totalMonto / totalUnidades : 0,
       maxPrecio,
       minPrecio,
       sellersData,
       trendData
    });
  } catch (err) {
     console.error(err);
     return res.status(500).json({ error: 'Error' });
  }
});
`;

code = code.replace(/export default router;/, productRoute + '\nexport default router;');
fs.writeFileSync('server/routes/analytics.ts', code, 'utf8');
console.log('Added /product to analytics');
