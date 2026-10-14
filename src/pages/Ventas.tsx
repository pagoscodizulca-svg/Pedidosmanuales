import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, ArrowRight, Pencil, History, Settings, FileText, Save, ClipboardList, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { PlanillaForm, padRows, isRowEmpty, calcTotal } from '../components/ventas/PlanillaForm';
import { SeguimientoBlock } from '../components/shared/SeguimientoBlock';
import { SalaEsperaAlkosto } from '../components/ventas/SalaEsperaAlkosto';
import { useAppStore } from '../store/index';
import type { DbOrder, OrderData } from '../types';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

const EJEMPLO = `Para el cliente CLIENTE MOSTRADOR ruta MARIANA
Supervisor: PEDRO PEREZ
200 kg [629] MUSLO CUADRIL DESPRESADO a 2.5
10 cajas [1360] PATATAS FRESCAS MARQUISE 4X2.5 a 28
Observaciones: entregar en horas de la mañana`;

const newDraft = (): OrderData => ({
  cliente: '',
  id_cliente: '',
  ruta: '',
  supervisor: '',
  chofer: '',
  observaciones: '',
  fecha: today(),
  total_pedido: 0,
  monto_pedido: 0,
  articulos: padRows([]),
});

type Notice = { type: 'ok' | 'error'; text: string } | null;

export const Ventas: React.FC = () => {
  const [text, setText] = useState(() => {
    return localStorage.getItem('codizulca_ventas_text_v1') || '';
  });

  const [draft, setDraft] = useState<OrderData | null>(() => {
    try {
      const saved = localStorage.getItem('codizulca_ventas_draft_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...newDraft(),
            ...parsed,
            articulos: padRows(parsed.articulos || []),
          };
        }
      }
    } catch {}
    return null;
  });

  const [hasRestoredDraft, setHasRestoredDraft] = useState(() => {
    return !!localStorage.getItem('codizulca_ventas_draft_v1');
  });

  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const orders = useAppStore((s) => s.orders);
  const fetchOrders = useAppStore((s) => s.fetchOrders);
  const parseOrderWithAI = useAppStore((s) => s.parseOrderWithAI);
  const createOrder = useAppStore((s) => s.createOrder);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Guardado automático continuo del borrador en localStorage
  useEffect(() => {
    if (draft) {
      localStorage.setItem('codizulca_ventas_draft_v1', JSON.stringify(draft));
    } else {
      localStorage.removeItem('codizulca_ventas_draft_v1');
      setHasRestoredDraft(false);
    }
  }, [draft]);

  // Guardado automático del texto de WhatsApp en localStorage
  useEffect(() => {
    if (text) {
      localStorage.setItem('codizulca_ventas_text_v1', text);
    } else {
      localStorage.removeItem('codizulca_ventas_text_v1');
    }
  }, [text]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const nextNumero = useMemo(() => {
    const max = orders.reduce((m, o) => Math.max(m, parseInt(String(o?.order?.numero_pedido || '0'), 10) || 0), 0);
    return String(max + 1).padStart(5, '0');
  }, [orders]);

  const recientes = useMemo(
    () =>
      [...orders]
        .filter((o) => !o.isArchived)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
    [orders],
  );

  const handleNuevo = () => {
    setText('');
    setDraft(null);
    localStorage.removeItem('codizulca_ventas_draft_v1');
    localStorage.removeItem('codizulca_ventas_text_v1');
    setHasRestoredDraft(false);
  };

  const handleExtract = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const data = await parseOrderWithAI(text);
      setDraft({
        ...newDraft(),
        ...data,
        numero_pedido: undefined,
        cliente: (data.cliente || '').toUpperCase(),
        fecha: data.fecha || today(),
        articulos: padRows(data.articulos || []),
      });
    } catch {
      setNotice({ type: 'error', text: 'No se pudo procesar el pedido. Intente nuevamente o llénelo manualmente.' });
    } finally {
      setParsing(false);
    }
  };

  const handleManual = () => {
    if (!draft) setDraft(newDraft());
  };

  /** Carga un pedido del historial como base para un nuevo pedido (duplicar). */
  const handleLoadFromHistory = (o: DbOrder) => {
    const ord = o.order || ({} as any);
    setDraft({
      ...newDraft(),
      ...ord,
      numero_pedido: undefined,
      fecha: today(),
      articulos: padRows(ord.articulos || []),
    });
  };

  const handleSend = async () => {
    if (!draft) return;
    const articulos = draft.articulos.filter((a) => !isRowEmpty(a));
    if (!draft.cliente.trim()) {
      setNotice({ type: 'error', text: 'Debe indicar el cliente antes de enviar.' });
      return;
    }
    if (articulos.length === 0) {
      setNotice({ type: 'error', text: 'El pedido debe tener al menos un artículo.' });
      return;
    }
    setSending(true);
    try {
      const total = calcTotal(articulos);
      const created = await createOrder({ ...draft, articulos, total_pedido: total, monto_pedido: total });
      setNotice({ type: 'ok', text: `Pedido #${created.order.numero_pedido} enviado a Cuentas por Cobrar.` });
      setDraft(null);
      setText('');
      localStorage.removeItem('codizulca_ventas_draft_v1');
      localStorage.removeItem('codizulca_ventas_text_v1');
      setHasRestoredDraft(false);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al guardar el pedido.' });
    } finally {
      setSending(false);
    }
  };

  const fmtHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });

  const resumenArticulo = (o: DbOrder) => {
    const a = o?.order?.articulos?.[0];
    if (!a) return '';
    return `${Number(a.cantidad_solicitada || 0)} ${a.unidad_medida || ''} ${a.codigo ? `[${a.codigo}]` : ''} ${a.descripcion || ''}`
      .replace(/\s+/g, ' ')
      .trim();
  };

  const canSend = !!draft && !sending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-6 items-start">
      {/* ================= COLUMNA LECTOR ================= */}
      <div className="space-y-6">
        {/* Texto del pedido */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h2 className="text-[11px] font-extrabold tracking-wide text-slate-800 uppercase leading-tight pt-1">
              Texto del<br />pedido
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleNuevo}
                className="flex flex-col items-center px-4 py-1 rounded-lg border border-cyan-200 bg-cyan-50 text-[11px] font-semibold text-codizulca-cyan hover:bg-cyan-100"
              >
                <Plus size={14} /> Nuevo Pedido
              </button>
              <button
                onClick={() => setText(EJEMPLO)}
                className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 leading-tight"
              >
                Cargar<br />ejemplo
              </button>
            </div>
          </div>

          <textarea
            className="w-full h-32 rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-codizulca-cyan/40"
            placeholder="Ej: Para el cliente PRUEBA ruta MARIANA..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button
            onClick={handleExtract}
            disabled={parsing || !text.trim()}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-codizulca-red py-3 text-sm font-bold text-white shadow-md shadow-red-200 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {parsing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Procesando...
              </>
            ) : (
              <>
                Extraer Datos <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[9px] font-bold text-slate-400 tracking-widest">O TAMBIÉN</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            onClick={handleManual}
            className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-bold text-slate-800 hover:bg-slate-50"
          >
            <Pencil size={14} className="text-codizulca-red shrink-0" />
            <span className="flex-1 text-center">Llenar / Editar Pedido Manualmente en Formato</span>
          </button>
        </div>

        {/* Historial reciente */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <h2 className="flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-slate-800 uppercase">
              <History size={14} className="text-codizulca-red" /> Historial reciente (últimos 10)
            </h2>
            <Settings size={14} className="text-slate-400" />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {recientes.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Aún no hay pedidos emitidos.</p>
            )}
            {recientes.map((o) => (
              <button
                key={o.id}
                onClick={() => handleLoadFromHistory(o)}
                title="Cargar en el formato como nuevo pedido"
                className="w-full text-left rounded-xl border border-slate-200 p-3 hover:border-codizulca-cyan hover:bg-cyan-50/30 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm font-semibold text-slate-800">{o.order.cliente}</span>
                  <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-codizulca-red">
                    Pedido #{o.order.numero_pedido}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">{fmtHora(o.createdAt)}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Ruta: <span className="font-bold text-slate-800">{o.order.ruta || '-'}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{resumenArticulo(o)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================= COLUMNA FORMATO ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[700px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-slate-800 uppercase">
            <FileText size={14} className="text-codizulca-red" /> Formato de Facturación
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleManual}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Pencil size={12} className="text-codizulca-red" /> Llenar Manualmente
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-lg bg-codizulca-red px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enviar a Bandeja
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mx-4 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              notice.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {notice.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {notice.text}
          </div>
        )}

        {draft ? (
          <div className="p-4 overflow-x-auto">
            {hasRestoredDraft && (
              <div className="mb-3 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold">💾 Borrador recuperado automáticamente</span>
                  <span className="text-emerald-600 hidden sm:inline">(Se guardó tu avance previo de forma segura)</span>
                </div>
                <button 
                  onClick={handleNuevo} 
                  className="text-[11px] font-bold text-red-600 hover:text-red-800 underline ml-2"
                >
                  Descartar borrador
                </button>
              </div>
            )}
            <div className="min-w-[720px]">
              <PlanillaForm value={draft} onChange={setDraft} nextNumero={nextNumero} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <ClipboardList size={44} className="text-slate-200" />
            <p className="text-xs text-slate-500">Los datos procesados se mostrarán en formato de planilla aquí.</p>
            <button
              onClick={handleManual}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
            >
              <Pencil size={14} className="text-codizulca-red" /> Llenar / Editar Formato Manualmente
            </button>
          </div>
        )}
      </div>

      {/* ================= SALA DE ESPERA ALKOSTO ================= */}
      <div className="lg:col-span-2 mt-6">
        <SalaEsperaAlkosto />
      </div>

      {/* ================= BLOQUE DE SEGUIMIENTO GLOBAL ================= */}
      <div className="lg:col-span-2 mt-6">
        <SeguimientoBlock orders={orders} />
      </div>
    </div>
  );
};

export default Ventas;
