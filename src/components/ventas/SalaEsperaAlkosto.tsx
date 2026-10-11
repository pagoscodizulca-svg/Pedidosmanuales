import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/index';
import { Clock, Eye, Smartphone, Search, CheckCircle2, Building2, Store, ShoppingBag } from 'lucide-react';
import { OrderModal } from '../shared/OrderModal';
import { DbOrder } from '../../types';

export const SalaEsperaAlkosto: React.FC = () => {
  const { orders, updateFullOrder } = useAppStore();
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);
  const [selectedChain, setSelectedChain] = useState<'TODAS' | 'ALKOSTO' | 'FAMILIA'>('TODAS');
  const [search, setSearch] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Filtramos todos los pedidos pendientes de la sala de espera
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'POR_VALIDAR');
  }, [orders]);

  // Clasificación por cadenas
  const alkostoOrders = useMemo(() => {
    return pendingOrders.filter(o => (o.order.cliente || '').toUpperCase().includes('ALKOSTO'));
  }, [pendingOrders]);

  const familiaOrders = useMemo(() => {
    return pendingOrders.filter(o => (o.order.cliente || '').toUpperCase().includes('FAMILIA'));
  }, [pendingOrders]);

  const otrasOrders = useMemo(() => {
    return pendingOrders.filter(o => {
      const name = (o.order.cliente || '').toUpperCase();
      return !name.includes('ALKOSTO') && !name.includes('FAMILIA');
    });
  }, [pendingOrders]);

  // Totales acumulados
  const totalMontoAlkosto = useMemo(() => {
    return alkostoOrders.reduce((sum, o) => sum + (o.order.total_pedido || 0), 0);
  }, [alkostoOrders]);

  const totalMontoFamilia = useMemo(() => {
    return familiaOrders.reduce((sum, o) => sum + (o.order.total_pedido || 0), 0);
  }, [familiaOrders]);

  const totalMontoGeneral = useMemo(() => {
    return pendingOrders.reduce((sum, o) => sum + (o.order.total_pedido || 0), 0);
  }, [pendingOrders]);

  // Filtrado según la pestaña activa y el buscador
  const filteredOrders = useMemo(() => {
    let list = pendingOrders;
    if (selectedChain === 'ALKOSTO') list = alkostoOrders;
    if (selectedChain === 'FAMILIA') list = familiaOrders;

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(o => 
        (o.order.cliente || '').toLowerCase().includes(term) ||
        (o.order.id_cliente || '').toLowerCase().includes(term) ||
        (o.order.ruta || '').toLowerCase().includes(term) ||
        (o.order.observaciones || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [pendingOrders, selectedChain, alkostoOrders, familiaOrders, search]);

  const getChainBadge = (clienteName: string) => {
    const norm = (clienteName || '').toUpperCase();
    if (norm.includes('ALKOSTO')) {
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
          <Store size={11} className="text-red-600" /> ALKOSTO
        </span>
      );
    }
    if (norm.includes('FAMILIA')) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
          <Building2 size={11} className="text-emerald-600" /> FAMILIA CENTER
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
        <ShoppingBag size={11} /> APP FDV
      </span>
    );
  };

  const handleQuickApprove = async (order: DbOrder) => {
    if (!window.confirm(`¿Aprobar pedido de "${order.order.cliente}" y enviarlo directamente a Cuentas por Cobrar?`)) {
      return;
    }
    setApprovingId(order.id);
    try {
      await updateFullOrder(order.id, order.order, 'PENDIENTE_CXC');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
            <Smartphone className="text-codizulca-red" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                Sala de Espera - Cadenas Comerciales
              </h2>
              <span className="bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                App FDV
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Recepción y validación de órdenes de compra (Alkosto y Familia Center) emitidas por los vendedores
            </p>
          </div>
        </div>

        {/* Resumen Global */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Monto en Espera</p>
            <p className="text-sm font-black text-slate-800">${totalMontoGeneral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="flex items-center justify-center bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs h-10 px-4 rounded-xl shadow-sm">
            {pendingOrders.length} {pendingOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
          </div>
        </div>
      </div>

      {/* Pestañas de Cadenas y Buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4 mb-5">
        {/* Tabs de Filtro */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button
            onClick={() => setSelectedChain('TODAS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'TODAS'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todas ({pendingOrders.length})
          </button>
          <button
            onClick={() => setSelectedChain('ALKOSTO')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'ALKOSTO'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-red-600'
            }`}
          >
            <span>Alkosto</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedChain === 'ALKOSTO' ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {alkostoOrders.length}
            </span>
          </button>
          <button
            onClick={() => setSelectedChain('FAMILIA')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedChain === 'FAMILIA'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-emerald-600'
            }`}
          >
            <span>Familia Center</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedChain === 'FAMILIA' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {familiaOrders.length}
            </span>
          </button>
        </div>

        {/* Buscador de Sucursal / Tienda */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sucursal, ID o vendedor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-codizulca-cyan focus:bg-white transition-all"
          />
        </div>
      </div>
      
      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <Clock className="text-slate-300 mb-3" size={36} />
          <p className="text-slate-700 font-extrabold text-sm uppercase tracking-wide">
            {pendingOrders.length === 0 ? 'Bandeja al día' : 'No hay pedidos con este filtro'}
          </p>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            {pendingOrders.length === 0 
              ? 'Todos los pedidos de las cadenas Alkosto y Familia Center han sido procesados y enviados a Cuentas por Cobrar.' 
              : 'Intenta cambiar de pestaña o limpiar el cuadro de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(o => {
            const itemCount = Array.isArray(o.order.articulos) ? o.order.articulos.filter(a => a.descripcion).length : 0;
            const isApproving = approvingId === o.id;

            return (
              <div 
                key={o.id} 
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Encabezado Tarjeta */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {getChainBadge(o.order.cliente)}
                        {o.order.id_cliente && (
                          <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                            ID: {o.order.id_cliente}
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight line-clamp-2" title={o.order.cliente}>
                        {o.order.cliente}
                      </h3>
                    </div>
                    <span className="shrink-0 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                      POR VALIDAR
                    </span>
                  </div>

                  {/* Datos Operativos */}
                  <div className="space-y-1 text-xs text-slate-500 mb-4 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Vendedor:</span>
                      <span className="font-bold text-slate-700 truncate max-w-[150px]">{o.order.ruta || 'SAIRU VALLES'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Artículos:</span>
                      <span className="font-bold text-slate-700">{itemCount} {itemCount === 1 ? 'renglón' : 'renglones'}</span>
                    </div>
                    {o.order.observaciones && (
                      <div className="text-[11px] text-slate-500 italic truncate pt-1 border-t border-slate-200/60" title={o.order.observaciones}>
                        "{o.order.observaciones}"
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Footer Tarjeta: Monto y Botones */}
                <div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monto Pedido</span>
                    <span className="text-lg font-black text-slate-900">${(o.order.total_pedido || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedOrder(o)}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-extrabold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      <Eye size={14} /> Validar Formato
                    </button>
                    <button
                      onClick={() => handleQuickApprove(o)}
                      disabled={isApproving}
                      className="flex items-center justify-center gap-1.5 bg-codizulca-cyan text-slate-800 py-2.5 rounded-xl text-xs font-black hover:bg-cyan-400 hover:shadow-sm transition-all border border-cyan-300 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} className="text-slate-800" />
                      {isApproving ? 'Aprobando...' : 'Aprobar a CxC'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
};
