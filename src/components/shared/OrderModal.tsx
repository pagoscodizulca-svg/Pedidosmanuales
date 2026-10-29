import React from 'react';
import { X, Printer, User, Trash2, Loader2, AlertTriangle, FileText, MapPin, Package } from 'lucide-react';
import { DbOrder, OrderData } from '../../types';
import { useAppStore } from '../../store/index';
import { useAuthStore } from '../../store/auth';
import { PlanillaForm, padRows } from '../ventas/PlanillaForm';
import {
  isAlkostoSairuOrder,
  isRecentlyArrivedOrder,
  AlkostoSairuCorporateBadge
} from '../ventas/SalaEsperaAlkosto';
import { printOrder } from '../../lib/pdfUtils';

interface OrderModalProps {
  order: DbOrder;
  onClose: () => void;
}

const WAITING_ROOM_STATUSES = new Set([
  'POR_VALIDAR',
  'POR VALIDAR',
  'ERROR_FORMATO',
  'PENDIENTE',
  'EN_ESPERA',
  'EN ESPERA',
  'ENVIADO',
  'POR_APROBAR',
  'RECIBIDO'
]);

function extractInitialOcAndDir(ord: any): { oc: string; dir: string } {
  const rawObs = String(ord?.observacion_formateada || ord?.observaciones || '').trim();
  const ocMatch =
    rawObs.match(/OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?|OTRA\s+CADENA)\s*:\s*([A-Z0-9-]+)/i) ||
    rawObs.match(/\b(?:OC|ORDEN\s+DE\s+COMPRA)\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  const oc = String(ord?.numero_oc || (ocMatch ? ocMatch[1] : '') || '').trim();

  const dirMatch = rawObs.match(/\|\s*Dir:\s*(.+)$/i);
  const cleanObsDir = rawObs
    .replace(/\s*\|\s*OC\s+(?:ALKOSTO|FAMILIA(?:\s+CENTER)?|OTRA\s+CADENA)\s*:\s*[^|]+/gi, '')
    .replace(/\b(?:OC|ORDEN\s+DE\s+COMPRA)\s*[:#]?\s*[A-Z0-9-]{4,}\s*\|?\s*/gi, '')
    .replace(/\bRef\.\s*Cadenas\s*:\s*#[A-Z0-9-]+\s*\|?\s*/gi, '')
    .replace(/^.*\|\s*Dir:\s*/i, '')
    .trim();
  const dir = String(ord?.direccion_despacho || (dirMatch ? dirMatch[1].trim() : cleanObsDir) || '').trim();
  return { oc: oc === 'S/N' ? '' : oc, dir };
}

export const OrderModal: React.FC<OrderModalProps> = ({ order, onClose }) => {
  const { user } = useAuthStore();
  const isVentas = user?.role === 'ventas' || user?.role === 'gerencia' || user?.role === 'master';
  const isWaitingRoomOrder = WAITING_ROOM_STATUSES.has(String(order.status || '').trim().toUpperCase());

  // Regla estricta: solo se puede editar si el usuario pertenece a Ventas/Gerencia/Master y el pedido no está completado ni rechazado
  const isEditing = isVentas && order.status !== 'COMPLETADO' && order.status !== 'RECHAZADO';

  const ord = order?.order || ({} as any);
  const initialMeta = extractInitialOcAndDir(ord);
  const [numeroOc, setNumeroOc] = React.useState<string>(initialMeta.oc);
  const [direccionDespacho, setDireccionDespacho] = React.useState<string>(initialMeta.dir);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<OrderData>(() => ({
    ...ord,
    cliente: ord.cliente || ord.sucursal_cliente || '',
    sucursal_cliente: ord.sucursal_cliente || ord.cliente || '',
    cadena: ord.cadena || ord.origen || undefined,
    numero_oc: initialMeta.oc || ord.numero_oc || undefined,
    direccion_despacho: initialMeta.dir || ord.direccion_despacho || undefined,
    observacion_formateada: ord.observacion_formateada || ord.observaciones || '',
    vendedor: ord.vendedor || ord.ruta || '',
    id_cliente: ord.id_cliente || '',
    ruta: ord.ruta || ord.vendedor || '',
    supervisor: ord.supervisor || '',
    chofer: ord.chofer || '',
    observaciones: ord.observaciones || ord.observacion_formateada || '',
    fecha: ord.fecha || '',
    numero_pedido: ord.numero_pedido || '',
    total_pedido: Number(ord.total_pedido || ord.monto_pedido || 0),
    monto_pedido: Number(ord.total_pedido || ord.monto_pedido || 0),
    articulos: padRows(ord.articulos || []),
  }));

  React.useEffect(() => {
    const currentOrd = order?.order || ({} as any);
    const meta = extractInitialOcAndDir(currentOrd);
    setNumeroOc(meta.oc);
    setDireccionDespacho(meta.dir);
    setValidationError(null);
    setDraft({
      ...currentOrd,
      cliente: currentOrd.cliente || currentOrd.sucursal_cliente || '',
      sucursal_cliente: currentOrd.sucursal_cliente || currentOrd.cliente || '',
      cadena: currentOrd.cadena || currentOrd.origen || undefined,
      numero_oc: meta.oc || currentOrd.numero_oc || undefined,
      direccion_despacho: meta.dir || currentOrd.direccion_despacho || undefined,
      observacion_formateada: currentOrd.observacion_formateada || currentOrd.observaciones || '',
      vendedor: currentOrd.vendedor || currentOrd.ruta || '',
      id_cliente: currentOrd.id_cliente || '',
      ruta: currentOrd.ruta || currentOrd.vendedor || '',
      supervisor: currentOrd.supervisor || '',
      chofer: currentOrd.chofer || '',
      observaciones: currentOrd.observaciones || currentOrd.observacion_formateada || '',
      fecha: currentOrd.fecha || '',
      numero_pedido: currentOrd.numero_pedido || '',
      total_pedido: Number(currentOrd.total_pedido || currentOrd.monto_pedido || 0),
      monto_pedido: Number(currentOrd.total_pedido || currentOrd.monto_pedido || 0),
      articulos: padRows(currentOrd.articulos || []),
    });
  }, [order]);

  const { updateFullOrder, deleteOrder } = useAppStore();
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleOcOrDirChange = (newOc: string, newDir: string) => {
    setNumeroOc(newOc);
    setDireccionDespacho(newDir);
    const cliUpper = String(draft.cliente || draft.sucursal_cliente || 'SUCURSAL').trim().toUpperCase();
    const cadLabel = cliUpper.includes('FAMILIA') ? 'FAMILIA CENTER' : 'ALKOSTO';
    const nextObs = `${cliUpper} | OC ${cadLabel}: ${newOc.trim() || 'S/N'} | Dir: ${newDir.trim() || cliUpper}`;
    setDraft(prev => ({
      ...prev,
      numero_oc: newOc.trim(),
      direccion_despacho: newDir.trim(),
      observaciones: nextObs,
      observacion_formateada: nextObs
    }));
  };

  const activeRows = React.useMemo(() => {
    return (draft.articulos || []).filter(
      (a: any) =>
        a &&
        (String(a.descripcion || '').trim() !== '' ||
          String(a.codigo || '').trim() !== '' ||
          Number(a.cantidad_solicitada) > 0 ||
          Number(a.precio_unitario) > 0) &&
        String(a.codigo || '').toUpperCase() !== 'ERROR'
    );
  }, [draft.articulos]);

  const liveTotal = React.useMemo(() => {
    const sum = activeRows.reduce((acc, a) => {
      const cant = Number(a.cantidad_solicitada) || 0;
      const precio = Number(a.precio_unitario) || 0;
      return acc + Number((cant * precio).toFixed(2));
    }, 0);
    return Number(sum.toFixed(2));
  }, [activeRows]);

  const buildSanitizedDraft = (): { cleanDraft: OrderData; errors: string[] } => {
    const errors: string[] = [];
    const clienteTrim = String(draft.cliente || '').trim();
    if (!clienteTrim) {
      errors.push('Debe indicar el nombre del Cliente / Sucursal.');
    }

    if (activeRows.length === 0) {
      errors.push('El pedido debe contener al menos 1 renglón de artículo válido.');
    }

    const sanitizedItems = activeRows.map((a, idx) => {
      const desc = String(a.descripcion || '').trim();
      const cant = Number(a.cantidad_solicitada) || 0;
      const precio = Number(a.precio_unitario) || 0;
      if (!desc) errors.push(`Renglón #${idx + 1}: Falta la descripción del producto.`);
      if (cant <= 0) errors.push(`Renglón #${idx + 1} (${desc || 'Sin descripción'}): La cantidad debe ser mayor a 0.`);
      if (precio <= 0) errors.push(`Renglón #${idx + 1} (${desc || 'Sin descripción'}): El precio unitario debe ser mayor a $0.00.`);
      return {
        ...a,
        codigo: String(a.codigo || '').trim(),
        descripcion: desc,
        unidad_medida: String(a.unidad_medida || 'BULTO').trim() || 'BULTO',
        cantidad_solicitada: cant,
        cantidad_despachada: Number(a.cantidad_despachada) || 0,
        precio_unitario: precio,
        sub_total: Number((cant * precio).toFixed(2))
      };
    });

    const ocTrim = numeroOc.trim();
    const dirTrim = direccionDespacho.trim();
    const obsTrim = String(draft.observaciones || '').trim();

    if (isWaitingRoomOrder) {
      if (!ocTrim && !obsTrim.toUpperCase().includes('OC')) {
        errors.push('Debe indicar el Número de Orden de Compra (OC).');
      }
      if (!dirTrim && !obsTrim) {
        errors.push('Debe indicar la Dirección de Despacho.');
      }
    }

    const cliUpper = clienteTrim.toUpperCase();
    const cadLabel = cliUpper.includes('FAMILIA') ? 'FAMILIA CENTER' : 'ALKOSTO';
    const finalObs =
      isWaitingRoomOrder && (ocTrim || dirTrim)
        ? `${cliUpper} | OC ${cadLabel}: ${ocTrim || 'S/N'} | Dir: ${dirTrim || cliUpper}`
        : obsTrim;

    const total = Number(
      sanitizedItems.reduce((acc, it) => acc + (Number(it.sub_total) || 0), 0).toFixed(2)
    );

    return {
      cleanDraft: {
        ...draft,
        cliente: clienteTrim,
        sucursal_cliente: clienteTrim,
        numero_oc: ocTrim || draft.numero_oc,
        direccion_despacho: dirTrim || draft.direccion_despacho,
        observaciones: finalObs,
        observacion_formateada: finalObs,
        articulos: sanitizedItems,
        total_renglones: sanitizedItems.length,
        total_pedido: total,
        monto_pedido: total
      },
      errors
    };
  };

  const handleDeleteModal = async () => {
    if (!isVentas || deleting) return;
    const clientName = draft.cliente || order.order?.cliente || 'este pedido';
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente el pedido de "${clientName}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeleting(true);
    setValidationError(null);
    try {
      await deleteOrder(order.id);
      onClose();
    } catch (err: any) {
      setValidationError(`Error al eliminar pedido: ${err?.message || 'Intente nuevamente'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveAndSend = async () => {
    if (saving) return;
    if (!isVentas) {
      setValidationError('Solo el departamento de Ventas puede aprobar y editar pedidos.');
      return;
    }
    const { cleanDraft, errors } = buildSanitizedDraft();
    if (errors.length > 0) {
      setValidationError(errors.join(' '));
      return;
    }

    setSaving(true);
    setValidationError(null);
    try {
      await updateFullOrder(order.id, cleanDraft, 'PENDIENTE_CXC');
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Error al aprobar y enviar el pedido a Cuentas por Cobrar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!isVentas || saving) return;
    const { cleanDraft, errors } = buildSanitizedDraft();
    if (errors.length > 0) {
      setValidationError(errors.join(' '));
      return;
    }

    setSaving(true);
    setValidationError(null);
    try {
      await updateFullOrder(order.id, cleanDraft);
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Error al guardar los cambios del pedido.');
    } finally {
      setSaving(false);
    }
  };

  const articulosCount = activeRows.length;
  const isAlkostoSairu = isAlkostoSairuOrder(order);
  const sucursalDisplay = String(draft.sucursal_cliente || draft.cliente || ord.sucursal || 'SUCURSAL NO DEFINIDA').trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-800">Detalles del Pedido</h2>
            {isAlkostoSairu && (
              <AlkostoSairuCorporateBadge isRecent={isWaitingRoomOrder && isRecentlyArrivedOrder(order)} />
            )}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              order.status === 'COMPLETADO' ? 'bg-cyan-100 text-cyan-800' :
              order.status === 'RECHAZADO' || order.status === 'ERROR_FORMATO' ? 'bg-red-100 text-red-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {(order.status || '').replace('_', ' ')}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 space-y-6">
          {validationError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 flex items-start gap-2.5 shadow-sm">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold uppercase tracking-wide mb-0.5">Error de Validación / Aprobación</p>
                <p className="font-semibold leading-relaxed">{validationError}</p>
              </div>
              <button
                onClick={() => setValidationError(null)}
                className="text-[11px] font-black uppercase px-2 py-0.5 rounded hover:bg-red-100"
              >
                Cerrar
              </button>
            </div>
          )}

          {(order.status === 'ERROR_FORMATO' || String(order.cxcNote || '').startsWith('ERROR_FORMATO:') || String(order.cxcNote || '').startsWith('AVISO_PARSING:')) && (
            <div className={`rounded-xl border p-4 text-xs ${
              order.status === 'ERROR_FORMATO' || String(order.cxcNote || '').startsWith('ERROR_FORMATO:')
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <p className="font-extrabold uppercase tracking-wide mb-1">
                {order.status === 'ERROR_FORMATO' ? '⚠️ Orden con Error de Formato (Fallback Activo)' : 'ℹ️ Aviso de Auditoría / Normalización Automática'}
              </p>
              <p className="font-medium leading-relaxed">
                {String(order.cxcNote || 'Verifica los campos del pedido antes de enviarlo a Cuentas por Cobrar.').replace(/^(ERROR_FORMATO|AVISO_PARSING):\s*/i, '')}
              </p>
            </div>
          )}
          
          {/* Resumen Superior con Sucursal, Vendedor y Total en Tiempo Real */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 shadow-sm">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 uppercase leading-tight mb-2">
                {sucursalDisplay}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                <span className="bg-red-50 text-codizulca-red px-2 py-0.5 rounded border border-red-100 font-mono font-bold">
                  ID: {draft.id_cliente || ord.id_cliente || '-'}
                </span>
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-mono font-bold">
                  Pedido #{draft.numero_pedido || ord.numero_pedido || '-'}
                </span>
                {numeroOc && (
                  <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-mono font-bold">
                    OC: {numeroOc}
                  </span>
                )}
                <span>Sucursal: <strong className="text-slate-800 uppercase">{sucursalDisplay}</strong></span>
                <span>•</span>
                <span>Fecha: {draft.fecha || ord.fecha || '-'}</span>
                <span>•</span>
                <span>Ruta/Vendedor: <strong className="text-slate-700">{draft.ruta || draft.vendedor || ord.ruta || '-'}</strong></span>
                <span>•</span>
                <span>Artículos válidos: <strong className="text-slate-800">{articulosCount}</strong></span>
              </div>
            </div>
            <div className="bg-amber-100/50 border border-amber-200 rounded-lg px-6 py-3 text-right shrink-0">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Total Verificado (USD):</div>
              <div className="text-2xl font-extrabold text-slate-800">
                ${(liveTotal > 0 ? liveTotal : Number(draft.total_pedido || ord.total_pedido || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Vista Rápida de Productos, Cantidades, Precios y Sucursal en Sala de Espera */}
          {isWaitingRoomOrder && activeRows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} className="text-codizulca-red" />
                  Resumen de Productos Recibidos ({activeRows.length} {activeRows.length === 1 ? 'ítem' : 'ítems'} — {sucursalDisplay})
                </h4>
                <span className="text-[11px] font-bold text-slate-500">
                  Despacho: <strong className="text-slate-700">{direccionDespacho || sucursalDisplay}</strong>
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-bold">#</th>
                      <th className="px-2.5 py-2 text-left font-bold">Código</th>
                      <th className="px-2.5 py-2 text-left font-bold">Producto</th>
                      <th className="px-2.5 py-2 text-center font-bold">Unidad</th>
                      <th className="px-2.5 py-2 text-right font-bold">Cantidad</th>
                      <th className="px-2.5 py-2 text-right font-bold">Precio Unit.</th>
                      <th className="px-2.5 py-2 text-right font-bold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeRows.map((rowItem, i) => {
                      const cant = Number(rowItem.cantidad_solicitada) || 0;
                      const precio = Number(rowItem.precio_unitario) || 0;
                      const sub = cant > 0 && precio > 0 ? Number((cant * precio).toFixed(2)) : Number(rowItem.sub_total) || 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-2.5 py-1.5 font-mono text-slate-400 font-bold">{i + 1}</td>
                          <td className="px-2.5 py-1.5 font-mono font-bold text-slate-700">{rowItem.codigo || 'S/C'}</td>
                          <td className="px-2.5 py-1.5 font-bold text-slate-800 uppercase">{rowItem.descripcion || '-'}</td>
                          <td className="px-2.5 py-1.5 text-center font-bold text-slate-600">{rowItem.unidad_medida || 'BULTO'}</td>
                          <td className="px-2.5 py-1.5 text-right font-extrabold text-slate-900">{cant}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700">
                            ${precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-extrabold text-slate-900">
                            ${sub.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bloque Editable de Metadatos de Orden de Compra (Cadenas Comerciales) */}
          {isWaitingRoomOrder && isEditing && (
            <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 shadow-sm">
              <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText size={14} className="text-amber-700" />
                Metadatos de Orden de Compra y Despacho (Validación de Formato)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                    N° Orden de Compra (OC) *
                  </label>
                  <input
                    type="text"
                    value={numeroOc}
                    onChange={e => handleOcOrDirChange(e.target.value, direccionDespacho)}
                    placeholder="Ej. 0000055773"
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-codizulca-red"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1 flex items-center gap-1">
                    <MapPin size={11} className="text-codizulca-red" /> Dirección de Despacho / Sede *
                  </label>
                  <input
                    type="text"
                    value={direccionDespacho}
                    onChange={e => handleOcOrDirChange(numeroOc, e.target.value)}
                    placeholder="Dirección completa de entrega de la sucursal..."
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-codizulca-red"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Formato Planilla (Read Only para CxC y Facturación) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
             <div className={`min-w-[720px] ${!isEditing ? 'pointer-events-none select-none opacity-95' : ''}`}>
               <PlanillaForm value={draft} onChange={setDraft} nextNumero={String(ord.numero_pedido || '')} />
             </div>
          </div>

          {/* Historial de Trazabilidad */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 uppercase mb-6">
              <HistoryIcon /> Historial de Trazabilidad
            </h3>
            <div className="space-y-4">
              {(order.statusHistory || []).map((h, i) => {
                const userName = (!h.changedBy || h.changedBy === 'Usuario Actual' || h.changedBy === 'Desconocido')
                  ? (ord.supervisor || 'Usuario')
                  : h.changedBy;

                const timeStr = h.timestamp ? new Date(h.timestamp).toLocaleString('es-VE') : '-';

                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs">
                        <User size={14} className="text-codizulca-red" /> {userName}
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        h.status === 'CREADO' ? 'bg-slate-100 text-slate-600' :
                        h.status === 'COMPLETADO' ? 'bg-green-100 text-green-700' :
                        h.status === 'RECHAZADO' ? 'bg-red-100 text-red-700' :
                        'bg-cyan-100 text-cyan-800'
                      }`}>
                        {(h.status || '').replace('_', ' ')}
                      </span>
                      <span className="text-slate-500 text-xs font-medium">({h.department || 'Sistema'})</span>
                      {h.reason && <span className="text-red-600 text-xs italic ml-2">- {h.reason}</span>}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {timeStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => printOrder(order, true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors text-sm"
            >
              <Printer size={16} /> Imprimir Pedido
            </button>
            {isVentas && order.status !== 'COMPLETADO' && (
              <button 
                onClick={handleDeleteModal}
                disabled={deleting}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold transition-colors text-sm disabled:opacity-50"
                title="Eliminar este pedido permanentemente"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>Eliminar Pedido</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm"
            >
              Cerrar
            </button>
            {isWaitingRoomOrder ? (
              <button 
                onClick={handleSaveAndSend}
                disabled={saving}
                className="px-6 py-2.5 bg-codizulca-cyan hover:bg-cyan-400 text-slate-800 font-black rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Aprobando...' : 'Aprobar y Enviar a CxC'}
              </button>
            ) : isEditing ? (
              <button 
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-6 py-2.5 bg-codizulca-cyan hover:bg-cyan-400 text-slate-800 font-black rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e20613" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);
