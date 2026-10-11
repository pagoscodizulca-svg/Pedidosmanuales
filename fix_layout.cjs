const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Layout.tsx', 'utf8');
code = code.replace(
  'import { ShoppingCart, DollarSign, FileText, Activity } from \'lucide-react\';',
  'import { ShoppingCart, DollarSign, FileText, Activity, Archive } from \'lucide-react\';'
);
if (!code.includes('/historial')) {
  code = code.replace(
    /{ path: '\/auditoria'.+?,/,
    match => match + '\n    { path: \'/historial\', label: \'Historial\', icon: <Archive size={20} />, roles: [\'ventas\', \'cxc\', \'facturacion\', \'master\', \'gerencia\'] },'
  );
}
fs.writeFileSync('src/components/layout/Layout.tsx', code, 'utf8');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/import \{ CXC \} from '.\/pages\/CXC.js';/, 'import { CXC } from \'./pages/CXC.js\';');
fs.writeFileSync('src/App.tsx', appCode, 'utf8');
console.log('Fixed Layout and App');

