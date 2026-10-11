const fs = require('fs');

let code = fs.readFileSync('server/routes/orders.ts', 'utf8');

// Use a regex to find the specific line and replace it
code = code.replace(
  /if \(existingData\.numero_pedido === 'APP-FDV' && status === 'PENDIENTE_CXC'\) \{/, 
  "if (existingData.status === 'POR_VALIDAR' && status === 'PENDIENTE_CXC') {"
);

fs.writeFileSync('server/routes/orders.ts', code, 'utf8');
console.log('Fixed PUT /orders/:id condition.');
