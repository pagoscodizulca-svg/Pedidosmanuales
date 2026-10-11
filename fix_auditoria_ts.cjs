const fs = require('fs');
let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');

// Fix 1 & 2: Recharts data type
code = code.replace(/onClick=\{\(data\) => setSelectedProduct\(data\.desc\)\}/g, 'onClick={(data: any) => setSelectedProduct(data.desc)}');

// Fix 3: productName instead of productDesc
code = code.replace(/productDesc=\{selectedProduct\}/, 'productName={selectedProduct}');

fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Fixed TS errors in Auditoria');
