import React, { useState } from 'react';
import { XCircle } from 'lucide-react';

interface InlineRejectFormProps {
  title: string;
  confirmLabel?: string;
  quickOptions?: string[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Cuadro de texto desplegable (en línea) para indicar el motivo de un rechazo / no facturado. */
export const InlineRejectForm: React.FC<InlineRejectFormProps> = ({
  title,
  confirmLabel = 'Confirmar Rechazo',
  quickOptions = [],
  onConfirm,
  onCancel
}) => {
  const [reason, setReason] = useState('');
  const canConfirm = reason.trim().length > 0;

  return (
    <div className="bg-red-50/60 border border-red-200 rounded-xl p-4 w-full">
      <h3 className="text-red-800 text-xs font-bold flex items-center gap-2 mb-3">
        <XCircle size={14} /> {title}
      </h3>

      {quickOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickOptions.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setReason(prev => (prev ? `${prev}\n${opt}` : opt))}
              className="text-[10px] font-bold text-red-700 bg-white border border-red-200 hover:border-red-400 hover:bg-red-50 px-2.5 py-1 rounded-full transition-colors shadow-sm"
            >
              + {opt}
            </button>
          ))}
        </div>
      )}

      <textarea
        autoFocus
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Escribe el motivo..."
        className="w-full h-20 p-2.5 border border-red-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300 bg-white shadow-inner mb-3 resize-none"
      />

      <div className="flex justify-end items-center gap-3">
        <button onClick={onCancel} className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => canConfirm && onConfirm(reason.trim())}
          disabled={!canConfirm}
          className="px-4 py-1.5 bg-codizulca-red hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};
