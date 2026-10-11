const fs = require('fs');
const https = require('https');
const sheetId = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';
const gids = ['2109721203', '1931086704', '792036140', '877239853', '238739897', '2130133439', '1314022048', '1960659635', '1020397937', '2068143851', '875764522', '766844516', '1079374179', '895880905', '1136326469'];
function downloadCSV(gid) {
  return new Promise((resolve) => {
    https.get('https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv&gid=' + gid, (res) => {
      if(res.statusCode===307||res.statusCode===302){
        https.get(res.headers.location, r=>{ let d=''; r.on('data', c=>d+=c); r.on('end', ()=>resolve(d));});
      } else {
        let d=''; res.on('data', c=>d+=c); res.on('end', ()=>resolve(d));
      }
    });
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

function standardizeDate(d) {
  if (!d) return null;
  d = d.trim();
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return d;
}

async function run() {
  const rejected = new Set();
  for(const gid of gids) {
    const csv = await downloadCSV(gid);
    const lines = csv.split('\n');
    for(const l of lines) {
      const u = l.toUpperCase();
      if(u.includes('RECHAZAD') || u.includes('NO FACTURAD') || u.includes('ANULAD')) {
         const cols = parseCSVLine(l);
         if(cols.length > 2 && cols[1]) {
           const raw = cols[1].replace(/"/g, '').trim();
           const fecha = standardizeDate(raw);
           if (fecha && fecha < '2026-10-01' && fecha > '2026-06-01') {
              rejected.add(l);
           }
         }
      }
    }
  }
  console.log('Rejected history lines found:', rejected.size);
  console.log([...rejected].slice(0, 5));
}
run();
