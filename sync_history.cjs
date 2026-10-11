const https = require('https');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const sheetId = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';
const gids = ['2109721203', '1931086704', '792036140', '877239853', '238739897', '2130133439', '1314022048', '1960659635', '1020397937', '2068143851', '875764522', '766844516', '1079374179', '895880905', '1136326469'];

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

async function run() {
  let allLines = [];
  for(const gid of gids) {
    console.log('Downloading GID', gid);
    const csv = await downloadCSV(gid);
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    // remove header
    if(lines.length > 0 && lines[0].includes('ID PEDIDO')) lines.shift();
    allLines = allLines.concat(lines);
  }
  
  console.log('Total CSV lines:', allLines.length);
  
  const ordersMap = new Map();
  
  for(const line of allLines) {
    const cols = parseCSVLine(line.trim());
    if(cols.length < 13) continue;
    
    // Cols: ID PEDIDO,FECHA,CLIENTE,ID CLIENTE,VENDEDOR (RUTA),SUPERVISOR,CHOFER,OBSERVACIONES,CANT.,UND,DESCRIPCION,PRECIO,SUB-TOTAL,TOTAL PEDIDO
    const id = cols[0].replace(/"/g, '');
    const fecha = cols[1].replace(/"/g, '');
    
    // Only import older data
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
  
  if (orders.length === 0) {
    console.log("No orders before October found in this sheet.");
    return;
  }

  let success = 0;
  for(const o of orders) {
    const createdDate = new Date(o.fecha);
    createdDate.setHours(12, 0, 0, 0);

    const { data, error } = await supabase.from('orders').upsert({
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
    if(error) console.error(error);
    else success++;
  }
  
  console.log('Finished uploading. Success:', success);
}
run();
