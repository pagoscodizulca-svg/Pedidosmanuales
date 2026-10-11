import { apiFetch } from '../../utils/api';
import React, { useEffect, useState } from 'react';
import { X, Package, Users, FileText, XOctagon, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProductDashboardModalProps {
  productName: string;
  onClose: () => void;
}

export const ProductDashboardModal: React.FC<ProductDashboardModalProps> = ({ productName, onClose }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/analytics/product?desc=${encodeURIComponent(productName)}`);
        if (!res.ok) throw new Error('Error al cargar datos');
        const json = await res.json();
        setStats(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [productName]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
          <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">Interacciones/Pedidos:</span> {data.pedidos}</p>
          <p className="text-xs text-emerald-600"><span className="font-semibold">Precio Negociado (Promedio):</span> \${data.precioPromedio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 flex justify-between items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <Package size={120} className="-mt-4 -mr-4 text-white" />
          </div>
          <div className="relative z-10">
            <div className="text-cyan-400 text-xs font-black tracking-widest uppercase mb-1">Dashboard 360° del Producto</div>
            <h2 className="text-2xl font-black text-white">{productName}</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors relative z-10"
          >
            <X size={28} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          {loading || !stats ? (
             <div className="flex flex-col items-center justify-center h-48">
               <Loader2 className="animate-spin text-codizulca-red mb-4" size={32} />
               <p className="text-slate-500 font-bold">Cargando 360...</p>
             </div>
          ) : (
             <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                    <div className="bg-cyan-100 p-3 rounded-full text-cyan-600">
                      <Package size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase">Pedidos</div>
                      <div className="text-2xl font-black text-slate-800">{stats.countPedidos}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                      <FileText size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase">Unidades Solicitadas</div>
                      <div className="text-2xl font-black text-slate-800">{stats.totalVendidos.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                      <Users size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase">Facturados</div>
                      <div className="text-2xl font-black text-slate-800">{stats.countFacturados}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-full text-red-600">
                      <XOctagon size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase">Rechazos</div>
                      <div className="text-2xl font-black text-slate-800">{stats.countRechazados}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase">Top 10 Vendedores</h3>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                      Pasa el mouse para ver precio negociado
                    </span>
                  </div>
                  <div className="p-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.sellersData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} angle={-15} textAnchor="end" />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="pedidos" name="Interacciones / Pedidos" radius={[4, 4, 0, 0]} maxBarSize={60}>
                          {stats.sellersData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index < 3 ? '#0ea5e9' : '#64748b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
             </>
          )}
        </div>
      </div>
    </div>
  );
};
