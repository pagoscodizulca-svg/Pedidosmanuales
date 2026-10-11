const fs = require('fs');
let code = fs.readFileSync('src/components/shared/OrderModal.tsx', 'utf8');

const oldFooter = `
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
          <button 
            onClick={() => printOrder(order, true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors text-sm"
          >
            <Printer size={16} /> Imprimir Pedido
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
`;

const newFooter = `
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => printOrder(order, true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors text-sm"
            >
              <Printer size={16} /> Imprimir Pedido
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm"
            >
              Cerrar
            </button>
            {order.status === 'POR_VALIDAR' && (
              <button 
                onClick={handleSaveAndSend}
                disabled={saving}
                className="px-6 py-2.5 bg-codizulca-cyan hover:bg-cyan-400 text-slate-800 font-black rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {saving ? 'Guardando...' : 'Aprobar y Enviar a CxC'}
              </button>
            )}
          </div>
        </div>
`;

code = code.replace(oldFooter.trim(), newFooter.trim());

fs.writeFileSync('src/components/shared/OrderModal.tsx', code, 'utf8');
console.log('Fixed OrderModal footer.');
