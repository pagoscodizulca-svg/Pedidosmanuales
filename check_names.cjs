const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/10ZgsQCo_bIeoDHPENkUIPtHVNBnZAag2-AaFO6C9cXw/htmlview';
https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const names = [...data.matchAll(/"name":"(.*?)"/g)];
    const uniqueNames = [...new Set(names.map(m => m[1]))];
    console.log('Found sheet names:', uniqueNames);
    
    // Also try another regex for sheet names if google sheets html changed
    const alternateNames = [...data.matchAll(/>([^<]+)<\/a><\/li>/g)];
    console.log('Alternate sheet names:', [...new Set(alternateNames.map(m => m[1]))]);
  });
}).on('error', err => console.error(err));
