import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/index.js';
import { DbOrder } from '../types.js';
import { RotateCcw, Search, User, MapPin, Hash, Calendar, FileText, CheckSquare, Printer, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { SeguimientoBlock } from '../components/shared/SeguimientoBlock';
import { OrderModal } from '../components/shared/OrderModal';
import { InlineNoteForm } from '../components/shared/InlineNoteForm';
import { InlineRejectForm } from '../components/shared/InlineRejectForm';
import { printMultipleOrders } from '../lib/pdfUtils';
import { VENDEDORES } from '../data/vendedores';
import {
  buildGroupedVendedorOptions,
  getZonasForVendedor,
  matchVendedor,
} from '../utils/vendedorFilter';

type Tab = 'POR_FACTURAR' | 'FACTURADOS' | 'RECHAZADOS';

const MOTIVOS_RECHAZO = [
  'Sin stock disponible',
  'Precios a verificar',
  'Pospuesto por cliente',
  'Rechazado por Facturación',
];

// Un pedido rechazado pertenece a Facturación si el último evento de rechazo vino de ese departamento
const rechazadoPorFacturacion = (o: DbOrder) => {
  const history = o.statusHistory || [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === 'RECHAZADO') {
      return history[i].department === 'Facturación';
    }
  }
  return false;
};

const PAGE_SIZE = 30;

export const Facturacion: React.FC = () => {
  const { orders, fetchOrders, updateOrderStatus, updateBatchOrderStatus, loading } = useAppStore();

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<Tab>('POR_FACTURAR');
  const [filterVendedor, setFilterVendedor] = useState('');
  const [filterZona, setFilterZona] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterCorrelativo, setFilterCorrelativo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    vendedor: '', zona: '', cliente: '', correlativo: '', dateFrom: '', dateTo: ''
  });

  // Selection & Modals & Loading
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewOrder, setViewOrder] = useState<DbOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [showSeguimiento, setShowSeguimiento] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // KPIs calculados en una sola pasada eficiente (O(N)) memoizada
  const { kpiPorFacturar, kpiFacturados, kpiRechazados } = useMemo(() => {
    let porFacturar = 0;
    let facturados = 0;
    let rechazados = 0;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (o.isArchived) continue;
      if (o.status === 'PENDIENTE_FACTURACION') porFacturar++;
      else if (o.status === 'COMPLETADO') facturados++;
      else if (o.status === 'RECHAZADO' && rechazadoPorFacturacion(o)) rechazados++;
    }

    return { kpiPorFacturar: porFacturar, kpiFacturados: facturados, kpiRechazados: rechazados };
  }, [orders]);

  // Opciones dinámicas agrupadas de vendedores (catálogo base + columna `ruta` de Supabase)
  const vendedorOptions = useMemo(
    () => buildGroupedVendedorOptions(orders, Object.keys(VENDEDORES)),
    [orders],
  );

  // Zonas puntuales asociadas al vendedor seleccionado mediante coincidencia inteligente
  const zonasDisponibles = useMemo(
    () => getZonasForVendedor(filterVendedor, VENDEDORES),
    [filterVendedor],
  );

  const ejecutarBusqueda = () => {
    setDisplayCount(PAGE_SIZE);
    setAppliedFilters({ vendedor: filterVendedor, zona: filterZona, cliente: filterCliente, correlativo: filterCorrelativo, dateFrom, dateTo });
  };

  const limpiarFiltros = () => {
    setFilterVendedor('');
    setFilterZona('');
    setFilterCliente('');
    setFilterCorrelativo('');
    setDateFrom('');
    setDateTo('');
    setDisplayCount(PAGE_SIZE);
    setAppliedFilters({ vendedor: '', zona: '', cliente: '', correlativo: '', dateFrom: '', dateTo: '' });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.isArchived) return false;

      if (activeTab === 'POR_FACTURAR' && o.status !== 'PENDIENTE_FACTURACION') return false;
      if (activeTab === 'FACTURADOS' && o.status !== 'COMPLETADO') return false;
      if (activeTab === 'RECHAZADOS' && !(o.status === 'RECHAZADO' && rechazadoPorFacturacion(o))) return false;

      const ord = o.order || ({} as any);

      // Coincidencia inteligente bidireccional sobre la columna `ruta` (con respaldo `vendedor`)
      if (appliedFilters.vendedor && !matchVendedor(ord.ruta || ord.vendedor, appliedFilters.vendedor)) {
        return false;
      }
      
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

      if (appliedFilters.dateFrom && (ord.fecha || '') < appliedFilters.dateFrom) return false;
      if (appliedFilters.dateTo && (ord.fecha || '') > appliedFilters.dateTo) return false;

      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, activeTab, appliedFilters]);

  // Lista visible recortada a displayCount para renderizado instantáneo
  const visibleOrders = useMemo(() => {
    return filteredOrders.slice(0, displayCount);
  }, [filteredOrders, displayCount]);

  // Actions con respuesta visual inmediata
  const handleFacturar = async (id: string) => {
    setProcessingId(id);
    try {
      await updateOrderStatus(id, 'COMPLETADO');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDesmarcar = async (id: string) => {
    if (confirm('¿Deshacer y devolver el pedido a POR FACTURAR?')) {
      setProcessingId(id);
      try {
        await updateOrderStatus(id, 'PENDIENTE_FACTURACION');
      } finally {
        setProcessingId(null);
      }
    }
  };

  const openReject = (id: string) => {
    setExpandedNoteId(null);
    setRejectTarget(prev => (prev === id ? null : id));
  };

  const confirmReject = async (reason: string) => {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget);
    try {
      await updateOrderStatus(rejectTarget, 'RECHAZADO', undefined, undefined, reason, 'Facturación');
    } finally {
      setProcessingId(null);
      setRejectTarget(null);
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
      await updateOrderStatus(id, order.status, order.cxcNote, note, order.rejectReason);
    }
    setExpandedNoteId(null);
  };

  const handleFacturarLote = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`¿Facturar ${selectedIds.size} pedidos seleccionados?`)) {
      setBatchProcessing(true);
      try {
        await updateBatchOrderStatus(Array.from(selectedIds), 'COMPLETADO', 'Facturación');
        setSelectedIds(new Set());
      } finally {
        setBatchProcessing(false);
      }
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const tabLabel = (tab: Tab) =>
    tab === 'POR_FACTURAR' ? `Por Facturar (${kpiPorFacturar})`
    : tab === 'FACTURADOS' ? `Facturados / Listos (${kpiFacturados})`
    : `Rechazados (${kpiRechazados})`;

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 h-[34px] text-xs focus:outline-none focus:border-codizulca-cyan focus:ring-1 focus:ring-cyan-200';
  const labelCls = 'flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ================= HEADER & KPIs ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-wide mb-6">Panel de Facturación</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl p-4 text-white shadow-md relative overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Por Facturar</div>
            <div className="text-4xl font-extrabold">{kpiPorFacturar}</div>
            <div className="text-[10px] font-bold text-codizulca-red mt-2">Hoja: CXC</div>
            <div className="absolute -right-4 -bottom-4 opacity-10"><FileText size={80} /></div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-1">Facturados</div>
            <div className="text-4xl font-extrabold text-slate-800">{kpiFacturados}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-2">Hoja: Facturación</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">Rechazados</div>
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
              <label className={labelCls}><User size={12} /> Filtrar por Vendedor</label>
              <select 
                className={`${inputCls} bg-white`}
                value={filterVendedor} 
                onChange={e => {
                  const nextVendedor = e.target.value;
                  setFilterVendedor(nextVendedor);
                  setFilterZona('');
                  setDisplayCount(PAGE_SIZE);
                  setAppliedFilters(prev => ({ ...prev, vendedor: nextVendedor, zona: '' }));
                }}
              >
                <option value="">Todos los vendedores</option>
                {vendedorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className={labelCls}><MapPin size={12} /> Filtrar por Zona Puntual</label>
              <select 
                className={`${inputCls} bg-white disabled:bg-slate-50 disabled:text-slate-400`}
                value={filterZona} 
                onChange={e => {
                  const nextZona = e.target.value;
                  setFilterZona(nextZona);
                  setDisplayCount(PAGE_SIZE);
                  setAppliedFilters(prev => ({ ...prev, zona: nextZona }));
                }}
                disabled={!filterVendedor || zonasDisponibles.length === 0}
              >
                <option value="">{filterVendedor && zonasDisponibles.length > 0 ? 'Selecciona una zona...' : 'Sin zonas configuradas'}</option>
                {filterVendedor && zonasDisponibles.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className={labelCls}><Hash size={12} /> Filtrar por Código / Cliente</label>
              <input type="text" placeholder="Ej: 5663 o FARMAPLUS.." className={inputCls} value={filterCliente} onChange={e => setFilterCliente(e.target.value)} onKeyDown={e => e.key === 'Enter' && ejecutarBusqueda()} />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className={labelCls}><FileText size={12} /> Filtrar por Correlativo(s)</label>
              <input type="text" placeholder="Nº Correlativo(s)" className={inputCls} value={filterCorrelativo} onChange={e => setFilterCorrelativo(e.target.value)} onKeyDown={e => e.key === 'Enter' && ejecutarBusqueda()} />
            </div>
            <div className="flex-[1.5] min-w-[260px]">
              <label className={labelCls}><Calendar size={12} className="text-codizulca-red" /> Rango de Fechas</label>
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

        {/* ================= TABS ================= */}
        <div className="mt-6 bg-slate-50 rounded-xl p-1.5 flex gap-1 w-full">
          {(['POR_FACTURAR', 'FACTURADOS', 'RECHAZADOS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setDisplayCount(PAGE_SIZE); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      {/* ================= LIST ================= */}
      <div className="space-y-4">
        {/* Mass action bar */}
        <div className="flex items-center justify-between border border-slate-200 rounded-xl p-2 bg-white shadow-sm">
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
            {activeTab === 'POR_FACTURAR' && selectedIds.size > 0 && (
              <button
                onClick={handleFacturarLote}
                disabled={batchProcessing}
                className="flex items-center gap-2 bg-codizulca-cyan hover:bg-cyan-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                {batchProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Facturando...
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} /> Facturar Lote ({selectedIds.size})
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => {
                const toPrint = selectedIds.size > 0 ? filteredOrders.filter(o => selectedIds.has(o.id)) : filteredOrders;
                if (toPrint.length > 0) printMultipleOrders(toPrint, true);
              }}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-300 shadow-sm"
            >
              <Printer size={14} /> {selectedIds.size > 0 ? `Imprimir Selección (${selectedIds.size})` : `Imprimir Todo (${filteredOrders.length})`}
            </button>
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <p className="text-slate-500 text-sm">Cargando pedidos...</p>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
            No hay pedidos que coincidan con los filtros en esta bandeja.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleOrders.map(o => {
              const arts = (o.order?.articulos || []).filter(a => a?.descripcion || Number(a?.cantidad_solicitada) > 0);
              const isSelected = selectedIds.has(o.id);
              const isProcessing = processingId === o.id;

              return (
                <div key={o.id} className={`bg-white rounded-xl border ${isSelected ? 'border-codizulca-cyan ring-1 ring-cyan-100' : 'border-slate-200'} shadow-sm overflow-hidden transition-all p-4`}>
                  {/* Card Header & Actions Row */}
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4">
                    {/* Left: Info */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(o.id)}
                        className="mt-1.5 w-4 h-4 text-codizulca-cyan rounded border-slate-300 focus:ring-codizulca-cyan cursor-pointer"
                      />
                      <div>
                        {/* Top Row: Name & Tags */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-lg font-extrabold text-slate-900 uppercase">{o.order?.cliente || 'SIN CLIENTE'}</h3>
                          {o.order?.id_cliente && (
                            <span className="bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">ID: {o.order.id_cliente}</span>
                          )}
                          <span className="bg-red-50 border border-red-100 text-codizulca-red text-[10px] font-bold px-1.5 py-0.5 rounded">Pedido #{o.order?.numero_pedido || '-'}</span>
                          <span className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {activeTab === 'POR_FACTURAR' ? 'Por Facturar' : activeTab === 'FACTURADOS' ? 'Facturado' : 'Rechazado'}
                          </span>
                        </div>
                        {/* Second Row: Stats */}
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 font-medium mb-1">
                          <span className="text-sm font-extrabold text-slate-900">${Number(o.order?.total_pedido || 0).toFixed(2)}</span>
                          <span>•</span>
                          <span>Fecha: {o.order?.fecha || '-'}</span>
                          <span>•</span>
                          <span>Artículos: {arts.length}</span>
                          <span>•</span>
                        </div>
                        {/* Third Row: Vendedor */}
                        <div className="text-xs text-slate-800 font-extrabold uppercase">
                          Vendedor: {o.order?.ruta || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 self-start xl:self-center ml-7 xl:ml-0">
                      <button
                        onClick={() => setViewOrder(o)}
                        className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                      >
                        Ver detalles
                      </button>
                      
                      {activeTab === 'POR_FACTURAR' && (
                        <>
                          <button
                            onClick={() => openReject(o.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-4 py-1.5 border border-codizulca-red text-codizulca-red hover:bg-red-50 rounded-lg text-[11px] font-bold transition-colors shadow-sm disabled:opacity-50"
                          >
                            <X size={12} /> No facturado
                          </button>
                          <button
                            onClick={() => handleFacturar(o.id)}
                            disabled={isProcessing}
                            className="px-5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 size={12} className="animate-spin" /> Facturando...
                              </>
                            ) : (
                              'Facturado'
                            )}
                          </button>
                        </>
                      )}

                      {activeTab === 'FACTURADOS' && (
                        <button
                          onClick={() => handleDesmarcar(o.id)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-4 py-1.5 border border-orange-300 text-orange-600 hover:bg-orange-50 rounded-lg text-[11px] font-bold transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Deshacer
                        </button>
                      )}

                      {activeTab !== 'RECHAZADOS' && (
                        <button
                          onClick={() => toggleNote(o.id)}
                          className="flex items-center gap-1.5 px-4 py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                        >
                          <FileText size={12} /> Agregar nota
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedNoteId === o.id && (
                    <div className="ml-7 mb-3">
                      <InlineNoteForm
                        initialValue={o.factNote}
                        onSave={(note) => handleSaveNoteInline(o.id, note)}
                        onCancel={() => setExpandedNoteId(null)}
                        title="Motivo de espera"
                      />
                    </div>
                  )}

                  {rejectTarget === o.id && (
                    <div className="ml-7 mb-3">
                      <InlineRejectForm
                        title="Motivo por el cual no se factura el pedido"
                        confirmLabel="Confirmar No Facturado"
                        quickOptions={MOTIVOS_RECHAZO}
                        onConfirm={confirmReject}
                        onCancel={() => setRejectTarget(null)}
                      />
                    </div>
                  )}

                  {/* Notas */}
                  {o.cxcNote && (
                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 ml-7">
                      <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Motivo de espera en CXC</div>
                      <div className="text-xs font-extrabold text-amber-900 uppercase">{o.cxcNote}</div>
                    </div>
                  )}
                  {o.factNote && (
                    <div className="mb-3 bg-cyan-50 border border-cyan-200 rounded-lg p-3 ml-7">
                      <div className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1">Nota de Facturación</div>
                      <div className="text-xs font-extrabold text-cyan-900 uppercase">{o.factNote}</div>
                    </div>
                  )}
                  {activeTab === 'RECHAZADOS' && o.rejectReason && (
                    <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 ml-7">
                      <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Motivo de Rechazo</div>
                      <div className="text-xs font-extrabold text-red-900 uppercase">{o.rejectReason}</div>
                    </div>
                  )}

                  {/* Desglose */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden ml-7">
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
                </div>
              );
            })}

            {filteredOrders.length > displayCount && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-xs">
                <span className="text-slate-500 font-medium">
                  Mostrando <strong className="text-slate-800">{visibleOrders.length}</strong> de <strong className="text-slate-800">{filteredOrders.length}</strong> pedidos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition"
                  >
                    Cargar 30 más
                  </button>
                  <button
                    onClick={() => setDisplayCount(filteredOrders.length)}
                    className="px-4 py-2 bg-codizulca-cyan hover:bg-cyan-500 text-slate-900 font-bold rounded-lg transition"
                  >
                    Mostrar todos ({filteredOrders.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Seguimiento Global y Auditoría de Estados
            </h3>
            <p className="text-xs text-slate-500">Consulta el estatus detallado de todos los pedidos en tiempo real.</p>
          </div>
          <button
            onClick={() => setShowSeguimiento(prev => !prev)}
            className="text-xs font-bold px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-700 shadow-sm transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
          >
            {showSeguimiento ? (
              <>
                <ChevronUp size={14} /> Ocultar Seguimiento Global
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Mostrar Seguimiento Global
              </>
            )}
          </button>
        </div>
        {showSeguimiento && <SeguimientoBlock orders={orders} />}
      </div>

      {viewOrder && <OrderModal order={viewOrder} onClose={() => setViewOrder(null)} />}
    </div>
  );
};

export default Facturacion;
