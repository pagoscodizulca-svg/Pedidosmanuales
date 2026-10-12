import React from 'react';
import { Plus } from 'lucide-react';
import type { ArticuloItem, OrderData } from '../../types';
import { CLIENTES } from '../../data/clientes';
import { PRODUCTOS } from '../../data/productos';

export const STANDARD_ROWS = 15;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const emptyRow = (): ArticuloItem => ({
  codigo: '',
  descripcion: '',
  cantidad_solicitada: 0,
  cantidad_despachada: 0,
  unidad_medida: '',
  precio_unitario: 0,
  sub_total: 0,
});

/** Una línea sin producto se considera vacía y debe quedar totalmente en blanco. */
export const isRowEmpty = (a: ArticuloItem) =>
  !a.descripcion?.trim() && !a.codigo?.trim() && !Number(a.cantidad_solicitada);

/** Normaliza los artículos y completa hasta los 15 renglones estándar. */
export const padRows = (arts: Partial<ArticuloItem>[] = []): ArticuloItem[] => {
  const rows = arts.map((a) => {
    const cant = Number(a.cantidad_solicitada) || 0;
    const precio = Number(a.precio_unitario) || 0;
    return {
      ...emptyRow(),
      ...a,
      descripcion: a.descripcion || '',
      unidad_medida: (a.unidad_medida || '').toUpperCase(),
      cantidad_solicitada: cant,
      precio_unitario: precio,
      sub_total: round2(cant * precio),
    } as ArticuloItem;
  });
  while (rows.length < STANDARD_ROWS) rows.push(emptyRow());
  return rows;
};

export const calcTotal = (arts: ArticuloItem[]) =>
  round2(arts.reduce((sum, a) => sum + (Number(a.sub_total) || 0), 0));

const UNIDADES = ['UND', 'KG', 'BTOS', 'CAJAS', 'PAQ', 'LTS'];

interface PlanillaFormProps {
  value: OrderData;
  onChange: (value: OrderData) => void;
  /** Correlativo previsto (se muestra si el pedido aún no tiene número). */
  nextNumero: string;
}

const cellInput =
  'w-full h-full bg-transparent px-1.5 py-1 text-[13px] focus:outline-none focus:bg-cyan-50';
const labelCls = 'text-[10px] font-bold text-slate-600 uppercase whitespace-nowrap';

export const PlanillaForm: React.FC<PlanillaFormProps> = ({ value, onChange, nextNumero }) => {
  const set = (patch: Partial<OrderData>) => onChange({ ...value, ...patch });

  const setRow = (index: number, field: keyof ArticuloItem, raw: string | number) => {
    const arts = [...value.articulos];
    const row: ArticuloItem = { ...arts[index], [field]: raw };
    row.sub_total = round2((Number(row.cantidad_solicitada) || 0) * (Number(row.precio_unitario) || 0));
    arts[index] = row;
    const total = calcTotal(arts);
    onChange({ ...value, articulos: arts, total_pedido: total, monto_pedido: total });
  };

  const addRow = () => set({ articulos: [...value.articulos, emptyRow()] });

  // Auto-completar cliente al escribir o cambiar ID de Cliente
  const handleIdClienteChange = (raw: string) => {
    const val = raw.toUpperCase();
    const clean = val.trim();
    const padded = clean ? clean.padStart(6, '0') : '';
    const found = CLIENTES.find((c) => c.id_cliente === clean || c.id_cliente === padded);

    if (found) {
      set({
        id_cliente: val,
        cliente: found.nombre,
        ruta: found.vendedor || value.ruta,
      });
    } else {
      set({ id_cliente: val });
    }
  };

  const handleIdClienteBlur = () => {
    const raw = (value.id_cliente || '').trim();
    if (!raw) return;
    const padded = raw.padStart(6, '0');
    const found = CLIENTES.find((c) => c.id_cliente === raw || c.id_cliente === padded);
    if (found) {
      set({
        id_cliente: found.id_cliente,
        cliente: found.nombre,
        ruta: found.vendedor || value.ruta,
      });
    } else if (raw.length < 6 && /^\d+$/.test(raw)) {
      set({ id_cliente: padded });
    }
  };

  // Auto-completar código y ruta al seleccionar o escribir Nombre del Cliente
  const handleClienteChange = (raw: string) => {
    const val = raw.toUpperCase();
    const found = CLIENTES.find((c) => c.nombre.toUpperCase() === val.trim());
    if (found) {
      set({
        cliente: val,
        id_cliente: found.id_cliente,
        ruta: found.vendedor || value.ruta,
      });
    } else {
      set({ cliente: val });
    }
  };

  // Auto-completar descripción al ingresar Código de producto
  const handleItemCodigoChange = (idx: number, raw: string) => {
    const clean = raw.trim();
    const padded = clean ? clean.padStart(6, '0') : '';
    const found = PRODUCTOS.find((p) => p.id === clean || p.id === padded);
    if (found) {
      const arts = [...value.articulos];
      arts[idx] = { ...arts[idx], codigo: raw, descripcion: found.descripcion };
      onChange({ ...value, articulos: arts });
    } else {
      setRow(idx, 'codigo', raw);
    }
  };

  // Auto-completar código al seleccionar o escribir Descripción de producto
  const handleItemDescripcionChange = (idx: number, raw: string) => {
    const upper = raw.toUpperCase();
    const found = PRODUCTOS.find((p) => p.descripcion.toUpperCase() === upper.trim());
    if (found) {
      const arts = [...value.articulos];
      arts[idx] = { ...arts[idx], descripcion: upper, codigo: found.id };
      onChange({ ...value, articulos: arts });
    } else {
      setRow(idx, 'descripcion', upper);
    }
  };

  const total = calcTotal(value.articulos);
  const numero = value.numero_pedido || nextNumero;

  return (
    <div className="border-2 border-slate-800 bg-white text-slate-900 select-none">
      <datalist id="unidades-list">
        {UNIDADES.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <datalist id="clientes-list">
        {CLIENTES.map((c) => (
          <option key={c.id_cliente} value={c.nombre}>
            {c.id_cliente} {c.vendedor ? `(${c.vendedor})` : ''}
          </option>
        ))}
      </datalist>

      <datalist id="productos-list">
        {PRODUCTOS.map((p) => (
          <option key={p.id} value={p.descripcion}>
            {p.id}
          </option>
        ))}
      </datalist>

      {/* ===== ENCABEZADO ===== */}
      <div className="grid grid-cols-[170px_1fr_190px] border-b border-slate-800">
        {/* Logo */}
        <div className="px-2 py-1.5 border-r border-b border-slate-800">
          <div className="text-xl font-extrabold leading-tight tracking-tight">codizulca</div>
          <div className="text-[9px] font-bold">RIF: J40987613-6</div>
        </div>
        {/* Cliente */}
        <div className="flex items-center gap-2 px-3 border-r border-b border-slate-800">
          <span className="text-sm font-semibold text-slate-600">CLIENTE:</span>
          <input
            list="clientes-list"
            className="flex-1 bg-transparent text-sm font-bold uppercase focus:outline-none focus:bg-cyan-50 px-1 py-1"
            value={value.cliente}
            onChange={(e) => handleClienteChange(e.target.value)}
            placeholder="NOMBRE DEL CLIENTE"
          />
        </div>
        {/* Fecha + ID Cliente */}
        <div className="border-b border-slate-800">
          <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-slate-800">
            <span className={labelCls}>Fecha:</span>
            <input
              type="date"
              className="bg-transparent text-xs font-medium text-right focus:outline-none"
              value={value.fecha}
              onChange={(e) => set({ fecha: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1 bg-amber-50">
            <span className={labelCls}>ID Cliente:</span>
            <input
              className="w-24 bg-transparent text-xs font-bold text-right uppercase focus:outline-none"
              value={value.id_cliente || ''}
              onChange={(e) => handleIdClienteChange(e.target.value)}
              onBlur={handleIdClienteBlur}
              placeholder="ID"
            />
          </div>
        </div>
        {/* Ruta */}
        <div className="col-span-2 flex items-center gap-2 px-2 border-r border-slate-800">
          <span className={labelCls}>Ruta:</span>
          <input
            className="flex-1 bg-transparent text-sm font-bold uppercase focus:outline-none focus:bg-cyan-50 px-1 py-1"
            value={value.ruta || ''}
            onChange={(e) => set({ ruta: e.target.value.toUpperCase() })}
            placeholder="VENDEDOR / RUTA"
          />
        </div>
        {/* Nº Pedido */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-amber-50">
          <span className={labelCls}>Nº Pedido:</span>
          <span className="text-sm font-extrabold text-codizulca-red tracking-wider">{numero}</span>
        </div>
      </div>

      {/* ===== RENGLONES ===== */}
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-9" />
          <col className="w-16" />
          <col className="w-16" />
          <col className="w-24" />
          <col className="w-20" />
          <col />
          <col className="w-24" />
          <col className="w-28" />
        </colgroup>
        <thead className="text-[10px] font-bold text-slate-700">
          <tr className="border-b border-slate-800">
            <th rowSpan={2} className="border-r border-slate-800">Nº</th>
            <th colSpan={2} className="border-r border-b border-slate-800 py-0.5">CANT. SOLICITADA</th>
            <th rowSpan={2} className="border-r border-slate-800 leading-tight">CANTIDAD<br />DESPACHADA</th>
            <th rowSpan={2} className="border-r border-slate-800">CÓDIGO</th>
            <th rowSpan={2} className="border-r border-slate-800">DESCRIPCION DEL PRODUCTO</th>
            <th rowSpan={2} className="border-r border-slate-800">PRECIO</th>
            <th rowSpan={2}>SUB TOTAL</th>
          </tr>
          <tr className="border-b border-slate-800 text-[9px]">
            <th className="border-r border-slate-800 py-0.5">UNID</th>
            <th className="border-r border-slate-800 py-0.5">CANT</th>
          </tr>
        </thead>
        <tbody>
          {value.articulos.map((item, idx) => {
            const empty = isRowEmpty(item);
            return (
              <tr key={idx} className="h-[30px] border-b border-slate-800 hover:bg-slate-50/60">
                <td className="border-r border-slate-800 text-center text-[11px] font-semibold">{idx + 1}</td>
                <td className="border-r border-slate-800 bg-amber-50">
                  <input
                    list="unidades-list"
                    className={`${cellInput} text-center font-bold uppercase`}
                    value={item.unidad_medida || ''}
                    onChange={(e) => setRow(idx, 'unidad_medida', e.target.value.toUpperCase())}
                  />
                </td>
                <td className="border-r border-slate-800">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className={`${cellInput} font-bold`}
                    value={item.cantidad_solicitada || ''}
                    onChange={(e) => setRow(idx, 'cantidad_solicitada', Number(e.target.value))}
                  />
                </td>
                <td className="border-r border-slate-800">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className={`${cellInput} text-center`}
                    value={item.cantidad_despachada || ''}
                    onChange={(e) => setRow(idx, 'cantidad_despachada', Number(e.target.value))}
                  />
                </td>
                <td className="border-r border-slate-800">
                  <input
                    className={`${cellInput} text-center text-[12px]`}
                    value={item.codigo || ''}
                    onChange={(e) => handleItemCodigoChange(idx, e.target.value)}
                  />
                </td>
                <td className="border-r border-slate-800">
                  <input
                    list="productos-list"
                    className={`${cellInput} uppercase`}
                    value={item.descripcion || ''}
                    onChange={(e) => handleItemDescripcionChange(idx, e.target.value)}
                  />
                </td>
                <td className="border-r border-slate-800">
                  <div className="flex items-center h-full">
                    {/* El símbolo $ solo aparece en renglones con producto */}
                    <span className="pl-1.5 text-[11px] text-slate-500 w-4">{!empty ? '$' : ''}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${cellInput} text-center font-bold`}
                      value={item.precio_unitario || ''}
                      onChange={(e) => setRow(idx, 'precio_unitario', Number(e.target.value))}
                    />
                  </div>
                </td>
                <td className="px-2 text-right text-[13px] font-bold">
                  {!empty && item.sub_total > 0 ? `$${item.sub_total.toFixed(2)}` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ===== AGREGAR RENGLÓN ===== */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-slate-800">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 border border-slate-300 rounded px-3 py-1 text-xs font-semibold hover:bg-slate-50"
        >
          <Plus size={14} className="text-codizulca-red" /> Agregar Renglón
        </button>
        <span className="text-[11px] text-slate-500">
          Módulo de Ventas: Edición manual habilitada en todas las casillas del formato
        </span>
      </div>

      {/* ===== PIE DEL FORMATO ===== */}
      <div className="grid grid-cols-[1fr_1.4fr_150px] text-xs">
        {/* Supervisor + Total */}
        <div className="col-span-2 flex items-center gap-2 px-2 py-1.5 border-b border-r border-slate-800">
          <span className={labelCls}>Supervisor:</span>
          <input
            className="flex-1 bg-transparent text-sm font-semibold uppercase focus:outline-none focus:bg-cyan-50 px-1"
            value={value.supervisor || ''}
            onChange={(e) => set({ supervisor: e.target.value.toUpperCase() })}
            placeholder="NOMBRE SUPERVISOR"
          />
        </div>
        <div className="flex items-stretch border-b border-slate-800">
          <span className="flex items-center px-2 text-xs font-bold">TOTAL:</span>
          <span className="flex-1 flex items-center justify-end px-2 bg-amber-200 text-base font-extrabold">
            ${total.toFixed(2)}
          </span>
        </div>

        {/* Chofer / Observaciones / Aprobación CXC */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-r border-slate-800">
          <span className={labelCls}>Chofer:</span>
          <input
            className="flex-1 min-w-0 bg-transparent uppercase focus:outline-none focus:bg-cyan-50 px-1"
            value={value.chofer || ''}
            onChange={(e) => set({ chofer: e.target.value.toUpperCase() })}
            placeholder="NOMBRE CHOFER"
          />
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-r border-slate-800">
          <span className={labelCls}>Observaciones:</span>
          <input
            className="flex-1 min-w-0 bg-transparent uppercase focus:outline-none focus:bg-cyan-50 px-1"
            value={value.observaciones || ''}
            onChange={(e) => set({ observaciones: e.target.value.toUpperCase() })}
            placeholder="OBSERVACIONES DEL PEDIDO"
          />
        </div>
        <div className="row-span-2 px-2 py-1 text-center text-[9px] font-semibold text-slate-500">
          APROBACIÓN CXC
        </div>

        {/* Cestas */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-r border-slate-800">
          <span className={`${labelCls} leading-tight`}>Cantidad de<br />cestas:</span>
          <input
            type="number"
            min={0}
            className="w-20 bg-transparent focus:outline-none focus:bg-cyan-50 px-1"
            value={value.cantidad_cestas || ''}
            onChange={(e) => set({ cantidad_cestas: Number(e.target.value) || undefined })}
            placeholder="0"
          />
        </div>
        <div className="border-r border-slate-800" />
      </div>
    </div>
  );
};

export default PlanillaForm;
