import React, { useState } from 'react';
import { DbOrder } from '../../types';
import { OrderModal } from './OrderModal';
import { Check, X, Eye } from 'lucide-react';

interface SeguimientoTableProps {
  orders: DbOrder[];
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
}

export const SeguimientoTable: React.FC<SeguimientoTableProps> = ({ orders, selectedIds, onToggle, onToggleAll }) => {
  const selectable = !!selectedIds && !!onToggle && !!onToggleAll;
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);

  const getStepStatus = (order: DbOrder) => {
    const s = order.status;
    let step1 = 'pending'; // CxC
    let step2 = 'pending'; // Facturacion
    let step3 = 'pending'; // Listo

    if (s === 'PENDIENTE_CXC') {
      step1 = 'active';
    } else if (s === 'PENDIENTE_FACTURACION') {
      step1 = 'done';
      step2 = 'active';
    } else if (s === 'COMPLETADO') {
      step1 = 'done';
      step2 = 'done';
      step3 = 'done';
    } else if (s === 'RECHAZADO') {
      // Find where it was rejected
      const historyList = order.statusHistory || [];
      const lastHist = historyList.length > 0 ? historyList[historyList.length - 1] : undefined;
      if (lastHist?.department === 'Cuentas por Cobrar') {
        step1 = 'rejected';
      } else {
        step1 = 'done';
        step2 = 'rejected';
      }
    }
    
    return { step1, step2, step3 };
  };

  const renderStepper = (order: DbOrder) => {
    const { step1, step2, step3 } = getStepStatus(order);
    
    const Node = ({ step, label, num, isLast = false, onClick, tooltip }: any) => {
      let bg = 'bg-slate-200 text-slate-500';
      if (step === 'done') bg = 'bg-codizulca-cyan text-white';
      if (step === 'active') bg = 'bg-codizulca-cyan text-white ring-4 ring-cyan-100';
      if (step === 'rejected') bg = 'bg-codizulca-red text-white';
      
      if (num === 'Listo' && step === 'done') {
         bg = 'bg-green-500 text-white';
      }

      return (
        <div className="relative flex items-center group cursor-pointer" onClick={onClick}>
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold z-10 transition-all ${bg}`}>
              {step === 'done' ? <Check size={14} /> : step === 'rejected' ? <X size={14} /> : num}
            </div>
            <span className="text-[9px] font-bold text-slate-500 mt-1 absolute top-8 whitespace-nowrap">
              {label}
            </span>
          </div>
          
          {!isLast && (
            <div className={`h-1 w-12 mx-1 rounded-full ${step === 'done' ? 'bg-codizulca-cyan' : 'bg-slate-200'}`} />
          )}

          {/* Tooltip Hover */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white border border-slate-200 shadow-xl rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
            <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
               <span className="text-xs font-bold text-codizulca-cyan">{label}</span>
               <span className="text-[10px] text-slate-400">{step === 'done' ? 'Aprobado' : step === 'active' ? 'En Proceso' : step === 'rejected' ? 'Rechazado' : 'Pendiente'}</span>
            </div>
            <p className="text-[11px] text-slate-600 mb-2">
              {tooltip || (step === 'active' ? 'Esperando acción en este departamento.' : step === 'done' ? 'Procesado correctamente.' : 'A la espera.')}
            </p>
            <div className="text-[10px] font-bold text-codizulca-cyan flex items-center gap-1">
              <Eye size={12} /> Clic para ver detalle y trazabilidad →
            </div>
          </div>
        </div>
      );
    };

    const historyList = order.statusHistory || [];
    const cxcHist = historyList.find(h => h.department === 'Cuentas por Cobrar' && h.status !== 'CREADO');
    const factHist = historyList.find(h => h.department === 'Facturación');

    let currentLoc = 'Cuentas por Cobrar';
    if (step2 === 'active') currentLoc = 'Facturación';
    if (step3 === 'done') currentLoc = 'Listo';
    if (order.status === 'RECHAZADO') currentLoc = 'Rechazado';

    return (
      <div className="flex flex-col items-center">
         <div className="text-[10px] font-bold text-slate-800 mb-2 w-full text-left pl-2">
           Ubicación: <span className={currentLoc === 'Listo' ? 'text-green-600' : currentLoc === 'Rechazado' ? 'text-red-600' : 'text-slate-800'}>{currentLoc}</span>
         </div>
         <div className="flex items-center pb-4">
           <Node 
             step={step1} label="CxC" num="1" 
             onClick={() => setSelectedOrder(order)}
             tooltip={cxcHist?.reason || (step1 === 'rejected' ? order.rejectReason : null)} 
           />
           <Node 
             step={step2} label="Facturación" num="2" 
             onClick={() => setSelectedOrder(order)}
             tooltip={factHist?.reason || (step2 === 'rejected' ? order.rejectReason : null)} 
           />
           <Node 
             step={step3} label="Listo" num={<Check size={14} />} isLast 
             onClick={() => setSelectedOrder(order)}
           />
         </div>
      </div>
    );
  };

  const fmtFechaCarga = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${d.toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'})}`;
    } catch {
      return '-';
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="pl-5 pr-2 py-4 w-10">
                {selectable && (
                  <input
                    type="checkbox"
                    title="Seleccionar todos los pedidos mostrados"
                    className="w-4 h-4 accent-codizulca-red cursor-pointer"
                    checked={orders.length > 0 && orders.every(o => selectedIds!.has(o.id))}
                    onChange={() => onToggleAll!()}
                  />
                )}
              </th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Nº<br/>Correlativo</th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Código</th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendedor</th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha Pedido</th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha Carga</th>
              <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-slate-400">No hay pedidos para mostrar.</td></tr>
            )}
            {orders.map(order => {
              const ord = order.order || ({} as any);
              const numPed = String(ord.numero_pedido || '').trim();
              const numPedDisplay = numPed ? numPed.padStart(5, '0') : '-';

              return (
                <tr key={order.id} className={`transition-colors ${selectable && selectedIds!.has(order.id) ? 'bg-red-50/40' : 'hover:bg-slate-50/50'}`}>
                  <td className="pl-5 pr-2 py-4">
                    {selectable && (
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-codizulca-red cursor-pointer"
                        checked={selectedIds!.has(order.id)}
                        onChange={() => onToggle!(order.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-slate-700">{numPedDisplay}</td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-700">{ord.id_cliente || '-'}</td>
                  <td className="px-4 py-4 font-extrabold text-slate-800 text-[13px] uppercase">{ord.cliente || '-'}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-600 uppercase">{ord.ruta || '-'}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-800">{ord.fecha || '-'}</td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-500">{order.createdAt ? fmtFechaCarga(order.createdAt) : '-'}</td>
                  <td className="px-4 py-4 text-right font-extrabold text-slate-800">${Number(ord.total_pedido || ord.monto_pedido || 0).toFixed(2)}</td>
                  <td className="px-8 py-2">
                    {renderStepper(order)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
};
