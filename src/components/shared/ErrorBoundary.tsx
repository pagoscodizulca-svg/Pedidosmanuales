import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      localStorage.removeItem('codizulca_ventas_draft_v1');
      localStorage.removeItem('codizulca_ventas_text_v1');
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
          <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle size={32} />
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-white">Se detectó un error en la aplicación</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
                El sistema protegió tus datos para evitar pérdidas. Puedes reiniciar la vista o restablecer el borrador para continuar.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-left max-h-32 overflow-y-auto font-mono text-[11px] text-red-300">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 bg-codizulca-cyan hover:bg-cyan-400 text-slate-900 font-bold py-2.5 px-4 rounded-xl text-xs transition"
              >
                <RefreshCw size={14} /> Recargar Vista
              </button>
              <button
                onClick={this.handleResetAndReload}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs transition"
              >
                <Trash2 size={14} className="text-red-400" /> Limpiar Borrador y Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
