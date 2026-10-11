const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw/htmlview';
https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = [...data.matchAll(/gid=(\d+)/g)];
    const gids = [...new Set(matches.map(m => m[1]))];
    console.log('Found GIDs:', gids);
  });
}).on('error', err => console.error(err));

