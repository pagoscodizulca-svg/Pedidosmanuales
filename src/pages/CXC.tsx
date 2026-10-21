import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/index.js';
import { DbOrder } from '../types.js';
import { CheckCircle, XCircle, Search, User, MapPin, Hash, Calendar, FileText, CheckSquare, Eye, RotateCcw } from 'lucide-react';
import { SeguimientoBlock } from '../components/shared/SeguimientoBlock';
import { OrderModal } from '../components/shared/OrderModal';
import { InlineNoteForm } from '../components/shared/InlineNoteForm';
import { InlineRejectForm } from '../components/shared/InlineRejectForm';
import { printMultipleOrders } from '../lib/pdfUtils';
import { VENDEDORES } from '../data/vendedores';

export const CXC: React.FC = () => {
  const { orders, fetchOrders, updateOrderStatus, updateBatchOrderStatus, updateSupervisor, loading } = useAppStore();
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'PENDIENTES' | 'PROCESADOS' | 'RECHAZADOS'>('PENDIENTES');
  const [filterVendedor, setFilterVendedor] = useState('');
  const [filterZona, setFilterZona] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterCorrelativo, setFilterCorrelativo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Applied Filters for execution
  const [appliedFilters, setAppliedFilters] = useState({
    vendedor: '', zona: '', cliente: '', correlativo: '', dateFrom: '', dateTo: ''
  });

  // Selection & Modals
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewOrder, setViewOrder] = useState<DbOrder | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // KPI Calculations (ignoring filters, global for the module)
  const kpiPendientes = orders.filter(o => o.status === 'PENDIENTE_CXC' && !o.isArchived).length;
  const kpiFacturacion = orders.filter(o => o.status === 'PENDIENTE_FACTURACION' && !o.isArchived).length;
  const kpiProcesados = orders.filter(o => o.status === 'COMPLETADO' && !o.isArchived).length;
  const kpiRechazados = orders.filter(o => o.status === 'RECHAZADO' && !o.isArchived).length;

  // Filter Logic
  const ejecutarBusqueda = () =>
    setAppliedFilters({ vendedor: filterVendedor, zona: filterZona, cliente: filterCliente, correlativo: filterCorrelativo, dateFrom, dateTo });

  const limpiarFiltros = () => {
    setFilterVendedor('');
    setFilterZona('');
    setFilterCliente('');
    setFilterCorrelativo('');
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({ vendedor: '', zona: '', cliente: '', correlativo: '', dateFrom: '', dateTo: '' });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.isArchived) return false;
      
      // Tab matching
      if (activeTab === 'PENDIENTES' && o.status !== 'PENDIENTE_CXC') return false;
      if (activeTab === 'PROCESADOS' && o.status !== 'PENDIENTE_FACTURACION' && o.status !== 'COMPLETADO') return false;
      if (activeTab === 'RECHAZADOS' && o.status !== 'RECHAZADO') return false;

      const ord = o.order || ({} as any);

      const ruta = String(ord.ruta || '').toLowerCase();
      if (appliedFilters.vendedor && !ruta.includes(appliedFilters.vendedor.toLowerCase())) return false;
      
      const obs = String(ord.observaciones || '').toLowerCase();
      if (appliedFilters.zona && !obs.includes(appliedFilters.zona.toLowerCase())) return false; 
      
      if (appliedFilters.cliente) {
        const q = appliedFilters.cliente.toLowerCase();
        const clienteStr = String(ord.cliente || '').toLowerCase();
        const idClienteStr = String(ord.id_cliente || '').toLowerCase();
        if (!clienteStr.includes(q) && !idClienteStr.includes(q)) return false;
      }
      
      if (appliedFilters.correlativo) {
        const terms = appliedFilters.correlativo.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const numPed = String(ord.numero_pedido || '').toLowerCase();
        if (!terms.some(t => numPed.includes(t))) return false;
      }

      // Dates
      if (appliedFilters.dateFrom && (ord.fecha || '') < appliedFilters.dateFrom) return false;
      if (appliedFilters.dateTo && (ord.fecha || '') > appliedFilters.dateTo) return false;

      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, activeTab, appliedFilters]);

  // Actions
  const handleAprobar = async (id: string) => {
    await updateOrderStatus(id, 'PENDIENTE_FACTURACION');
  };

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const handleRechazar = (id: string) => {
    setExpandedNoteId(null);
    setRejectTarget(prev => (prev === id ? null : id));
  };

  const confirmRechazo = async (reason: string) => {
    if (!rejectTarget) return;
    await updateOrderStatus(rejectTarget, 'RECHAZADO', undefined, undefined, reason);
    setRejectTarget(null);
  };

  const handleAprobarLote = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`¿Aprobar ${selectedIds.size} pedidos y enviarlos a facturación?`)) {
      await updateBatchOrderStatus(Array.from(selectedIds), 'PENDIENTE_FACTURACION', 'Cuentas por Cobrar');
      setSelectedIds(new Set());
    }
  };

  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const toggleNote = (id: string) => {
    setRejectTarget(null);
    setExpandedNoteId(prev => (prev === id ? null : id));
  };

  const handleSaveNoteInline = async (id: string, note: string) => {
    const order = orders.find(o => o.id === id);
    if (order) {
      await updateOrderStatus(id, order.status, note, order.factNote, order.rejectReason);
    }
    setExpandedNoteId(null);
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ================= HEADER & KPIs ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-wide mb-6">Panel de Cuentas por Cobrar</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* KPI 1 */}
          <div className="bg-slate-900 rounded-xl p-4 text-white shadow-md relative overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pendientes de Aprobar</div>
            <div className="text-4xl font-extrabold">{kpiPendientes}</div>
            <div className="text-[10px] font-bold text-codizulca-red mt-2">Hoja: Ventas</div>
            <div className="absolute -right-4 -bottom-4 opacity-10"><FileText size={80} /></div>
          </div>
          {/* KPI 2 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-1">En Facturación</div>
            <div className="text-4xl font-extrabold text-slate-800">{kpiFacturacion}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-2">Hoja: CXC</div>
          </div>
          {/* KPI 3 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-1">Pedidos Procesados</div>
            <div className="text-4xl font-extrabold text-slate-800">{kpiProcesados}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-2">Hoja: Facturación</div>
          </div>
          {/* KPI 4 */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">Rechazados por CXC</div>
            <div className="text-4xl font-extrabold text-codizulca-red">{kpiRechazados}</div>
            <div className="text-[10px] font-bold text-red-600 mt-2">Rechazados</div>
          </div>
        </div>

        {/* ================= SEARCH FILTERS ================= */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wide">
            <Search size={14} className="text-codizulca-red" /> Búsqueda Inteligente (Vendedor, Zona/Ruta, Cliente y Pedidos)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5"><User size={12}/> Filtrar por Vendedor</label>
              <select 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200 bg-white"
                value={filterVendedor} 
                onChange={e => {
                  setFilterVendedor(e.target.value);
                  setFilterZona(''); 
                }}
              >
                <option value="">Todos los vendedores</option>
                {Object.keys(VENDEDORES).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5"><MapPin size={12}/> Filtrar por Zona Puntual</label>
              <select 
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                value={filterZona} 
                onChange={e => setFilterZona(e.target.value)}
                disabled={!filterVendedor || VENDEDORES[filterVendedor]?.length === 0}
              >
                <option value="">{filterVendedor && VENDEDORES[filterVendedor]?.length > 0 ? 'Selecciona una zona...' : 'Sin zonas configuradas'}</option>
                {filterVendedor && VENDEDORES[filterVendedor]?.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5"><Hash size={12}/> Filtrar por Código / Cliente</label>
              <input type="text" placeholder="Ej: 5663 o FARMAPLUS.." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200" value={filterCliente} onChange={e => setFilterCliente(e.target.value)} onKeyDown={e => e.key === 'Enter' && ejecutarBusqueda()} />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5"><FileText size={12}/> Filtrar por Correlativo(s)</label>
              <input type="text" placeholder="Nº Correlativo(s)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200" value={filterCorrelativo} onChange={e => setFilterCorrelativo(e.target.value)} onKeyDown={e => e.key === 'Enter' && ejecutarBusqueda()} />
            </div>
            <div className="flex-[1.5] min-w-[260px]">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5"><Calendar size={12}/> Rango de Fechas</label>
              <div className="flex items-center gap-2 h-[34px] bg-white border border-slate-200 rounded-lg px-2 focus-within:border-codizulca-cyan focus-within:ring-1 focus-within:ring-cyan-200">
                <input type="date" className="bg-transparent text-xs text-slate-600 focus:outline-none w-full min-w-0" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span className="text-slate-300">-</span>
                <input type="date" className="bg-transparent text-xs text-slate-600 focus:outline-none w-full min-w-0" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="flex-none flex gap-2">
              <button 
                onClick={limpiarFiltros}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 h-[34px] rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw size={14} /> Limpiar
              </button>
              <button 
                onClick={ejecutarBusqueda}
                className="bg-codizulca-red hover:bg-red-700 text-white px-4 h-[34px] rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Search size={14} /> Ejecutar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABS & LIST ================= */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-px">
          <div className="flex gap-6">
            {(['PENDIENTES', 'PROCESADOS', 'RECHAZADOS'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
                className={`pb-3 font-bold text-[13px] border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'border-slate-800 text-slate-800' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'PROCESADOS' ? 'Procesados / Listos' : tab.charAt(0) + tab.slice(1).toLowerCase()} 
                <span className="ml-1 opacity-70">
                  ({tab === 'PENDIENTES' ? kpiPendientes : tab === 'PROCESADOS' ? kpiProcesados + kpiFacturacion : kpiRechazados})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mass action bar (Select All / Print) */}
        <div className="flex items-center justify-between border border-slate-200 rounded-lg p-2 bg-white shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer pl-2">
            <input 
              type="checkbox" 
              checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
              onChange={(e) => {
                if (e.target.checked) setSelectedIds(new Set(filteredOrders.map(o => o.id)));
                else setSelectedIds(new Set());
              }}
              className="w-4 h-4 text-codizulca-cyan rounded border-slate-300 focus:ring-codizulca-cyan cursor-pointer"
            />
            Seleccionar Todos ({filteredOrders.length})
          </label>
          <div className="flex gap-2">
            {activeTab === 'PENDIENTES' && selectedIds.size > 0 && (
              <button 
                onClick={handleAprobarLote}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <CheckSquare size={14} /> Aprobar {selectedIds.size}
              </button>
            )}
            <button 
              onClick={() => {
                const toPrint = selectedIds.size > 0 ? filteredOrders.filter(o => selectedIds.has(o.id)) : filteredOrders;
                if (toPrint.length > 0) printMultipleOrders(toPrint, true);
              }}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-300 shadow-sm"
            >
              <FileText size={14} /> Imprimir {selectedIds.size > 0 ? selectedIds.size : 'Todo'} ({selectedIds.size > 0 ? selectedIds.size : filteredOrders.length})
            </button>
          </div>
        </div>

        {/* Cards List */}
        {loading && orders.length === 0 ? (
          <p className="text-slate-500 text-sm">Cargando pedidos...</p>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
            No hay pedidos que coincidan con los filtros en esta bandeja.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(o => {
              const arts = o.order.articulos.filter(a => a.descripcion || a.cantidad_solicitada > 0);
              const isSelected = selectedIds.has(o.id);
              
              return (
                <div key={o.id} className={`bg-white rounded-xl border ${isSelected ? 'border-codizulca-cyan ring-1 ring-cyan-100' : 'border-slate-200'} shadow-sm overflow-hidden transition-all`}>
                  
                  {/* Card Header */}
                  <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelection(o.id)}
                        className="mt-1.5 w-4 h-4 text-codizulca-cyan rounded border-slate-300 focus:ring-codizulca-cyan cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-extrabold text-slate-900 uppercase">{o.order.cliente}</h3>
                          {o.order.id_cliente && (
                            <span className="border border-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">ID: {o.order.id_cliente}</span>
                          )}
                          <span className="bg-red-50 border border-red-100 text-codizulca-red text-[10px] font-bold px-1.5 py-0.5 rounded">Pedido #{o.order.numero_pedido}</span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 font-medium">
                          <span className="text-sm font-extrabold text-slate-900">${(o.order.total_pedido || 0).toFixed(2)}</span>
                          <span>•</span>
                          <span>Fecha: {o.order.fecha}</span>
                          <span>•</span>
                          <span>Artículos: {arts.length}</span>
                          <span>•</span>
                          <span>Vendedor: <strong className="text-slate-800 uppercase">{o.order.ruta || 'N/A'}</strong></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
                        <User size={14} className="text-slate-400" />
                        <span className="font-semibold">Autorizado por Supervisor:</span>
                        <select 
                          className="bg-transparent border-none font-bold text-slate-800 focus:outline-none cursor-pointer"
                          value={o.order.supervisor || ''}
                          onChange={(e) => updateSupervisor(o.id, e.target.value)}
                        >
                          <option value="">Seleccione...</option>
                          <option value="Nelson Finol">Nelson Finol</option>
                          <option value="Ali Perez">Ali Perez</option>
                          <option value="Julio Espina">Julio Espina</option>
                          <option value="Johnatan Soto">Johnatan Soto</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => setViewOrder(o)}
                        className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        <Eye size={14} /> Ver detalles
                      </button>
                    </div>
                  </div>

                  {/* Warning Box (Motivo de espera o rechazo) */}
                  {o.cxcNote && (
                    <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Motivo de espera en CXC</div>
                      <div className="text-xs font-extrabold text-amber-900 uppercase">{o.cxcNote}</div>
                    </div>
                  )}
                  {activeTab === 'RECHAZADOS' && o.rejectReason && (
                    <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Motivo de Rechazo</div>
                      <div className="text-xs font-extrabold text-red-900 uppercase">{o.rejectReason}</div>
                    </div>
                  )}

                  {/* Desglose de Pedido */}
                  <div className="mx-4 mb-4 border border-slate-100 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b border-slate-100">
                      <div className="text-[10px] font-extrabold text-slate-800 uppercase flex items-center gap-1.5 tracking-wider">
                        <FileText size={12} className="text-codizulca-red" /> Desglose de Pedido
                      </div>
                      <div className="text-[10px] font-bold text-slate-600">{arts.length} PRODUCTO(S)</div>
                    </div>
                    <div className="p-4 space-y-2 bg-white">
                      {arts.map((a, i) => (
                        <div key={i} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                          <div className="font-semibold text-slate-700 uppercase">
                            <span className="text-slate-900 font-extrabold mr-1">{a.cantidad_solicitada} {a.unidad_medida}</span>
                            {a.codigo && <span className="text-slate-500 mr-1">[{a.codigo}]</span>}
                            {a.descripcion}
                          </div>
                          <div className="text-slate-500 font-medium">
                            @ ${(Number(a.precio_unitario) || 0).toFixed(2)} <span className="ml-2 font-extrabold text-slate-900">${(Number(a.sub_total) || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Bar for Pending */}
                  {activeTab === 'PENDIENTES' && (
                     <div className="bg-slate-50 border-t border-slate-200 flex flex-col">
                        <div className="p-3 flex justify-end gap-2">
                          <button 
                            onClick={() => toggleNote(o.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors mr-auto"
                          >
                            <FileText size={14} /> {o.cxcNote ? 'Editar Nota' : 'Añadir Nota de Espera'}
                          </button>
                          <button 
                            onClick={() => handleRechazar(o.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors"
                          >
                            <XCircle size={14} /> Rechazar
                          </button>
                          <button 
                            onClick={() => handleAprobar(o.id)}
                            className="flex items-center gap-1.5 px-6 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            <CheckCircle size={14} /> Aprobar Pedido
                          </button>
                        </div>
                        
                        {expandedNoteId === o.id && (
                          <InlineNoteForm
                            initialValue={o.cxcNote}
                            onSave={(note) => handleSaveNoteInline(o.id, note)}
                            onCancel={() => setExpandedNoteId(null)}
                            title="Motivo de espera"
                          />
                        )}

                        {rejectTarget === o.id && (
                          <div className="p-3 pt-0">
                            <InlineRejectForm
                              title="Motivo de rechazo en CXC"
                              quickOptions={['Deuda pendiente', 'Límite de crédito excedido', 'Sin soporte de pago']}
                              onConfirm={confirmRechazo}
                              onCancel={() => setRejectTarget(null)}
                            />
                          </div>
                        )}
                     </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-slate-200">
        <SeguimientoBlock orders={orders} />
      </div>

      {viewOrder && (
        <OrderModal order={viewOrder} onClose={() => setViewOrder(null)} />
      )}
    </div>
  );
};

export default CXC;
