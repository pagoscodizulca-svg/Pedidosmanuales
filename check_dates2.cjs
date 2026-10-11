const https = require('https');
const sheetId = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';
const gids = ['2109721203', '1931086704', '792036140', '877239853', '238739897', '2130133439', '1314022048', '1960659635', '1020397937', '2068143851', '875764522', '766844516', '1079374179', '895880905', '1136326469'];

function downloadCSV(gid) {
  return new Promise((resolve) => {
    https.get(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`, (res) => {
      if(res.statusCode===307||res.statusCode===302){
        https.get(res.headers.location, r=>{ let d=''; r.on('data', c=>d+=c); r.on('end', ()=>resolve(d));});
      } else {
        let d=''; res.on('data', c=>d+=c); res.on('end', ()=>resolve(d));
      }
    });
  });
}

async function run() {
  const rawLateSeptDates = new Set();
  
  for(const gid of gids) {
    const csv = await downloadCSV(gid);
    const lines = csv.split('\n');
    for(const l of lines) {
      const cols = l.split(',');
      if(cols.length > 1) {
        const d = cols[1].replace(/"/g, '');
        if(d.includes('09') || d.includes('9/')) {
           rawLateSeptDates.add(d);
        }
      }
    }
  }
  console.log('All raw dates with 9 in them:', [...rawLateSeptDates].sort());
}
run();
