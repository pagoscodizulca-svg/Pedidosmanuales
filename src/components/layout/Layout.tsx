import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, DollarSign, FileText, Activity, Archive } from 'lucide-react';
import { useAppStore } from '../../store/index';
import { useAuthStore } from '../../store/auth';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { orders } = useAppStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const { kpiPendienteCXC, kpiPendienteFact } = useMemo(() => {
    let cxc = 0;
    let fact = 0;
    for (const o of orders) {
      if (o.isArchived) continue;
      if (o.status === 'PENDIENTE_CXC') cxc++;
      else if (o.status === 'PENDIENTE_FACTURACION') fact++;
    }
    return { kpiPendienteCXC: cxc, kpiPendienteFact: fact };
  }, [orders]);

    const allNavItems = [
    { path: '/', label: 'Ventas', icon: <ShoppingCart size={20} />, roles: ['ventas', 'master', 'gerencia'] },
    { path: '/cxc', label: 'Cuentas por Cobrar', icon: <DollarSign size={20} />, badge: kpiPendienteCXC, roles: ['cxc', 'master', 'gerencia'] },
    { path: '/facturacion', label: 'Facturacion', icon: <FileText size={20} />, badge: kpiPendienteFact, roles: ['facturacion', 'master', 'gerencia'] },
    { path: '/auditoria', label: 'Auditoria', icon: <Activity size={20} />, roles: ['master', 'gerencia'] },
    { path: '/historial', label: 'Historial', icon: <Archive size={20} />, roles: ['ventas', 'cxc', 'facturacion', 'master', 'gerencia'] },
  ];

  const navItems = allNavItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded bg-codizulca-red flex items-center justify-center text-sm">CO</span>
            Codizulca ERP
          </h2>
        </div>
        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/ventas'); // simplistic
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center justify-between px-6 py-3 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-slate-800 text-white border-l-4 border-codizulca-red' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-codizulca-red text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <div className="bg-slate-800/50 p-3 rounded-xl">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Usuario Activo</div>
            <div className="text-sm font-bold text-white flex items-center justify-between">
              {user?.username}
              <button onClick={logout} className="text-xs text-red-400 hover:text-red-300 underline font-normal">Salir</button>
            </div>
            <div className="text-[11px] text-slate-400 uppercase mt-0.5">{user?.role}</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <header className="bg-white h-16 border-b border-slate-200 flex items-center px-8 shadow-sm">
           <h3 className="font-semibold text-slate-700">
              {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
           </h3>
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
