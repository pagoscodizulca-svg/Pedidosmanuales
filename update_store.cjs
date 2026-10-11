const fs = require('fs');
let code = fs.readFileSync('src/store/index.ts', 'utf8');

code = code.replace(
  /updateOrderStatus: \(id: string, status: OrderStatus, cxcNote\?: string, factNote\?: string, rejectReason\?: string, departmentParam\?: string\) => Promise<void>;/,
  `updateFullOrder: (id: string, orderData: OrderData, newStatus?: OrderStatus) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus, cxcNote?: string, factNote?: string, rejectReason?: string, departmentParam?: string) => Promise<void>;`
);

const newImpl = `
  updateFullOrder: async (id, orderData, newStatus) => {
    try {
       const userStr = localStorage.getItem('auth-storage');
       let changedBy = 'Desconocido';
       let department = 'Ventas';
       if (userStr) {
          const u = JSON.parse(userStr);
          changedBy = u.state?.user?.username || changedBy;
          department = u.state?.user?.role === 'cxc' ? 'Cuentas por Cobrar' : u.state?.user?.role === 'facturacion' ? 'Facturacin' : 'Ventas';
       }

       const historyItem = newStatus ? {
          status: newStatus,
          department,
          changedBy,
          timestamp: new Date().toISOString(),
          reason: 'Validado y actualizado'
       } : undefined;

       const response = await fetch(\`/api/orders/\${id}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderData, status: newStatus, historyItem })
       });
       if (!response.ok) throw new Error('Error al actualizar pedido');
       get().fetchOrders();
    } catch(err) {
       console.error(err);
    }
  },
`;

code = code.replace(/updateOrderStatus: async \(id, status, cxcNote, factNote, rejectReason, departmentParam\) => {/, newImpl + '\n  updateOrderStatus: async (id, status, cxcNote, factNote, rejectReason, departmentParam) => {');

fs.writeFileSync('src/store/index.ts', code, 'utf8');
console.log('Store updated');
