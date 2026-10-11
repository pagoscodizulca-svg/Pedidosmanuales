const fs = require('fs');

let code = fs.readFileSync('server/routes/integrations.ts', 'utf8');

// Replace the correlativo generation logic with a static temporary placeholder
const regex = /\/\/ 1\. Generate Correlativo[\s\S]*?if \(nextNum >= 10000\) nextNum = 1;\s*const numero_pedido = String\(nextNum\)\.padStart\(5, '0'\);/;
code = code.replace(regex, `// 1. Asignar correlativo temporal. El real se asigna cuando Ventas aprueba.\n    const numero_pedido = 'APP-FDV';`);

fs.writeFileSync('server/routes/integrations.ts', code, 'utf8');
console.log('Fixed integrations correlativo logic.');
