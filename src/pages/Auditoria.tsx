import { apiFetch } from '../utils/api';
import React, { useEffect, useState } from 'react';
import { Database, CalendarDays, Users, Award, TrendingUp, Activity, Layers, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { ProductDashboardModal } from '../components/shared/ProductDashboardModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Line, Cell, PieChart, Pie, LineChart
} from 'recharts';

export const Auditoria: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const fetchAnalytics = async (forceFresh = false) => {
    try {
      if (!data) {
        setLoading(true);
      }
      setError(null);
      const url = forceFresh ? '/api/analytics?fresh=true' : '/api/analytics';
      const res = await apiFetch(url);
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Error del servidor (${res.status}) al cargar estadísticas`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Error de conexión al cargar estadísticas de auditoría');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <Loader2 className="animate-spin text-codizulca-red mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-800">Calculando estadísticas...</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md">
          Analizando registros consolidados desde el servidor. Esto puede tomar un momento.
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-red-50 text-codizulca-red rounded-full flex items-center justify-center mb-4 border border-red-100">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800">No se pudieron cargar las analíticas</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-md bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs text-red-600">
          {error}
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => fetchAnalytics(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-codizulca-red text-white font-bold text-sm rounded-xl hover:bg-red-700 transition shadow-md"
          >
            <RefreshCw size={16} />
            Reintentar Carga
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const {
    kpis, vendorStats, productStats, topByVolumen, topByFrecuencia,
    totalVolumenFisico, totalLineas, statusData, rejectReasonsData, dailyTrendData
  } = data;

  const handleSimularCorte = () => {
    setLoadingAction('corte');
    setTimeout(() => { setLoadingAction(null); alert('Corte Mensual ejecutado correctamente.'); }, 1500);
  };
  const handleSyncData = () => {
    setLoadingAction('sync');
    fetchAnalytics(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Database className="text-codizulca-red" size={28} />
            Dashboard de Auditoría
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Métricas calculadas en tiempo real por el Servidor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSyncData}
            disabled={loadingAction === 'sync'}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition border border-slate-200 disabled:opacity-50"
          >
            {loadingAction === 'sync' ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
            Sincronizar
          </button>
          <button 
            onClick={handleSimularCorte}
            disabled={loadingAction === 'corte'}
            className="flex items-center gap-2 px-5 py-2 bg-codizulca-cyan text-slate-800 font-black text-sm rounded-xl hover:bg-cyan-400 transition shadow-md disabled:opacity-50"
          >
            {loadingAction === 'corte' ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
            Ejecutar Corte Mensual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Layers size={48} /></div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Pedidos Procesados</p>
          <p className="text-3xl font-black text-slate-800">{kpis.kpiTotalManuales}</p>
          <div className="mt-2 flex gap-2 text-[10px] font-bold">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{kpis.kpiFacturados} Facturados</span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">{kpis.kpiRechazados} Rechazados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-codizulca-cyan"><Award size={48} /></div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Monto Total Facturado</p>
          <p className="text-3xl font-black text-slate-800">${kpis.montoFacturado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-2 text-[10px] font-bold text-cyan-600 bg-cyan-50 w-fit px-2 py-0.5 rounded border border-cyan-100">
            Ingreso Bruto Aprobado
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500"><TrendingUp size={48} /></div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Monto en CxC / Pendiente</p>
          <p className="text-3xl font-black text-slate-800">${kpis.montoPendiente.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 w-fit px-2 py-0.5 rounded border border-amber-100">
            En tránsito
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-codizulca-red"><Activity size={48} /></div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Efectividad de Ventas</p>
          <p className="text-3xl font-black text-slate-800">
            {kpis.kpiTotalManuales > 0 ? Math.round(((kpis.kpiTotalManuales - kpis.kpiRechazados) / kpis.kpiTotalManuales) * 100) : 0}%
          </p>
          <div className="mt-2 text-[10px] font-bold text-slate-500">
            Tasa de conversión / aprobación
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase flex items-center gap-2">
            <Users size={16} className="text-codizulca-red" /> Rendimiento de Vendedores (Tabla Líderes)
          </h2>
        </div>
        <div className="p-6">
          <div className="h-[380px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vendorStats.slice(0, 12)} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="vendedor" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} 
                  angle={-25} 
                  textAnchor="end"
                  tickFormatter={(v) => {
                    const words = v.split(' ');
                    return words.length > 2 ? words.slice(0, 2).join(' ') + '...' : v;
                  }}
                />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={(val) => '$' + (val/1000).toFixed(0) + 'k'} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingBottom: '20px' }} />
                
                <Bar yAxisId="left" dataKey="ventas" name="Volumen de Ventas ($)" fill="url(#colorVentas)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                
                <Line yAxisId="right" type="monotone" dataKey="aprob" name="Pedidos Aprob." stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="rech" name="Rechazos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-codizulca-red" /> Frecuencia Diaria de Pedidos
          </h2>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} 
                       tickFormatter={(v) => v.split('-').slice(1).join('/')} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="count" name="Pedidos" stroke="#e30a17" strokeWidth={3} dot={{ r: 4, fill: '#e30a17', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase text-center mb-2">Estado General</h3>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                    {statusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-center text-xs font-bold text-slate-700">
              {Math.round((kpis.kpiFacturados / (kpis.kpiTotalManuales || 1)) * 100)}% Facturados
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">
              <AlertTriangle size={14} className="text-amber-500" /> Top Rechazos
            </h3>
            <div className="space-y-3">
              {rejectReasonsData.length === 0 ? (
                <p className="text-xs text-slate-400">Sin rechazos registrados</p>
              ) : (
                rejectReasonsData.map((r: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span className="truncate pr-2">{r.motivo}</span>
                      <span>{r.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${(r.count / rejectReasonsData[0].count) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase flex items-center gap-2">
            <Layers size={16} className="text-codizulca-red" /> Productos y Frecuencia (Dashboard 360)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Se han movilizado <strong>{totalVolumenFisico.toLocaleString()} unidades/kg</strong> en <strong>{totalLineas.toLocaleString()} líneas</strong> de pedido.
          </p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {topByVolumen && (
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Más Vendido (Volumen)</p>
                <h4 className="font-black text-indigo-900 text-sm truncate">{topByVolumen.desc}</h4>
                <div className="mt-2 flex gap-3 text-xs font-bold text-indigo-700">
                  <span>{topByVolumen.volumen.toLocaleString()} {topByVolumen.unidad}</span>
                  <span>|</span>
                  <span>${topByVolumen.monto.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
              </div>
            )}
            {topByFrecuencia && (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Más Pedido (Frecuencia)</p>
                <h4 className="font-black text-emerald-900 text-sm truncate">{topByFrecuencia.desc}</h4>
                <div className="mt-2 flex gap-3 text-xs font-bold text-emerald-700">
                  <span>{topByFrecuencia.pedidos} pedidos</span>
                  <span>|</span>
                  <span>${topByFrecuencia.monto.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-[380px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productStats} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorVolumen" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorPedidos" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e30a17" stopOpacity={0.7}/>
                    <stop offset="100%" stopColor="#b9000b" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="desc" type="category" width={220} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} 
                       tickFormatter={(v) => v.length > 32 ? v.substring(0, 32) + '...' : v} />
                <RechartsTooltip 
                   cursor={{ fill: '#f8fafc' }} 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} 
                   itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                <Bar dataKey="pedidos" name="Interacciones (Pedidos)" fill="url(#colorPedidos)" radius={[0, 6, 6, 0]} barSize={14} onClick={(data: any) => setSelectedProduct(data.desc)} cursor="pointer" />
                <Bar dataKey="volumen" name="Volumen Solicitado" fill="url(#colorVolumen)" radius={[0, 6, 6, 0]} barSize={14} onClick={(data: any) => setSelectedProduct(data.desc)} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-2 italic">Haz clic sobre cualquier barra para abrir el Dashboard 360 del producto</p>
        </div>
      </div>

      {selectedProduct && (
        <ProductDashboardModal 
          productName={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </div>
  );
};