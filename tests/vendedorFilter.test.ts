import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNombre,
  matchVendedor,
  buildGroupedVendedorOptions,
  getZonasForVendedor,
} from '../src/utils/vendedorFilter';
import { VENDEDORES } from '../src/data/vendedores';
import type { DbOrder } from '../src/types';

function mockOrder(id: string, ruta: string): DbOrder {
  return {
    id,
    status: 'PENDIENTE_CXC',
    createdAt: '2026-10-29T12:00:00.000Z',
    updatedAt: '2026-10-29T12:00:00.000Z',
    statusHistory: [],
    order: {
      cliente: 'CLIENTE PRUEBA',
      id_cliente: '000001',
      ruta,
      supervisor: '',
      observaciones: '',
      fecha: '2026-10-29',
      articulos: [],
      total_pedido: 100,
      monto_pedido: 100,
    },
  };
}

test('normalizeNombre convierte a minúsculas, quita tildes/puntuación y colapsa espacios', () => {
  assert.deepEqual(normalizeNombre('  Juan   Carlos  Pérez-Gómez. '), [
    'juan',
    'carlos',
    'perez',
    'gomez',
  ]);
  assert.deepEqual(normalizeNombre('MARÍA BRICEÑO / SALA'), ['maria', 'briceno', 'sala']);
  assert.deepEqual(normalizeNombre(''), []);
  assert.deepEqual(normalizeNombre(null), []);
  assert.deepEqual(normalizeNombre(undefined), []);
});

test('matchVendedor soporta las 4 combinaciones (2N+2A, 1N+1A seguidos/salteados, 1N, 1A) de forma bidireccional', () => {
  const full = 'Juan Carlos Pérez Gómez';
  const variants = [
    'JUAN CARLOS PEREZ GOMEZ',
    'Juan Pérez',
    'Juan Gómez',
    'Carlos Pérez',
    'Carlos Gómez',
    'Juan',
    'Carlos',
    'Pérez',
    'Gómez',
    'perez',
    'gomez',
  ];

  for (const variant of variants) {
    assert.equal(
      matchVendedor(variant, full),
      true,
      `Esperaba true cuando pedido="${variant}" y seleccionado="${full}"`,
    );
    assert.equal(
      matchVendedor(full, variant),
      true,
      `Esperaba true cuando pedido="${full}" y seleccionado="${variant}"`,
    );
  }
});

test('matchVendedor previene colisiones entre vendedores distintos que comparten nombre o apellido', () => {
  assert.equal(matchVendedor('Juan Pérez', 'Juan Rodríguez'), false);
  assert.equal(matchVendedor('Juan Pérez', 'Juan Gómez'), false);
  assert.equal(matchVendedor('Juan Pérez', 'Juan Carlos Rodríguez Silva'), false);
  assert.equal(matchVendedor('Carlos Fuenmayor', 'Carlos Machado'), false);
  assert.equal(matchVendedor('Carlos Fuenmayor', 'Carlos Moreno'), false);
  assert.equal(matchVendedor('Juan Hernandez', 'Juan Pablo Araujo'), false);
  assert.equal(matchVendedor('Mariangel Gonzalez', 'Jose Gregorio Gonzalez'), false);
  assert.equal(matchVendedor('Angelica Moreno', 'Carlos Moreno'), false);
  assert.equal(matchVendedor('Maria Briceño', 'Mariana Chacin'), false);
  assert.equal(matchVendedor('CUENTAS CLAVE 1', 'CUENTAS CLAVE 2'), false);
  assert.equal(matchVendedor('FOOD SERVICE SUR', 'FOOD SERVICE NORTE'), false);
  assert.equal(matchVendedor('JAIDER MEDINA - FOOD SERVICE', 'FOOD SERVICE SUR'), false);
});

test('matchVendedor resuelve todas las variantes reales de producción en public.orders.ruta', () => {
  assert.equal(matchVendedor('ADEL JAVID JARABA VELAZQUEZ', 'Adel Jaraba'), true);
  assert.equal(matchVendedor('ADEL JARABA', 'ADEL JAVID JARABA VELAZQUEZ'), true);
  assert.equal(matchVendedor('OSCAR D ORTIZ H', 'Oscar Ortiz'), true);
  assert.equal(matchVendedor('OSCAR ORTIZ- CORO', 'OSCAR D ORTIZ H'), true);
  assert.equal(matchVendedor('Jose Gregorio Gonzalez', 'Jose G. Gonzalez'), true);
  assert.equal(matchVendedor('JOSE G', 'JOSE GREGORIO GONZALEZ'), true);
  assert.equal(matchVendedor('J PABLO ARAUJO - CAB/OJE', 'JUAN PABLO ARAUJO'), true);
  assert.equal(matchVendedor('JUAN PABLO ARAUJO', 'Pablo Araujo'), true);
  assert.equal(matchVendedor('MARIA BRICENO SALA', 'Maria Briceño'), true);
  assert.equal(matchVendedor('LUIS  GUANIPA', 'LUIS GUSTAVO GUANIPA LÓPEZ'), true);
  assert.equal(matchVendedor('luis Gustavo', 'LUIS GUSTAVO GUANIPA LÓPEZ'), true);
  assert.equal(
    matchVendedor('CUENTAS CLAVE 2 - SAIRU VALLES', 'SAIRÚ CHIQUINQUIRA VALLES MONTIEL'),
    true,
  );
  assert.equal(
    matchVendedor('SAIRU VALLES / CUENTAS CLAVE 2', 'SAIRÚ CHIQUINQUIRA VALLES MONTIEL'),
    true,
  );
  assert.equal(matchVendedor('JAIDER MEDINA - FOOD SERVICE NORTE', 'JAIDER MEDINA'), true);
  assert.equal(matchVendedor('DANIEL GALLEGO', 'DANIEL DEL GALLEGO'), true);
  assert.equal(matchVendedor('DANIEL DEL GALLEGO FOOD SERVICE SUR', 'DANIEL DEL GALLEGO'), true);
});

test('buildGroupedVendedorOptions agrupa variantes en el nombre más completo sin mezclar homónimos', () => {
  const sampleOrders: DbOrder[] = [
    mockOrder('1', 'Juan Pérez'),
    mockOrder('2', 'Carlos Gómez'),
    mockOrder('3', 'Juan Carlos Pérez Gómez'),
    mockOrder('4', 'Pérez'),
    mockOrder('5', 'MARIA BRICENO SALA'),
    mockOrder('6', 'MARIA BRICEÑO'),
    mockOrder('7', 'CARLOS FUENMAYOR'),
    mockOrder('8', 'CARLOS MACHADO'),
    mockOrder('9', 'CARLOS'),
    mockOrder('10', 'JAIDER MEDINA - FOOD SERVICE NORTE'),
  ];

  const options = buildGroupedVendedorOptions(sampleOrders, ['Maria Briceño']);
  const labels = options.map((o) => o.label);

  assert.equal(labels.includes('JUAN CARLOS PÉREZ GÓMEZ'), true);
  assert.equal(labels.includes('JUAN PÉREZ'), false);
  assert.equal(labels.includes('CARLOS GÓMEZ'), false);
  assert.equal(labels.includes('PÉREZ'), false);

  // Enriquecimiento ortográfico con Ñ en la versión más completa
  assert.equal(labels.includes('MARIA BRICEÑO SALA'), true);
  assert.equal(labels.includes('MARIA BRICEÑO'), false);

  // Homónimos se mantienen separados y absorben "CARLOS" sin crear opción suelta ni fusionarse
  assert.equal(labels.includes('CARLOS FUENMAYOR'), true);
  assert.equal(labels.includes('CARLOS MACHADO'), true);
  assert.equal(labels.includes('CARLOS'), false);

  // Sufijos de canal se limpian en la etiqueta del vendedor
  assert.equal(labels.includes('JAIDER MEDINA'), true);
  assert.equal(labels.includes('JAIDER MEDINA - FOOD SERVICE NORTE'), false);
});

test('getZonasForVendedor conserva las zonas puntuales con nombres canónicos extendidos', () => {
  assert.deepEqual(getZonasForVendedor('JUAN PABLO ARAUJO', VENDEDORES), [
    'Venado',
    'Bachaquero',
    'Cabimas',
    'Ojeda',
    'Mene Grande',
  ]);
  assert.deepEqual(getZonasForVendedor('MARIA BRICEÑO SALA', VENDEDORES), ['Zona Sur', 'Cañada']);
  assert.deepEqual(getZonasForVendedor('MARYERY GARCÍA', VENDEDORES), ['Ojeda', 'Cabimas']);
});
