const http = require('http');

http.get('http://localhost:3000/api/analytics/product?desc=ARROZ', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${data.substring(0, 500)}...`);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
