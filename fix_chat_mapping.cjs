const fs = require('fs');

let code = fs.readFileSync('server/routes/chat.ts', 'utf8');

const oldLogic = `          let dbCampo = campo;
          if (dbCampo === 'fecha') dbCampo = 'created_at';
          const validColumns = ['numero_pedido', 'cliente', 'ruta', 'status', 'created_at', 'supervisor', 'chofer'];
          if (!validColumns.includes(dbCampo)) dbCampo = 'cliente';`;

const newLogic = `          let dbCampo = campo;
          if (dbCampo === 'fecha') dbCampo = 'created_at';
          if (dbCampo === 'id_cliente' || dbCampo === 'codigo' || dbCampo === 'codigo_cliente') dbCampo = 'id_cliente';
          const validColumns = ['numero_pedido', 'cliente', 'id_cliente', 'ruta', 'status', 'created_at', 'supervisor', 'chofer'];
          if (!validColumns.includes(dbCampo)) dbCampo = 'cliente';`;

code = code.replace(oldLogic, newLogic);

// Update description so AI knows exactly what fields to use
code = code.replace(
  /El campo a buscar en la BD \(ej\. numero_pedido, cliente, ruta, status\)/,
  "El campo a buscar en la BD (Valores permitidos: numero_pedido, cliente, id_cliente, ruta, status, fecha, supervisor)"
);

fs.writeFileSync('server/routes/chat.ts', code, 'utf8');
console.log('Fixed chat mapping and instructions.');
