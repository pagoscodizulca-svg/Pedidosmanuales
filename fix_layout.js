const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Layout.tsx', 'utf8');
code = code.replace(
  'import { ShoppingCart, DollarSign, FileText, Activity } from \'lucide-react\';',
  'import { ShoppingCart, DollarSign, FileText, Activity, Archive } from \'lucide-react\';'
);
code = code.replace(
  '{ path: \'/auditoria\', label: \'Auditora\', icon: <Activity size={20} />, roles: [\'master\', \'gerencia\'] },',
  '{ path: \'/auditoria\', label: \'Auditora\', icon: <Activity size={20} />, roles: [\'master\', \'gerencia\'] },\n    { path: \'/historial\', label: \'Historial\', icon: <Archive size={20} />, roles: [\'ventas\', \'cxc\', \'facturacion\', \'master\', \'gerencia\'] },'
);
fs.writeFileSync('src/components/layout/Layout.tsx', code, 'utf8');
console.log('Fixed Layout');

