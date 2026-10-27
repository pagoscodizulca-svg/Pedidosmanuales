import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateChainOrders } from '../server/services/chainOrderParser.js';

test('Caso 1 (Real #0054): Orden Alkosto 1 San Felipe (OC 0000055773) normaliza SKUs, unidades y corrige descuadre OCR Bs vs USD', () => {
  const rawAlkosto0054 = {
    id: 'alk-doc-mvposoet-p2q4',
    correlativo: '0054',
    numeroPedido: '0054',
    ordenCompraAlkosto: '0000055773',
    sucursalCodigo: '7498',
    sucursalNombre: 'Alkosto 1 san Felipe',
    estado: 'ENVIADO',
    fechaPedido: '2026-10-26',
    totalUSD: 15470.87,
    observaciones: 'Dirección de despacho; calle 98 CC san Felipe 1 nivel PB sector casco central.',
    createdAt: '2026-10-26T20:06:05.719Z',
    items: [
      {
        id: 'item-1',
        sku: '1496',
        producto: 'MORTADELA DE POLLO DEL CORRAL 1KG',
        presentacion: 'CJ',
        cantidadCajas: 20,
        precioUnitarioUSD: 36,
        subtotalUSD: 6660
      },
      {
        id: 'item-3',
        sku: '5412873178161',
        producto: 'PAPAS FRITAS CONGELADAS MARQUISE 2,5KG',
        presentacion: 'CJ',
        cantidadCajas: 10,
        precioUnitarioUSD: 22.8,
        subtotalUSD: 4788
      },
      {
        id: 'item-4',
        sku: 'QS',
        producto: 'QUESO MOZZARELLA CORLASA X KG',
        presentacion: 'KG',
        cantidadCajas: 45,
        precioUnitarioUSD: 10,
        subtotalUSD: 1500
      }
    ]
  };

  const result = parseAndValidateChainOrders(rawAlkosto0054);
  assert.equal(result.orders.length, 1);

  const ord = result.orders[0];
  assert.equal(ord.id, 'alk-doc-mvposoet-p2q4');
  assert.equal(ord.status, 'POR_VALIDAR');
  assert.equal(ord.cadena, 'ALKOSTO');
  assert.equal(ord.hasFormatError, false);
  assert.equal(ord.orderData.id_cliente, '007498');
  assert.ok(ord.orderData.observaciones?.includes('0000055773'));

  // Verificar mapeo de SKUs y unidades
  assert.equal(ord.orderData.articulos.length, 3);
  assert.equal(ord.orderData.articulos[0].codigo, '001496');
  assert.equal(ord.orderData.articulos[0].unidad_medida, 'BULTO');
  assert.equal(ord.orderData.articulos[0].sub_total, 720); // 20 * 36

  assert.equal(ord.orderData.articulos[1].codigo, '001360'); // EAN 5412873178161 -> 001360
  assert.equal(ord.orderData.articulos[1].unidad_medida, 'BULTO');
  assert.equal(ord.orderData.articulos[1].sub_total, 228); // 10 * 22.8

  assert.equal(ord.orderData.articulos[2].codigo, '000096'); // QS -> 000096
  assert.equal(ord.orderData.articulos[2].unidad_medida, 'KG');
  assert.equal(ord.orderData.articulos[2].sub_total, 450); // 45 * 10

  // Suma real en USD: 720 + 228 + 450 = 1398.00
  assert.equal(ord.orderData.total_pedido, 1398);
  assert.ok(ord.anomalies.length >= 3, 'Debe registrar las correcciones aritméticas de OCR');
});

test('Caso 2 (Real #0053 + Bloqueo Bypass): Orden Alkosto 5 Cabimas (OC 0000055769) con status PENDIENTE_CXC es forzada a POR_VALIDAR', () => {
  const rawAlkosto0053 = {
    id: 'alk-doc-mvpoo8nq-je61',
    correlativo: '0053',
    status: 'PENDIENTE_CXC', // Intento de bypass directo a CxC
    ordenCompraAlkosto: '0000055769',
    sucursalCodigo: '7502',
    sucursalNombre: 'Alkosto 5 - Cabimas',
    fechaPedido: '2026-10-26',
    totalUSD: 17380.5,
    observaciones: 'Cabimas',
    items: [
      {
        sku: '1496',
        producto: 'MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS / 2.40',
        presentacion: 'CJ',
        cantidadCajas: 10,
        precioUnitarioUSD: 20,
        subtotalUSD: 3600
      },
      {
        sku: '1463',
        producto: 'JAMON COCIDO DE PAVO AHUMADO SUPERIOR ASTURIAS X KG / 7.80',
        presentacion: 'KG',
        cantidadCajas: 44,
        precioUnitarioUSD: 6.25,
        subtotalUSD: 2475
      }
    ]
  };

  const result = parseAndValidateChainOrders(rawAlkosto0053);
  assert.equal(result.orders.length, 1);

  const ord = result.orders[0];
  assert.equal(ord.status, 'POR_VALIDAR', 'Toda orden externa debe entrar obligatoriamente en POR_VALIDAR');
  assert.equal(ord.orderData.id_cliente, '007502');
  assert.equal(ord.orderData.articulos[0].descripcion, 'MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS');
  assert.equal(ord.orderData.articulos[0].sub_total, 200); // 10 * 20
  assert.equal(ord.orderData.articulos[1].sub_total, 275); // 44 * 6.25
  assert.equal(ord.orderData.total_pedido, 475);
});

test('Caso 3: Orden de Compra Consolidada de Familia Center (items[].tiendas) se desglosa por sucursal con fechas DD/MM/YYYY y precios con coma', () => {
  const rawFamiliaConsolidated = {
    ordenNro: '0000055165',
    proveedorNombre: 'FAMILIA CENTER, C.A.',
    clienteCadena: 'FAMILIA_CENTER',
    fechaEntrega: '26/10/2026',
    renglones: [
      {
        codigo: '1496',
        descripcion: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
        unid: 'CJ',
        costoUnitario: '20,00',
        tiendas: {
          FC01: 5,
          FC02: 10,
          FC03: 0,
          FC06: 15
        }
      },
      {
        codigo: '1360',
        descripcion: 'PATATAS FRESCAS MARQUISE 4X2.5KG',
        unid: 'CJ',
        costoUnitario: '22,80',
        tiendas: {
          FC01: 2,
          FC02: 0,
          FC06: 5
        }
      }
    ]
  };

  const result = parseAndValidateChainOrders(rawFamiliaConsolidated);
  // FC01, FC02 y FC06 tienen cantidades > 0; FC03 tiene 0 y se omite
  assert.equal(result.orders.length, 3);
  assert.equal(result.validCount, 3);

  const fc01 = result.orders.find(o => o.orderData.id_cliente === '007490')!;
  const fc02 = result.orders.find(o => o.orderData.id_cliente === '007492')!;
  const fc06 = result.orders.find(o => o.orderData.id_cliente === '007493')!;

  assert.ok(fc01 && fc02 && fc06);
  assert.equal(fc01.cadena, 'FAMILIA CENTER');
  assert.equal(fc01.status, 'POR_VALIDAR');
  assert.equal(fc01.orderData.fecha, '2026-10-26');
  assert.equal(fc01.orderData.articulos.length, 2);
  assert.equal(fc01.orderData.total_pedido, 5 * 20 + 2 * 22.8); // 100 + 45.6 = 145.6

  assert.equal(fc02.orderData.articulos.length, 1);
  assert.equal(fc02.orderData.total_pedido, 10 * 20); // 200

  assert.equal(fc06.orderData.articulos.length, 2);
  assert.equal(fc06.orderData.total_pedido, 15 * 20 + 5 * 22.8); // 300 + 114 = 414
});

test('Caso 4: Fallback Tolerante a Fallos (ERROR_FORMATO) registra órdenes de Alkosto/Familia Center con anomalías sin perderlas', () => {
  const malformedFamiliaPayload = {
    id: 'alk-fc-corrupt-001',
    sucursalNombre: 'FAMILIA CENTER 4 - DR QUINTERO',
    ordenCompraAlkosto: '0000055999',
    fechaPedido: 'fecha-invalida',
    items: [] // Sin artículos válidos
  };

  const result = parseAndValidateChainOrders(malformedFamiliaPayload);
  assert.equal(result.orders.length, 1);
  assert.equal(result.errorFormatoCount, 1);

  const errOrder = result.orders[0];
  assert.equal(errOrder.status, 'ERROR_FORMATO');
  assert.equal(errOrder.hasFormatError, true);
  assert.equal(errOrder.cadena, 'FAMILIA CENTER');
  assert.equal(errOrder.orderData.id_cliente, '007491');
  assert.ok(errOrder.cxc_note?.startsWith('ERROR_FORMATO:'));
  assert.equal(errOrder.orderData.articulos.length, 1);
  assert.equal(errOrder.orderData.articulos[0].codigo, 'ERROR');
});

test('Caso 5: Ignora limpiamente pedidos fantasma de pruebas QA (test-int-* / #9999 / OC-TEST-INT)', () => {
  const ghostPayload = {
    id: 'test-int-1793044055592',
    numeroPedido: '9999',
    ordenCompraAlkosto: 'OC-TEST-INT-999',
    sucursalNombre: 'Alkosto 01 - Zona Industrial',
    items: []
  };

  const result = parseAndValidateChainOrders(ghostPayload);
  assert.equal(result.orders.length, 0);
  assert.equal(result.ignoredTestCount, 1);
});

test('Caso 6: Lote completo de 7 pedidos en ráfaga desde APP FDV (FC01 a FC07) preserva el 100% de los 7 pedidos sin omitir intermedios', () => {
  const batch7Orders = [
    { id: 'alk-fc01-batch7', correlativo: '0061', ordenCompraAlkosto: '0000055800', sucursalCodigo: '7490', sucursalNombre: 'Familia Center 1 - Plaza Lago', direccionEntrega: 'Plaza Lago', estado: 'ENVIADO', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 10, precioUnitarioUSD: 36, subtotalUSD: 360 }] },
    { id: 'alk-fc02-batch7', correlativo: '0062', ordenCompraAlkosto: '0000055800', sucursalCodigo: '7492', sucursalNombre: 'Familia Center 2 - Urb Monte Claro', direccionEntrega: 'Calle 43 Urb Monte Claro', estado: 'PENDIENTE', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 15, precioUnitarioUSD: 36, subtotalUSD: 540 }] },
    { id: 'alk-fc03-batch7', correlativo: '0063', ordenCompraAlkosto: '0000055800', sucursalCodigo: '7494', sucursalNombre: 'Familia Center 3 - Coquivacoa', direccionEntrega: 'Calle J con Av 12 Coquivacoa', estado: 'EN_ESPERA', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 20, precioUnitarioUSD: 36, subtotalUSD: 720 }] },
    { id: 'alk-fc04-batch7', correlativo: '0064', ordenCompraAlkosto: '0000055800', sucursalCodigo: '7491', sucursalNombre: 'Familia Center 4 - Dr Quintero', direccionEntrega: 'Dr Quintero', estado: 'POR VALIDAR', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 12, precioUnitarioUSD: 36, subtotalUSD: 432 }] },
    { id: 'alk-fc05-batch7', correlativo: '0065', ordenCompraAlkosto: '0000055800', sucursalCodigo: '7489', sucursalNombre: 'Familia Center 5 - La Lago', direccionEntrega: 'La Lago', estado: 'POR_VALIDAR', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 8, precioUnitarioUSD: 36, subtotalUSD: 288 }] },
    { id: 'alk-fc06-batch7', correlativo: '0066', ordenCompraAlkosto: '0000055800', sucursalCodigo: '7493', sucursalNombre: 'Familia Center 6 - Los Olivos', direccionEntrega: 'Los Olivos', estado: 'RECIBIDO', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 25, precioUnitarioUSD: 36, subtotalUSD: 900 }] },
    { id: 'alk-fc07-batch7', correlativo: '0067', ordenCompraAlkosto: '0000055800', sucursalCodigo: '8229', sucursalNombre: 'Familia Center 7 - San Francisco', direccionEntrega: 'San Francisco', estado: 'ENVIADO', items: [{ sku: '21', producto: 'MORTADELA DE POLLO DEL CORRAL 1KG', presentacion: 'CJ', cantidadCajas: 30, precioUnitarioUSD: 36, subtotalUSD: 1080 }] }
  ];

  const result = parseAndValidateChainOrders(batch7Orders);
  assert.equal(result.orders.length, 7, 'Deben procesarse los 7 pedidos del lote al 100%');
  assert.equal(result.validCount, 7);
  assert.equal(result.errorFormatoCount, 0);

  for (const o of result.orders) {
    assert.equal(o.status, 'POR_VALIDAR');
    assert.equal(o.cadena, 'FAMILIA CENTER');
    assert.equal(o.orderData.numero_oc, '0000055800');
    assert.ok(o.orderData.direccion_despacho && o.orderData.direccion_despacho.length > 0);
    assert.equal(o.orderData.articulos.length, 1);
    assert.ok((o.orderData.total_pedido ?? 0) > 0);
  }
});
