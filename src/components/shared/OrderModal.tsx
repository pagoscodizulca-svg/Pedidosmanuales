import React from 'react';
import { X, Printer, User } from 'lucide-react';
import { DbOrder, OrderData } from '../../types';
import { useAppStore } from '../../store/index';
import { useAuthStore } from '../../store/auth';
import { PlanillaForm } from '../ventas/PlanillaForm';
import { printOrder } from '../../lib/pdfUtils';

interface OrderModalProps {
  order: DbOrder;
  onClose: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({ order, onClose }) => {
  const { user } = useAuthStore();
  const isVentas = user?.role === 'ventas' || user?.role === 'gerencia' || user?.role === 'master';
  
  // Regla estricta: solo se puede editar si está POR_VALIDAR y el usuario pertenece a Ventas/Gerencia/Master
  const isEditing = order.status === 'POR_VALIDAR' && isVentas;
  const [draft, setDraft] = React.useState<OrderData>(order.order);
  const { updateFullOrder } = useAppStore();
  const [saving, setSaving] = React.useState(false);

  const handleSaveAndSend = async () => {
    if (!isVentas) {
      alert('Solo el departamento de Ventas puede aprobar y editar pedidos.');
      return;
    }
    setSaving(true);
    await updateFullOrder(order.id, draft, 'PENDIENTE_CXC');
    setSaving(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-slate-800">Detalles del Pedido</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              order.status === 'COMPLETADO' ? 'bg-cyan-100 text-cyan-800' :
              order.status === 'RECHAZADO' ? 'bg-red-100 text-red-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {order.status.replace('_', ' ')}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 space-y-6">
          
          {/* Resumen Superior */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex justify-between items-center shadow-sm">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 uppercase leading-tight mb-2">
                {order.order.cliente}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="bg-red-50 text-codizulca-red px-2 py-0.5 rounded border border-red-100 font-mono">
                  ID: {order.order.id_cliente || '-'}
                </span>
                <span className="bg-red-50 text-codizulca-red px-2 py-0.5 rounded border border-red-100 font-mono">
                  Pedido #{order.order.numero_pedido}
                </span>
                <span>Fecha: {order.order.fecha}</span>
                <span>•</span>
                <span>Ruta/Vendedor: <strong className="text-slate-700">{order.order.ruta || '-'}</strong></span>
                <span>•</span>
                <span>Artículos: {order.order.articulos.filter(a => a.descripcion || a.cantidad_solicitada > 0).length}</span>
              </div>
            </div>
            <div className="bg-amber-100/50 border border-amber-200 rounded-lg px-6 py-3 text-right">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Total a pagar:</div>
              <div className="text-2xl font-extrabold text-slate-800">
                ${(order.order.total_pedido || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Formato Planilla (Read Only para CxC y Facturación) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
             <div className={`min-w-[720px] ${!isEditing ? 'pointer-events-none select-none opacity-95' : ''}`}>
               <PlanillaForm value={draft} onChange={setDraft} nextNumero={order.order.numero_pedido || ''} />
             </div>
          </div>

          {/* Historial de Trazabilidad */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 uppercase mb-6">
              <HistoryIcon /> Historial de Trazabilidad
            </h3>
            <div className="space-y-4">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs">
                      <User size={14} className="text-codizulca-red" /> {h.changedBy}
                    </div>
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      h.status === 'CREADO' ? 'bg-slate-100 text-slate-600' :
                      h.status === 'COMPLETADO' ? 'bg-green-100 text-green-700' :
                      h.status === 'RECHAZADO' ? 'bg-red-100 text-red-700' :
                      'bg-cyan-100 text-cyan-800'
                    }`}>
                      {h.status.replace('_', ' ')}
                    </span>
                    <span className="text-slate-500 text-xs font-medium">({h.department})</span>
                    {h.reason && <span className="text-red-600 text-xs italic ml-2">- {h.reason}</span>}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {new Date(h.timestamp).toLocaleString('es-VE')}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

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
      </div>
    </div>
  );
};

const HistoryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e20613" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);
