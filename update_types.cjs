const fs = require('fs');

let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(/CREADO" \| "MODIFICADO/, 'CREADO" | "POR_VALIDAR" | "MODIFICADO');
code = code.replace(/type OrderStatus = "PENDIENTE_CXC/, 'type OrderStatus = "POR_VALIDAR" | "PENDIENTE_CXC');

fs.writeFileSync('src/types.ts', code);
console.log('Updated types.ts');
