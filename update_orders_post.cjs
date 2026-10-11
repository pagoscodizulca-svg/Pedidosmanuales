const fs = require('fs');
let code = fs.readFileSync('server/routes/orders.ts', 'utf8');

const dupCheckCode = \
    // --- Duplication Check ---
    let dupQuery = supabase.from('orders').select('id, numero_pedido, fecha, observaciones, articulos');
    if (newOrder.order.id_cliente) {
      dupQuery = dupQuery.eq('id_cliente', newOrder.order.id_cliente);
    } else if (newOrder.order.cliente) {
      dupQuery = dupQuery.eq('cliente', newOrder.order.cliente);
    }
    const { data: existingClientOrders, error: dupErr } = await dupQuery;
    
    if (!dupErr && existingClientOrders && existingClientOrders.length > 0) {
      for (const ex of existingClientOrders) {
        if (ex.articulos && ex.articulos.length === newOrder.order.articulos.length) {
           const isSameItems = newOrder.order.articulos.every(newArt => {
             return ex.articulos.some(exArt => 
               (exArt.descripcion === newArt.descripcion || exArt.codigo === newArt.codigo) &&
               exArt.cantidad_solicitada === newArt.cantidad_solicitada
             );
           });
           
           if (isSameItems) {
             const obs1 = (newOrder.order.observaciones || '').trim().toLowerCase();
             const obs2 = (ex.observaciones || '').trim().toLowerCase();
             if (obs1 === obs2) {
               return res.status(409).json({
                 error: \\\Ya este pedido lo envi. Fecha: \, Correlativo: \\\\
               });
             }
           }
        }
      }
    }
    // --- End Duplication Check ---

    // Generate Correlativo if needed\;

code = code.replace(/\/\/ Generate Correlativo if needed/, dupCheckCode);
fs.writeFileSync('server/routes/orders.ts', code, 'utf8');
console.log('Duplication check added');

