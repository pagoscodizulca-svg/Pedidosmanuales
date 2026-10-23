import React, { useState } from 'react';
import { PenLine } from 'lucide-react';

export const QUICK_NOTE_OPTIONS = [
  'A la espera de aprobación por supervisor',
  'Pendiente por soporte de pago',
  'En revisión por límite de crédito'
];

interface InlineNoteFormProps {
  initialValue?: string;
  onSave: (note: string) => void;
  onCancel: () => void;
  title: string;
  quickOptions?: string[];
}

export const InlineNoteForm: React.FC<InlineNoteFormProps> = ({
  initialValue = '',
  onSave,
  onCancel,
  title,
  quickOptions = QUICK_NOTE_OPTIONS
}) => {
  const [note, setNote] = useState(initialValue);

  return (
    <div className="bg-[#FFFAF0] border-t border-amber-200 p-4 w-full">
      <h3 className="text-amber-900 text-xs font-bold flex items-center gap-2 mb-3">
        <PenLine size={14} className="text-amber-700" /> {title}
      </h3>

      {quickOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setNote(prev => (prev ? `${prev}\n${opt}` : opt))}
              className="text-[10px] font-bold text-amber-700 bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50 px-2 py-1 rounded-full transition-colors shadow-sm"
            >
              + {opt}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Escribe el motivo..."
        className="w-full h-20 p-2.5 border border-amber-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white shadow-inner mb-3 resize-none"
      />

      <div className="flex justify-end items-center gap-3">
        <button
          onClick={onCancel}
          className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(note)}
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
        >
          Guardar Nota
        </button>
      </div>
    </div>
  );
};
