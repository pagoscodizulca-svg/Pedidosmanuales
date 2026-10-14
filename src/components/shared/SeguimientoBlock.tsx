import React, { useState } from 'react';
import { SeguimientoTable } from './SeguimientoTable';
import { Printer } from 'lucide-react';
import { DbOrder } from '../../types';
import { useAppStore } from '../../store/index';
import { generateConsolidatedReport, printMultipleOrders } from '../../lib/pdfUtils';

interface SeguimientoBlockProps {
  orders: DbOrder[];
  hideTitle?: boolean;
}

export const SeguimientoBlock: React.FC<SeguimientoBlockProps> = ({ orders, hideTitle }) => {
  const { fetchOrders } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [correlativoTerm, setCorrelativoTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sellerTerm, setSellerTerm] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'TODOS' | 'PROCESO' | 'LISTOS' | 'RECHAZADOS'>('TODOS');

  const filteredOrders = orders.filter(o => {
    if (o.status === 'POR_VALIDAR') return false;
    // Tab Filter
    if (activeFilterTab === 'PROCESO' && o.status !== 'PENDIENTE_FACTURACION' && o.status !== 'PENDIENTE_CXC') return false;
    if (activeFilterTab === 'LISTOS' && o.status !== 'COMPLETADO') return false;
    if (activeFilterTab === 'RECHAZADOS' && o.status !== 'RECHAZADO') return false;

    const ord = o.order || ({} as any);

    // Search Term (Cliente o ID)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchClient = String(ord.cliente || '').toLowerCase().includes(q);
      const matchId = String(ord.id_cliente || '').toLowerCase().includes(q);
      if (!matchClient && !matchId) return false;
    }

    // Correlativo(s)
    if (correlativoTerm) {
      const terms = correlativoTerm.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const numPed = String(ord.numero_pedido || '').toLowerCase();
      const matchNum = terms.some(t => numPed.includes(t));
      if (!matchNum) return false;
    }

    // Seller
    if (sellerTerm) {
      const ruta = String(ord.ruta || '').toLowerCase();
      if (!ruta.includes(sellerTerm.toLowerCase())) return false;
    }

    // Dates
    if (dateFrom && (ord.fecha || '') < dateFrom) return false;
    if (dateTo && (ord.fecha || '') > dateTo) return false;

    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // Newest first

  const countProceso = orders.filter(o => o.status === 'PENDIENTE_FACTURACION' || o.status === 'PENDIENTE_CXC').length;
  const countListos = orders.filter(o => o.status === 'COMPLETADO').length;
  const countRechazados = orders.filter(o => o.status === 'RECHAZADO').length;
  const countTodos = orders.filter(o => o.status !== 'POR_VALIDAR').length;

  // ---- Selección para imprimir ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Solo se imprimen los seleccionados que siguen visibles con los filtros actuales
  const selectedOrders = filteredOrders.filter(o => selectedIds.has(o.id));
  const selectedCount = selectedOrders.length;

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedIds.has(o.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredOrders.forEach(o => (allSelected ? next.delete(o.id) : next.add(o.id)));
      return next;
    });
  };

  const handlePrintSelected = () => {
    if (selectedOrders.length > 0) printMultipleOrders(selectedOrders, true);
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* HEADER & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col xl:flex-row xl:items-start gap-6">
        
        {/* Title (opcional si se embebe) */}
        {!hideTitle && (
          <div className="flex-shrink-0 pt-1">
             <h2 className="text-xl font-extrabold text-slate-800 leading-tight">
               Seguimiento<br/>Global de<br/>Pedidos
             </h2>
          </div>
        )}

        {/* Filter Form */}
        <div className="flex-1 flex flex-col gap-4">
           
           {/* Top Row: Tabs/Badges */}
           <div className="flex flex-wrap items-center gap-2">
             <button 
               onClick={() => setActiveFilterTab('TODOS')}
               className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition-colors ${activeFilterTab === 'TODOS' ? 'border-codizulca-cyan bg-cyan-50 text-codizulca-cyan' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
             >
               Todos los Pedidos ({countTodos})
             </button>
             <button 
               onClick={() => setActiveFilterTab('PROCESO')}
               className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition-colors ${activeFilterTab === 'PROCESO' ? 'border-codizulca-cyan bg-cyan-50 text-codizulca-cyan' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
             >
               Por Facturar / En Proceso ({countProceso})
             </button>
             <button 
               onClick={() => setActiveFilterTab('LISTOS')}
               className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition-colors ${activeFilterTab === 'LISTOS' ? 'border-codizulca-cyan bg-cyan-50 text-codizulca-cyan' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
             >
               Facturados / Listos ({countListos})
             </button>
             <button 
               onClick={() => setActiveFilterTab('RECHAZADOS')}
            className={`px-4 py-2 font-bold text-sm transition-colors flex items-center gap-2 border-b-2 ${
              activeFilterTab === 'RECHAZADOS' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            RECHAZADOS
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeFilterTab === 'RECHAZADOS' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
              {countRechazados}
            </span>
          </button>
          
          
           </div>

           {/* Middle Row: Inputs (Dates, Correlativo, Cliente) */}
           <div className="flex flex-wrap items-center gap-3">

             
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 shadow-sm focus-within:border-codizulca-cyan focus-within:ring-1 focus-within:ring-cyan-200">
               <input type="date" className="bg-transparent py-2 text-[13px] font-medium text-slate-600 focus:outline-none"
                 value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
               <span className="text-slate-300">-</span>
               <input type="date" className="bg-transparent py-2 text-[13px] font-medium text-slate-600 focus:outline-none"
                 value={dateTo} onChange={e => setDateTo(e.target.value)} />
             </div>
             
             <input type="text" placeholder="Nº Correlativo(s) (ej: 123, 456)..." 
               className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium shadow-sm focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200 w-56 placeholder-slate-400"
               value={correlativoTerm} onChange={e => setCorrelativoTerm(e.target.value)}
             />
             
             <input type="text" placeholder="Buscar Cliente/Código..." 
               className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium shadow-sm focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200 flex-1 min-w-[200px] placeholder-slate-400"
               value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
             />
           </div>

           {/* Bottom Row: Vendedor and Print */}
           <div className="flex flex-wrap items-center gap-3">
             <input type="text" placeholder="Buscar Vendedor..." 
               className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium shadow-sm focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200 w-48 placeholder-slate-400"
               value={sellerTerm} onChange={e => setSellerTerm(e.target.value)}
             />

             <button 
               onClick={() => generateConsolidatedReport(filteredOrders, dateFrom && dateTo ? `Del ${dateFrom} al ${dateTo}` : 'Todo')}
               className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg px-6 py-2 text-[13px] font-bold transition-all shadow-md shadow-blue-200 border border-transparent">
               <Printer size={16} /> Imprimir Todo el Lote ({filteredOrders.length})
             </button>

              <button
                onClick={handlePrintSelected}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white rounded-lg px-6 py-2 text-[13px] font-bold transition-all shadow-md border border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer size={16} /> Imprimir seleccionados ({selectedCount})
              </button>

              {selectedCount > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-slate-500 hover:text-slate-800 underline">
                  Limpiar selección
                </button>
              )}
           </div>
        </div>
      </div>

      {/* TABLE */}
      <SeguimientoTable
        orders={filteredOrders}
        selectedIds={selectedIds}
        onToggle={toggleSelection}
        onToggleAll={toggleAll}
      />
    </div>
  );
};
