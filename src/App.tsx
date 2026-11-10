import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.js';
import { Login } from './pages/Login.js';
import { useAuthStore } from './store/auth.js';
import { useAppStore } from './store/index.js';
import { supabase } from './lib/supabase.js';
import { Bell } from 'lucide-react';

const Ventas = lazy(() => import('./pages/Ventas.js'));
const CXC = lazy(() => import('./pages/CXC.js').then(m => ({ default: m.CXC })));
const Facturacion = lazy(() => import('./pages/Facturacion.js').then(m => ({ default: m.Facturacion })));
const Auditoria = lazy(() => import('./pages/Auditoria.js').then(m => ({ default: m.Auditoria })));
const Historial = lazy(() => import('./pages/Historial.js').then(m => ({ default: m.Historial })));

// Custom Toast Component
const Toast = ({ message, visible }: { message: string, visible: boolean }) => (
  <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
    <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
      <div className="bg-emerald-500 rounded-full p-1"><Bell size={14} className="text-white" /></div>
      <p className="text-sm font-semibold">{message}</p>
    </div>
  </div>
);

function App() {
  const { user } = useAuthStore();
  const { fetchOrders, subscribeToWaitingRoomRealtime } = useAppStore();
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeoutRef = React.useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 5000);
  };

  useEffect(() => {
    if (!user) return;

    const unsubscribeStoreRealtime = subscribeToWaitingRoomRealtime();

    let fetchTimer: any = null;
    const debouncedFetchOrders = () => {
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(() => {
        fetchOrders();
      }, 600);
    };

    // Supabase Realtime Subscription (Notificaciones de pedidos activos del mes en curso)
    const channel = supabase.channel('realtime_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
         const row = payload.new || {};
         // Ignorar eventos sobre pedidos históricos / archivados
         if (row.is_archived === true || payload.old?.is_archived === true) {
           return;
         }

         const rowId = String(row.id || '').trim().toLowerCase();
         const rowNum = String(row.numero_pedido || row.raw_order?.numero_pedido || '').trim();
         const rowObs = String(row.observaciones || row.raw_order?.observaciones || '').toUpperCase();
         if (
           rowId.startsWith('test-int-') ||
           rowId.startsWith('test-qa-') ||
           rowNum === '9999' ||
           rowObs.includes('OC-TEST-INT') ||
           rowObs.includes('PRUEBA DE INTEGRAC')
         ) {
           // Ignorar y disparar limpieza silenciosa en el backend sin notificar ni mostrar el pedido de prueba
           debouncedFetchOrders();
           return;
         }

         if (payload.eventType === 'INSERT') {
           const cliente = payload.new?.cliente || payload.new?.order_data?.cliente || 'Nuevo Pedido';
           const newStatus = payload.new?.status;
           const orderNum = payload.new?.numero_pedido || payload.new?.order_data?.numero_pedido;
           if (newStatus === 'PENDIENTE_CXC' && !rowId.startsWith('alk-')) {
             showToast(`Nuevo pedido recibido en Cuentas por Cobrar${orderNum ? ` (#${orderNum})` : ''}: ${cliente}`);
           } else {
             showToast(`Nuevo pedido recibido en Sala de Espera: ${cliente}`);
           }
         } else if (payload.eventType === 'UPDATE') {
           const newStatus = payload.new?.status;
           const oldStatus = payload.old?.status;
           const orderNum = payload.new?.numero_pedido || payload.new?.order_data?.numero_pedido || 'SN';
           
           if (newStatus && oldStatus && newStatus !== oldStatus) {
             const labelStatus =
               newStatus === 'PENDIENTE_CXC' ? 'Cuentas por Cobrar' :
               newStatus === 'PENDIENTE_FACTURACION' ? 'Facturación' :
               newStatus === 'COMPLETADO' ? 'Completado' :
               newStatus === 'RECHAZADO' ? 'Rechazado' : newStatus;
             showToast(`El pedido #${orderNum} pasó a ${labelStatus}`);
           }
         }
      })
      .subscribe();

    return () => {
      unsubscribeStoreRealtime();
      if (fetchTimer) clearTimeout(fetchTimer);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders, subscribeToWaitingRoomRealtime]);

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Toast message={toastMsg} visible={toastVisible} />
      <Layout>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Ventas />} />
            <Route path="/cxc" element={<CXC />} />
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="*" element={<Ventas />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  );
}

export default App;
