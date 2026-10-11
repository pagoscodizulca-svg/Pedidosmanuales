const fs = require('fs');

let code = fs.readFileSync('server/routes/orders.ts', 'utf8');

const newPut = `
// PUT full order edit
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { orderData, status, historyItem } = req.body;
  
  try {
    const { data: existingData, error: fetchErr } = await supabase
      .from('orders').select('*').eq('id', id).single();
    if (fetchErr || !existingData) throw fetchErr || new Error('Not found');

    const updatedHistory = existingData.status_history ? [...existingData.status_history] : [];
    if (historyItem) {
       updatedHistory.push(historyItem);
    }

    const { error: updateErr } = await supabase.from('orders').update({
      cliente: orderData.cliente,
      id_cliente: orderData.id_cliente,
      ruta: orderData.ruta,
      supervisor: orderData.supervisor,
      chofer: orderData.chofer,
      observaciones: orderData.observaciones,
      total_pedido: orderData.total_pedido,
      monto_pedido: orderData.monto_pedido,
      articulos: orderData.articulos,
      raw_order: orderData,
      status: status || existingData.status,
      status_history: updatedHistory,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (updateErr) throw updateErr;

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update full order error:', err);
    res.status(500).json({ error: err.message });
  }
});
`;

code = code.replace('// PUT update supervisor', newPut + '\n// PUT update supervisor');
fs.writeFileSync('server/routes/orders.ts', code, 'utf8');
console.log('orders.ts updated with full PUT');
