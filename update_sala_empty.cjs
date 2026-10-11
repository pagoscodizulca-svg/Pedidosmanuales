const fs = require('fs');

let code = fs.readFileSync('src/components/ventas/SalaEsperaAlkosto.tsx', 'utf8');

code = code.replace(
  /if \(pendingOrders\.length === 0\) return null;/,
  `// if (pendingOrders.length === 0) return null; // Comentado para que siempre se vea`
);

code = code.replace(
  /\<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"\>[\s\S]*?\<\/div\>/,
  `{pendingOrders.length === 0 ? (
        <div className="bg-white/50 border border-indigo-100 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Clock className="text-indigo-200 mb-2" size={32} />
          <p className="text-indigo-400 font-bold text-sm">No hay pedidos nuevos por validar.</p>
          <p className="text-indigo-300 text-xs">Los pedidos enviados desde la App FDV aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingOrders.map(o => (
            <div key={o.id} className="bg-white rounded-xl p-5 border border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-extrabold text-slate-800 text-sm truncate uppercase pr-2" title={o.order.cliente}>
                    {o.order.cliente}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Ruta: <span className="text-slate-700">{o.order.ruta}</span></p>
                  <p className="text-xs text-slate-500 font-medium">Items: <span className="text-slate-700">{o.order.articulos.filter(a => a.descripcion).length}</span></p>
                </div>
                <span className="shrink-0 bg-amber-100 border border-amber-200 text-amber-800 text-[10px] px-2 py-1 rounded font-bold uppercase shadow-sm">
                  POR VALIDAR
                </span>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-lg font-extrabold text-slate-800">\${(o.order.total_pedido || 0).toFixed(2)}</span>
              </div>
              
              <button
                onClick={() => setSelectedOrder(o)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-extrabold hover:bg-indigo-700 hover:shadow-lg transition-all"
              >
                <Eye size={16} /> Abrir y Validar
              </button>
            </div>
          ))}
        </div>
      )}`
);

fs.writeFileSync('src/components/ventas/SalaEsperaAlkosto.tsx', code, 'utf8');
console.log('SalaEsperaAlkosto updated for empty state');
