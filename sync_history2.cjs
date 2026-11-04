const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const sheetId = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';
const CUTOFF_DATE = '2026-10-31';

function getGids() {
  return new Promise((resolve, reject) => {
    https.get(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const matches = [...data.matchAll(/gid=(\d+)/g)];
        const gids = [...new Set(matches.map(m => m[1]))];
        resolve(gids);
      });
    }).on('error', reject);
  });
}

function downloadCSV(gid) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, r => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(data));
        }).on('error', reject);
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }
    }).on('error', reject);
  });
}

function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let curr = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(curr);
      curr = '';
    } else {
      curr += line[i];
    }
  }
  result.push(curr);
  return result;
}

// Convert DD/MM/YYYY or YYYY-MM-DD to standard YYYY-MM-DD
function standardizeDate(d) {
  if (!d) return null;
  d = d.trim();
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      if (parts[0].length <= 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  return null;
}

async function run() {
  console.log(`Sincronizando historial de pedidos hasta ${CUTOFF_DATE}...`);
  const gids = await getGids();
  console.log(`Encontradas ${gids.length} pestañas en Google Sheet.`);

  let allLines = [];

  // Incluir respaldo local de Octubre 2026 (server/data/sheet.csv)
  const localSheetPath = path.join(__dirname, 'server', 'data', 'sheet.csv');
  if (fs.existsSync(localSheetPath)) {
    const localCsv = fs.readFileSync(localSheetPath, 'utf8');
    const localLines = localCsv.split(/\r?\n/).filter(l => l.trim() !== '');
    if (localLines.length > 0 && localLines[0].toUpperCase().includes('ID PEDIDO')) {
      localLines.shift();
    }
    console.log(`Cargadas ${localLines.length} líneas desde server/data/sheet.csv.`);
    allLines = allLines.concat(localLines);
  }

  for (const gid of gids) {
    const csv = await downloadCSV(gid);
    const lines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) continue;
    if (!lines[0].toUpperCase().includes('ID PEDIDO')) continue;
    lines.shift();
    console.log(`Pestaña ${gid}: ${lines.length} líneas.`);
    allLines = allLines.concat(lines);
  }

  console.log('Total líneas recolectadas:', allLines.length);
  const ordersMap = new Map();

  for (const line of allLines) {
    const cols = parseCSVLine(line.trim());
    if (cols.length < 13) continue;

    const id = (cols[0] || '').replace(/"/g, '').trim();
    if (!id || id.toUpperCase() === 'ID PEDIDO' || id === '1793055537757') continue;

    const fecha = standardizeDate((cols[1] || '').replace(/"/g, '').trim());
    if (!fecha || fecha > CUTOFF_DATE) continue;

    const rawStatus = (cols[14] || '').replace(/"/g, '').trim().toUpperCase();
    const rawReason = (cols[15] || '').replace(/"/g, '').trim();
    const isRejected =
      rawStatus.includes('RECHAZAD') ||
      rawStatus.includes('NO FACTURAD') ||
      rawStatus.includes('ANULAD');

    if (!ordersMap.has(id)) {
      const cliente = (cols[2] || '').replace(/"/g, '').trim();
      const id_cliente = (cols[3] || '').replace(/"/g, '').trim();
      const ruta = (cols[4] || '').replace(/"/g, '').trim();
      const supervisor = (cols[5] || '').replace(/"/g, '').trim();
      const chofer = (cols[6] || '').replace(/"/g, '').trim();
      const observaciones = (cols[7] || '').replace(/"/g, '').trim();
      const declaredTotal = Number((cols[13] || '').replace(/"/g, '').trim() || 0) || 0;

      ordersMap.set(id, {
        id,
        cliente,
        id_cliente,
        ruta,
        supervisor,
        chofer,
        observaciones,
        fecha,
        articulos: [],
        seenArticles: new Set(),
        numero_pedido: id.slice(-5),
        declaredTotal,
        status: isRejected ? 'RECHAZADO' : 'COMPLETADO',
        reject_reason: isRejected ? (rawReason || 'Rechazado en meses anteriores') : null
      });
    } else if (isRejected) {
      const existing = ordersMap.get(id);
      existing.status = 'RECHAZADO';
      existing.reject_reason = rawReason || existing.reject_reason || 'Rechazado en meses anteriores';
    }

    const qty = Number((cols[8] || '').replace(/"/g, '').trim() || 0);
    const unidad = (cols[9] || '').replace(/"/g, '').trim() || 'UNI';
    const desc = (cols[10] || '').replace(/"/g, '').trim();
    const precio = Number((cols[11] || '').replace(/"/g, '').trim() || 0) || 0;
    const rawSub = Number((cols[12] || '').replace(/"/g, '').trim() || 0) || 0;
    const subTotal = qty > 0 && precio > 0 ? Number((qty * precio).toFixed(2)) : Number(rawSub.toFixed(2));

    if (qty > 0 && desc) {
      const ord = ordersMap.get(id);
      const artKey = `${desc}|${qty}|${precio}|${subTotal}`;
      if (!ord.seenArticles.has(artKey)) {
        ord.seenArticles.add(artKey);
        ord.articulos.push({
          codigo: '',
          cantidad_solicitada: qty,
          unidad_medida: unidad,
          descripcion: desc,
          precio_unitario: precio,
          sub_total: subTotal
        });
      }
    }
  }

  const orders = Array.from(ordersMap.values());
  console.log(`Total pedidos históricos únicos (<= ${CUTOFF_DATE}): ${orders.length}`);

  const rowsToUpsert = orders.map(o => {
    const sumArticulos = Number(
      o.articulos.reduce((acc, a) => acc + (Number(a.sub_total) || 0), 0).toFixed(2)
    );
    const finalTotal = o.declaredTotal > 0 ? Number(o.declaredTotal.toFixed(2)) : sumArticulos;
    const createdIso = `${o.fecha}T12:00:00.000Z`;

    const statusHistory = o.status === 'RECHAZADO'
      ? [{
          status: 'RECHAZADO',
          department: 'Sistema',
          changedBy: 'Admin',
          timestamp: createdIso,
          reason: o.reject_reason || 'Rechazado en meses anteriores',
          note: o.reject_reason || 'Rechazado en meses anteriores'
        }]
      : [{
          status: 'COMPLETADO',
          department: 'Facturación',
          changedBy: 'Sistema',
          timestamp: createdIso,
          reason: 'Pedido histórico facturado'
        }];

    const rawOrder = {
      id_cliente: o.id_cliente,
      cliente: o.cliente,
      vendedor: o.ruta,
      vendedores: o.ruta,
      ruta: o.ruta,
      supervisor: o.supervisor,
      chofer: o.chofer,
      observaciones: o.observaciones,
      fecha: o.fecha,
      numero_pedido: o.numero_pedido,
      total_pedido: finalTotal,
      monto_pedido: finalTotal,
      total_renglones: o.articulos.length,
      articulos: o.articulos
    };

    return {
      id: o.id,
      numero_pedido: o.numero_pedido,
      cliente: o.cliente,
      id_cliente: o.id_cliente,
      ruta: o.ruta,
      supervisor: o.supervisor,
      chofer: o.chofer,
      observaciones: o.observaciones,
      fecha: o.fecha,
      articulos: o.articulos,
      total_pedido: finalTotal,
      monto_pedido: finalTotal,
      status: o.status,
      reject_reason: o.reject_reason,
      status_history: statusHistory,
      raw_order: rawOrder,
      created_at: createdIso,
      updated_at: createdIso,
      is_archived: true
    };
  });

  // Incluir pedidos de la última semana de Octubre (26-10-2026 al 31-10-2026) y cadenas procesadas
  const lateOctPath = path.join(__dirname, 'server', 'data', 'octubre_ultima_semana_2026.json');
  if (fs.existsSync(lateOctPath)) {
    const lateOctOrders = JSON.parse(fs.readFileSync(lateOctPath, 'utf8'));
    console.log(`Cargados ${lateOctOrders.length} pedidos de cierre de Octubre (hasta ${CUTOFF_DATE}) desde server/data/octubre_ultima_semana_2026.json.`);
    for (const lo of lateOctOrders) {
      if (!lo || !lo.id || lo.fecha > CUTOFF_DATE) continue;
      rowsToUpsert.push({
        id: lo.id,
        numero_pedido: lo.numero_pedido,
        cliente: lo.cliente,
        id_cliente: lo.id_cliente,
        ruta: lo.ruta,
        supervisor: lo.supervisor || '',
        chofer: lo.chofer || '',
        observaciones: lo.observaciones || '',
        fecha: lo.fecha,
        articulos: lo.articulos || [],
        total_pedido: Number(lo.total_pedido || 0),
        monto_pedido: Number(lo.monto_pedido || lo.total_pedido || 0),
        status: lo.status || 'COMPLETADO',
        reject_reason: lo.reject_reason || null,
        status_history: lo.status_history || [],
        raw_order: lo.raw_order || {},
        created_at: lo.created_at || `${lo.fecha}T16:00:00.000Z`,
        updated_at: lo.updated_at || lo.created_at || `${lo.fecha}T16:00:00.000Z`,
        is_archived: true
      });
    }
  }

  // Eliminar duplicado legado 1793055537757 si existiera
  await supabase.from('orders').delete().eq('id', '1793055537757');

  const BATCH_SIZE = 250;
  let uploaded = 0;
  for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
    const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('orders').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error en lote ${i / BATCH_SIZE + 1}:`, error.message);
      throw error;
    }
    uploaded += batch.length;
    console.log(`Progreso: ${uploaded} / ${rowsToUpsert.length} pedidos históricos cargados...`);
  }

  const completedCount = rowsToUpsert.filter(r => r.status === 'COMPLETADO').length;
  const rejectedCount = rowsToUpsert.filter(r => r.status === 'RECHAZADO').length;
  console.log(`Carga completada exitosamente: ${uploaded} pedidos históricos (Facturados: ${completedCount}, Rechazados: ${rejectedCount}).`);
  process.exit(0);
}

run().catch(err => {
  console.error('Fallo en la carga de historial:', err);
  process.exit(1);
});
