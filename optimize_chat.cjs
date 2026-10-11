const fs = require('fs');

let code = fs.readFileSync('server/routes/chat.ts', 'utf8');

const oldLogic = `          const { data, error } = await supabase
             .from('orders')
             .select('numero_pedido, cliente, ruta, status, total_pedido, fecha, articulos')
             .ilike(campo, \`%\${valor}%\`)
             .limit(limite)
             .order('created_at', { ascending: false });`;

const newLogic = `          let dbCampo = campo;
          if (dbCampo === 'fecha') dbCampo = 'created_at';
          const validColumns = ['numero_pedido', 'cliente', 'ruta', 'status', 'created_at', 'supervisor', 'chofer'];
          if (!validColumns.includes(dbCampo)) dbCampo = 'cliente';

          const { data, error } = await supabase
             .from('orders')
             .select('numero_pedido, cliente, ruta, status, monto_pedido, total_pedido, created_at')
             .ilike(dbCampo, \`%\${valor}%\`)
             .limit(limite)
             .order('created_at', { ascending: false });`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('server/routes/chat.ts', code, 'utf8');
console.log('Optimized chat DB query.');
