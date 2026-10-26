export interface ArticuloItem {
  codigo?: string;
  descripcion: string;
  cantidad_solicitada: number;
  cantidad_despachada?: number;
  unidad_medida?: string;
  precio_unitario: number;
  sub_total: number;
}

export interface OrderData {
  id_cliente?: string;
  cliente: string;
  numero_pedido?: string;
  ruta?: string;
  supervisor?: string;
  chofer?: string;
  observaciones?: string;
  fecha: string;
  total_pedido?: number;
  monto_pedido?: number;
  sucursal?: string;
  origen?: string;
  cantidad_cestas?: number;
  articulos: ArticuloItem[];
}

export interface StatusHistoryItem {
  status: "CREADO" | "POR_VALIDAR" | "ERROR_FORMATO" | "MODIFICADO_VENTAS_REENVIADO" | "PENDIENTE_CXC" | "PENDIENTE_FACTURACION" | "COMPLETADO" | "RECHAZADO";
  department: "Ventas" | "Cuentas por Cobrar" | "Facturación" | "Auditoría" | "Sistema";
  changedBy: string;
  timestamp: string;
  reason?: string;
}

export type OrderStatus = "POR_VALIDAR" | "ERROR_FORMATO" | "PENDIENTE_CXC" | "PENDIENTE_FACTURACION" | "COMPLETADO" | "RECHAZADO" | "SISTEMA";

export interface DbOrder {
  id: string;
  status: OrderStatus;
  order: OrderData;
  createdAt: string;
  updatedAt?: string;
  sucursal?: string;
  version?: number;
  isModified?: boolean;
  isArchived?: boolean;
  rejectReason?: string;
  cxcNote?: string;
  factNote?: string;
  statusHistory: StatusHistoryItem[];
}
