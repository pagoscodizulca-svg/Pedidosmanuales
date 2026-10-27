import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { ArticuloItem, OrderData } from '../../types';
import { CLIENTES } from '../../data/clientes';
import { PRODUCTOS } from '../../data/productos';

export const STANDARD_ROWS = 15;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Índices en memoria O(1) para autocompletado instantáneo sin recorrer arreglos en cada pulsación
const CLIENTE_BY_ID = new Map(CLIENTES.map((c) => [c.id_cliente, c]));
const CLIENTE_BY_NUM = new Map(
  CLIENTES.map((c) => [parseInt(c.id_cliente, 10), c]).filter(([k]) => !isNaN(k as number)) as [number, (typeof CLIENTES)[0]][]
);
const CLIENTE_BY_NAME = new Map(CLIENTES.map((c) => [c.nombre.toUpperCase(), c]));

const PRODUCTO_BY_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));
const PRODUCTO_BY_NUM = new Map(
  PRODUCTOS.map((p) => [parseInt(p.id, 10), p]).filter(([k]) => !isNaN(k as number)) as [number, (typeof PRODUCTOS)[0]][]
);
const PRODUCTO_BY_DESC = new Map(PRODUCTOS.map((p) => [p.descripcion.toUpperCase(), p]));

export const findClienteByCode = (raw: string) => {
  const clean = raw.replace(/[^\w]/g, '').trim().toUpperCase();
  if (!clean) return undefined;
  const isNum = /^\d+$/.test(clean);
  const padded = isNum ? clean.padStart(6, '0') : clean;
  const exact = CLIENTE_BY_ID.get(clean) || CLIENTE_BY_ID.get(padded);
  if (exact) return exact;
  if (isNum) {
    const numVal = parseInt(clean, 10);
    if (!isNaN(numVal) && clean.length >= String(numVal).length) {
      return CLIENTE_BY_NUM.get(numVal);
    }
  }
  return undefined;
};

export const findClienteByName = (raw: string) => {
  const clean = raw.trim().toUpperCase();
  if (!clean) return undefined;
  return CLIENTE_BY_NAME.get(clean);
};

export const findProductoByCode = (raw: string) => {
  const clean = raw.replace(/[[\]]/g, '').trim().toUpperCase();
  if (!clean) return undefined;
  const isNum = /^\d+$/.test(clean);
  const padded = isNum ? clean.padStart(6, '0') : clean;
  const exact = PRODUCTO_BY_ID.get(clean) || PRODUCTO_BY_ID.get(padded);
  if (exact) return exact;
  if (isNum) {
    const numVal = parseInt(clean, 10);
    if (!isNaN(numVal) && clean.length >= String(numVal).length) {
      return PRODUCTO_BY_NUM.get(numVal);
    }
  }
  return undefined;
};

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
  !a?.descripcion?.trim() && !a?.codigo?.trim() && !Number(a?.cantidad_solicitada);

const UNIDADES = ['UNIDAD', 'BULTO', 'PIEZA', 'KG'];

const UNIT_NORMALIZE_MAP: Record<string, string> = {
  KG: 'KG', KGS: 'KG', KILO: 'KG', KILOS: 'KG',
  UND: 'UNIDAD', UNID: 'UNIDAD', UNI: 'UNIDAD', UNIDAD: 'UNIDAD', UNIDADES: 'UNIDAD', UN: 'UNIDAD',
  BTO: 'BULTO', BTOS: 'BULTO', BULTO: 'BULTO', BULTOS: 'BULTO',
  CJ: 'BULTO', CJA: 'BULTO', CAJ: 'BULTO', CAJA: 'BULTO', CAJAS: 'BULTO', CJS: 'BULTO', BLT: 'BULTO', EMP: 'BULTO',
  PZA: 'PIEZA', PZAS: 'PIEZA', PZ: 'PIEZA', PIEZA: 'PIEZA', PIEZAS: 'PIEZA',
};

export const normalizeUnidadMedida = (raw?: string): string => {
  if (!raw) return '';
  const clean = raw.trim().toUpperCase().replace(/\./g, '');
  return UNIT_NORMALIZE_MAP[clean] || (UNIDADES.includes(clean) ? clean : '');
};

/** Normaliza los artículos y completa hasta los 15 renglones estándar. */
export const padRows = (arts: Partial<ArticuloItem>[] = []): ArticuloItem[] => {
  const safeArts = Array.isArray(arts) ? arts : [];
  const rows = safeArts.map((a) => {
    const cant = Number(a?.cantidad_solicitada) || 0;
    const precio = Number(a?.precio_unitario) || 0;
    let codigo = (a?.codigo || '').trim();
    let descripcion = (a?.descripcion || '').trim().toUpperCase();

    if (codigo) {
      const matchedProd = findProductoByCode(codigo);
      if (matchedProd) {
        codigo = matchedProd.id;
        if (!descripcion) descripcion = matchedProd.descripcion;
      }
    } else if (descripcion) {
      const matchedByDesc = PRODUCTO_BY_DESC.get(descripcion);
      if (matchedByDesc) {
        codigo = matchedByDesc.id;
        descripcion = matchedByDesc.descripcion;
      }
    }

    return {
      ...emptyRow(),
      ...a,
      codigo,
      descripcion,
      unidad_medida: normalizeUnidadMedida(a?.unidad_medida),
      cantidad_solicitada: cant,
      precio_unitario: precio,
      sub_total: round2(cant * precio),
    } as ArticuloItem;
  });
  while (rows.length < STANDARD_ROWS) rows.push(emptyRow());
  return rows;
};

export const calcTotal = (arts: ArticuloItem[] = []) =>
  round2((arts || []).reduce((sum, a) => sum + (Number(a?.sub_total) || 0), 0));

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
    const arts = [...(value.articulos || [])];
    if (!arts[index]) return;
    const row: ArticuloItem = { ...arts[index], [field]: raw };
    row.sub_total = round2((Number(row.cantidad_solicitada) || 0) * (Number(row.precio_unitario) || 0));
    arts[index] = row;
    const total = calcTotal(arts);
    onChange({ ...value, articulos: arts, total_pedido: total, monto_pedido: total });
  };

  const addRow = () => set({ articulos: [...(value.articulos || []), emptyRow()] });

  // Auto-completar cliente al escribir o cambiar ID de Cliente
  const handleIdClienteChange = (raw: string) => {
    const val = raw.toUpperCase();
    const found = findClienteByCode(val);

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
    const clean = raw.replace(/[^\w]/g, '').trim();
    const isNum = /^\d+$/.test(clean);
    const padded = isNum ? clean.padStart(6, '0') : clean;
    const found = findClienteByCode(clean);

    if (found) {
      set({
        id_cliente: found.id_cliente,
        cliente: found.nombre,
        ruta: found.vendedor || value.ruta,
      });
    } else if (isNum && clean.length < 6) {
      set({ id_cliente: padded });
    }
  };

  // Auto-completar código y ruta al seleccionar o escribir Nombre del Cliente
  const handleClienteChange = (raw: string) => {
    const val = raw.toUpperCase();
    const found = findClienteByName(val);
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
    const found = findProductoByCode(raw);

    const arts = [...(value.articulos || [])];
    if (found) {
      arts[idx] = { 
        ...arts[idx], 
        codigo: raw, 
        descripcion: found.descripcion 
      };
    } else {
      arts[idx] = { ...arts[idx], codigo: raw };
    }
    const cant = Number(arts[idx]?.cantidad_solicitada) || 0;
    const precio = Number(arts[idx]?.precio_unitario) || 0;
    arts[idx].sub_total = round2(cant * precio);
    const total = calcTotal(arts);
    onChange({ ...value, articulos: arts, total_pedido: total, monto_pedido: total });
  };

  const handleItemCodigoBlur = (idx: number) => {
    const raw = (value.articulos?.[idx]?.codigo || '').trim();
    if (!raw) return;
    const clean = raw.replace(/[[\]]/g, '').trim();
    const isNum = /^\d+$/.test(clean);
    const padded = isNum ? clean.padStart(6, '0') : clean;
    const found = findProductoByCode(clean);

    const arts = [...(value.articulos || [])];
    if (found) {
      arts[idx] = {
        ...arts[idx],
        codigo: found.id,
        descripcion: found.descripcion,
      };
    } else if (isNum && clean.length < 6) {
      arts[idx] = { ...arts[idx], codigo: padded };
    }
    const cant = Number(arts[idx]?.cantidad_solicitada) || 0;
    const precio = Number(arts[idx]?.precio_unitario) || 0;
    arts[idx].sub_total = round2(cant * precio);
    const total = calcTotal(arts);
    onChange({ ...value, articulos: arts, total_pedido: total, monto_pedido: total });
  };

  // Auto-completar código al seleccionar o escribir Descripción de producto
  const handleItemDescripcionChange = (idx: number, raw: string) => {
    const upper = raw.toUpperCase().trim();
    const found = PRODUCTO_BY_DESC.get(upper);
    const arts = [...(value.articulos || [])];
    if (found) {
      arts[idx] = { ...arts[idx], descripcion: raw.toUpperCase(), codigo: found.id };
    } else {
      arts[idx] = { ...arts[idx], descripcion: raw.toUpperCase() };
    }
    const cant = Number(arts[idx]?.cantidad_solicitada) || 0;
    const precio = Number(arts[idx]?.precio_unitario) || 0;
    arts[idx].sub_total = round2(cant * precio);
    const total = calcTotal(arts);
    onChange({ ...value, articulos: arts, total_pedido: total, monto_pedido: total });
  };

  const total = calcTotal(value.articulos || []);
  const numero = value.numero_pedido || nextNumero;

  // Datalists filtrados dinámicamente: rendimiento 100x superior al evitar 5,600 nodos DOM estáticos
  const filteredClientes = useMemo(() => {
    const q = (value.cliente || '').trim().toUpperCase();
    if (!q) return CLIENTES.slice(0, 30);
    return CLIENTES.filter(c => c.nombre.toUpperCase().includes(q) || c.id_cliente.includes(q)).slice(0, 30);
  }, [value.cliente]);

  const filteredCodigosClientes = useMemo(() => {
    const q = (value.id_cliente || '').trim().toUpperCase();
    if (!q) return CLIENTES.slice(0, 30);
    return CLIENTES.filter(c => c.id_cliente.includes(q) || c.nombre.toUpperCase().includes(q)).slice(0, 30);
  }, [value.id_cliente]);

  return (
    <div className="border-2 border-slate-800 bg-white text-slate-900 select-none">
      <datalist id="unidades-list">
        {UNIDADES.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <datalist id="clientes-list">
        {filteredClientes.map((c) => (
          <option
            key={`cli-${c.id_cliente}`}
            value={c.nombre}
            label={`${c.id_cliente}${c.vendedor ? ` (${c.vendedor})` : ''}`}
          />
        ))}
      </datalist>

      <datalist id="codigos-clientes-list">
        {filteredCodigosClientes.map((c) => (
          <option
            key={`cod-${c.id_cliente}`}
            value={c.id_cliente}
            label={`${c.nombre}${c.vendedor ? ` (${c.vendedor})` : ''}`}
          />
        ))}
      </datalist>

      <datalist id="productos-list">
        {PRODUCTOS.map((p) => (
          <option key={`prd-${p.id}`} value={p.descripcion} label={p.id} />
        ))}
      </datalist>

      <datalist id="codigos-productos-list">
        {PRODUCTOS.map((p) => (
          <option key={`pco-${p.id}`} value={p.id} label={p.descripcion} />
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
              list="codigos-clientes-list"
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
          {((value.articulos && value.articulos.length > 0) ? value.articulos : padRows([])).map((item, idx) => {
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
                    list="codigos-productos-list"
                    className={`${cellInput} text-center text-[12px] font-bold`}
                    value={item.codigo || ''}
                    onChange={(e) => handleItemCodigoChange(idx, e.target.value)}
                    onBlur={() => handleItemCodigoBlur(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleItemCodigoBlur(idx);
                    }}
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
                  {!empty && Number(item.sub_total || 0) > 0 ? `$${Number(item.sub_total || 0).toFixed(2)}` : ''}
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
            ${Number(total || 0).toFixed(2)}
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
