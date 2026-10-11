import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.js';
import Ventas from './pages/Ventas.js';
import { CXC } from './pages/CXC.js';
import { Facturacion } from './pages/Facturacion.js';
import { Auditoria } from './pages/Auditoria.js';
import { Historial } from './pages/Historial.js';
import { Login } from './pages/Login.js';
import { useAuthStore } from './store/auth.js';
import { useAppStore } from './store/index.js';
import { supabase } from './lib/supabase.js';
import { Bell } from 'lucide-react';

// Custom Toast Component
const Toast = ({ message, visible }: { message: string, visible: boolean }) => (
  <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
    <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
      <div className="bg-emerald-500 rounded-full p-1"><Bell size={14} className="text-white" /></div>
      <p className="text-sm font-semibold">{message}</p>
    </div>
  </div>
);

function App() {
  const { user } = useAuthStore();
  const { fetchOrders } = useAppStore();
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  };

  useEffect(() => {
    if (!user) return;

    // Supabase Realtime Subscription (Escuchar INSERTS y UPDATES en tiempo real)
    const channel = supabase.channel('realtime_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
         if (payload.eventType === 'INSERT') {
           const cliente = payload.new.cliente || 'Nuevo Pedido';
           showToast(`Nuevo pedido recibido en Sala de Espera: ${cliente}`);
           fetchOrders();
         } else if (payload.eventType === 'UPDATE') {
           const newStatus = payload.new.status;
           const oldStatus = payload.old.status;
           const orderNum = payload.new.numero_pedido || 'SN';
           
           if (newStatus !== oldStatus) {
             showToast(`El pedido #${orderNum} pasó a estado ${newStatus}`);
           }
           fetchOrders();
         } else {
           fetchOrders();
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Toast message={toastMsg} visible={toastVisible} />
      <Layout>
        <Routes>
          <Route path="/" element={<Ventas />} />
          <Route path="/cxc" element={<CXC />} />
          <Route path="/facturacion" element={<Facturacion />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="*" element={<Ventas />} />
        </Routes>
      </Layout>
    </>
  );
}

export default App;
