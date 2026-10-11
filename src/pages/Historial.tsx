import React, { useEffect } from 'react';
import { useAppStore } from '../store/index';
import { SeguimientoBlock } from '../components/shared/SeguimientoBlock';
import { Archive } from 'lucide-react';

export const Historial: React.FC = () => {
  const { historyOrders, fetchHistory, loading } = useAppStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-md flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-wide flex items-center gap-2">
            <Archive size={24} className="text-codizulca-red" /> 
            Historial de Meses Anteriores
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visualización de solo lectura de los pedidos de meses pasados (archivados automáticamente).
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold">{historyOrders.length}</div>
          <div className="text-[10px] uppercase text-slate-400 tracking-wider font-bold">Pedidos Históricos</div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Cargando historial...</div>
      ) : (
        <SeguimientoBlock orders={historyOrders} hideTitle={true} />
      )}
    </div>
  );
};
