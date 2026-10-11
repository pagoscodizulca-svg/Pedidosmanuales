const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const https = require('https');

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

async function run() {
  console.log('Fetching latest GIDs...');
  const gids = await getGids();
  
  const statusUpdates = new Map();
  const historyUpdates = new Map();
  
  for(const gid of gids) {
    const csv = await downloadCSV(gid);
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    
    for(const line of lines) {
      const cols = parseCSVLine(line.trim());
      if(cols.length < 14) continue;
      
      const id = cols[0].replace(/"/g, '').trim();
      const rawStatus = (cols[14] || '').replace(/"/g, '').trim().toUpperCase();
      const rawReason = (cols[15] || '').replace(/"/g, '').trim();
      
      if (!id || id === 'ID PEDIDO') continue;
      
      if (rawStatus.includes('RECHAZAD') || rawStatus.includes('NO FACTURAD') || rawStatus.includes('ANULAD')) {
         statusUpdates.set(id, 'RECHAZADO');
         
         const rejectionNote = rawReason || 'Rechazado en meses anteriores';
         // We must construct a status_history array
         historyUpdates.set(id, [{
            status: 'RECHAZADO',
            department: 'Sistema',
            changedBy: 'Admin',
            timestamp: new Date().toISOString(),
            note: rejectionNote
         }]);
      }
    }
  }
  
  console.log('Total orders to update as RECHAZADO:', statusUpdates.size);
  
  let success = 0;
  for (const [id, status] of statusUpdates) {
    const history = historyUpdates.get(id);
    
    const { error } = await supabase
      .from('orders')
      .update({ 
         status: status,
         status_history: history
      })
      .eq('id', id);
      
    if (!error) success++;
  }
  
  console.log('Finished updating statuses. Success:', success);
}
run();
