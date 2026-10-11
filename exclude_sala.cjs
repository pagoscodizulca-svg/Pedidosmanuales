const fs = require('fs');
let code = fs.readFileSync('src/components/shared/SeguimientoBlock.tsx', 'utf8');

code = code.replace(
  /const filteredOrders = orders\.filter\(o => \{/,
  `const filteredOrders = orders.filter(o => {\n    if (o.status === 'POR_VALIDAR') return false;`
);

code = code.replace(
  /const countTodos = orders\.length;/,
  `const countTodos = orders.filter(o => o.status !== 'POR_VALIDAR').length;`
);

fs.writeFileSync('src/components/shared/SeguimientoBlock.tsx', code, 'utf8');
console.log('Excluded POR_VALIDAR from SeguimientoBlock');
