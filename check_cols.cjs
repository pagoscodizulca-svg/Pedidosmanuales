const https = require('https');
const sheetId = '10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw';
const gid = '2109721203'; // Just grab the first one
https.get(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`, (res) => {
  if (res.statusCode === 307 || res.statusCode === 302) {
    https.get(res.headers.location, r => {
      let data = '';
      r.on('data', chunk => data += chunk);
      r.on('end', () => console.log('Columns:', data.split('\n')[0]));
    });
  }
});
