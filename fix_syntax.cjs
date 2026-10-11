const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Layout.tsx', 'utf8');

const correctNavItems = \  const allNavItems = [
    { path: '/', label: 'Ventas', icon: <ShoppingCart size={20} />, roles: ['ventas', 'master', 'gerencia'] },
    { path: '/cxc', label: 'Cuentas por Cobrar', icon: <DollarSign size={20} />, badge: kpiPendienteCXC, roles: ['cxc', 'master', 'gerencia'] },
    { path: '/facturacion', label: 'Facturación', icon: <FileText size={20} />, badge: kpiPendienteFact, roles: ['facturacion', 'master', 'gerencia'] },
    { path: '/auditoria', label: 'Auditoría', icon: <Activity size={20} />, roles: ['master', 'gerencia'] },
    { path: '/historial', label: 'Historial', icon: <Archive size={20} />, roles: ['ventas', 'cxc', 'facturacion', 'master', 'gerencia'] },
  ];\;

code = code.replace(/const allNavItems = \[\s*\{ path: '\/',[\s\S]*?\];/, correctNavItems);
fs.writeFileSync('src/components/layout/Layout.tsx', code, 'utf8');
console.log('Fixed syntax error via cjs');

