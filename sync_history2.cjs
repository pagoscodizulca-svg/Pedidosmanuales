const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const sheetId = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';

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
      if (res.statusCode === 307 || res.statusCode === 302) {
        https.get(res.headers.location, r => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(data));
        });
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
  for(let i=0; i<line.length; i++){
    if(line[i] === '"') {
      inQuotes = !inQuotes;
    } else if(line[i] === ',' && !inQuotes) {
      result.push(curr);
      curr = '';
    } else {
      curr += line[i];
    }
  }
  result.push(curr);
  return result;
}

// Convert DD/MM/YYYY or YYYY-MM-DD to standard Date string or YYYY-MM-DD
function standardizeDate(d) {
  if (!d) return null;
  d = d.trim();
  // if it's DD/MM/YYYY
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      // assume DD/MM/YYYY
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return d;
}

async function run() {
  console.log('Fetching latest GIDs...');
  const gids = await getGids();
  console.log(`Found ${gids.length} tabs in Google Sheet.`);
  
  let allLines = [];
  for(const gid of gids) {
    console.log('Downloading tab:', gid);
    const csv = await downloadCSV(gid);
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    if(lines.length > 0 && lines[0].includes('ID PEDIDO')) lines.shift();
    allLines = allLines.concat(lines);
  }
  
  console.log('Total CSV lines:', allLines.length);
  const ordersMap = new Map();
  
  for(const line of allLines) {
    const cols = parseCSVLine(line.trim());
    if(cols.length < 13) continue;
    
    const id = cols[0].replace(/"/g, '').trim();
    let fecha = cols[1].replace(/"/g, '').trim();
    fecha = standardizeDate(fecha);
    
    if(!fecha || fecha >= '2026-10-01') continue;
    
    if(!ordersMap.has(id)) {
      ordersMap.set(id, {
        id: id,
        cliente: cols[2].replace(/"/g, ''),
        id_cliente: cols[3].replace(/"/g, ''),
        ruta: cols[4].replace(/"/g, ''),
        supervisor: cols[5].replace(/"/g, ''),
        chofer: cols[6].replace(/"/g, ''),
        observaciones: cols[7].replace(/"/g, ''),
        fecha: fecha,
        articulos: [],
        numero_pedido: id.slice(-5),
        total_pedido: Number(cols[13]?.replace(/"/g, '') || 0) || 0
      });
    }
    
    const qty = Number(cols[8]?.replace(/"/g, '') || 0);
    if(qty > 0) {
      ordersMap.get(id).articulos.push({
        cantidad_solicitada: qty,
        unidad_medida: cols[9].replace(/"/g, ''),
        descripcion: cols[10].replace(/"/g, ''),
        precio_unitario: Number(cols[11]?.replace(/"/g, '') || 0),
        sub_total: Number(cols[12]?.replace(/"/g, '') || 0)
      });
    }
  }
  
  const orders = Array.from(ordersMap.values());
  console.log('Parsed valid old orders:', orders.length);
  
  // Upsert
  let success = 0;
  for(const o of orders) {
    const createdDate = new Date(o.fecha);
    createdDate.setHours(12, 0, 0, 0);

    const { error } = await supabase.from('orders').upsert({
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
      total_pedido: o.total_pedido,
      monto_pedido: o.total_pedido,
      status: 'COMPLETADO',
      created_at: createdDate.toISOString(),
      is_archived: true
    });
    if(!error) success++;
  }
  
  console.log('Finished uploading. Success:', success);
}
run();
