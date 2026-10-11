import { apiFetch } from '../utils/api';
import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Lock, User as UserIcon } from 'lucide-react';


export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setIsLoading(false);
        return;
      }

      login(data);
    } catch (err: any) {
      setError('Ocurrió un error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <style>{`
          @keyframes coinSpin {
            0%   { transform: rotateY(0deg); }
            100% { transform: rotateY(360deg); }
          }
          @keyframes coinShadow {
            0%, 100% { transform: scaleX(1);   opacity: .35; }
            25%, 75% { transform: scaleX(.15); opacity: .12; }
            50%      { transform: scaleX(1);   opacity: .35; }
          }
          .coin-stage { perspective: 900px; }
          .coin {
            animation: coinSpin 3.5s linear infinite;
            transform-style: preserve-3d;
            position: relative;
          }
          .coin-face {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          .coin-back {
            transform: rotateY(180deg);
          }
          .coin-shadow { animation: coinShadow 3.5s linear infinite; }
        `}</style>
        <div className="flex flex-col items-center coin-stage">
          <div className="coin w-36 h-36">
            {/* Cara frontal */}
            <div className="coin-face">
              <img
                src="/logo-codizulca.png"
                alt="Codizulca"
                className="w-full h-full object-contain select-none drop-shadow-md"
                draggable={false}
              />
            </div>
            {/* Cara trasera (rotada para mantener la orientación correcta al girar) */}
            <div className="coin-face coin-back">
              <img
                src="/logo-codizulca.png"
                alt="Codizulca"
                className="w-full h-full object-contain select-none drop-shadow-md"
                draggable={false}
              />
            </div>
          </div>
          <div className="coin-shadow w-24 h-2 mt-4 rounded-full bg-slate-900/40 blur-sm" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Codizulca ERP
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Sistema de Pedidos Manuales
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Usuario
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-codizulca-cyan focus:border-codizulca-cyan sm:text-sm transition-colors"
                  placeholder="Ej: Mari01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-codizulca-cyan focus:border-codizulca-cyan sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm font-bold text-center bg-red-50 p-3 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-codizulca-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Conectando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
