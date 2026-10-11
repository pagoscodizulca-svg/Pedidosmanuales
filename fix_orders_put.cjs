const fs = require('fs');

let code = fs.readFileSync('server/routes/orders.ts', 'utf8');

const oldPutLogic = `
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
`;

const newPutLogic = `
    try {
      const { data: existingData, error: fetchErr } = await supabase
        .from('orders').select('*').eq('id', id).single();
      if (fetchErr || !existingData) throw fetchErr || new Error('Not found');
  
      const updatedHistory = existingData.status_history ? [...existingData.status_history] : [];
      if (historyItem) {
         updatedHistory.push(historyItem);
      }

      let finalCorrelativo = existingData.numero_pedido;
      
      // Si el pedido viene de la app movil y se esta aprobando (pasando a PENDIENTE_CXC)
      if (existingData.numero_pedido === 'APP-FDV' && status === 'PENDIENTE_CXC') {
         // Generar correlativo real
         const { data: maxData, error: maxErr } = await supabase
           .from('orders')
           .select('numero_pedido')
           .order('created_at', { ascending: false })
           .limit(100);
         
         let nextNum = 1;
         if (maxData && maxData.length > 0) {
           for (const row of maxData) {
             if (row.numero_pedido && /^0?\\d{4,5}$/.test(row.numero_pedido)) {
               const num = parseInt(row.numero_pedido, 10);
               if (!isNaN(num) && num < 10000) {
                  nextNum = num + 1;
                  break;
               }
             }
           }
         }
         if (nextNum >= 10000) nextNum = 1;
         finalCorrelativo = String(nextNum).padStart(5, '0');
         orderData.numero_pedido = finalCorrelativo; // Actualizar el JSON crudo tambien
      }
  
      const { error: updateErr } = await supabase.from('orders').update({
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
        raw_order: orderData,
        status: status || existingData.status,
        status_history: updatedHistory,
        updated_at: new Date().toISOString()
      }).eq('id', id);
`;

code = code.replace(oldPutLogic.trim(), newPutLogic.trim());

fs.writeFileSync('server/routes/orders.ts', code, 'utf8');
console.log('Fixed PUT /orders/:id correlativo logic.');
