const fs = require('fs');
let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');
code = code.replace(/orders=\{\[\]\} \/\/ We don't have orders array in memory anymore\. Need to adjust the Modal logic or pass it differently\. For now, empty array avoids crash\./, '');
fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Fixed orders prop in Auditoria');
