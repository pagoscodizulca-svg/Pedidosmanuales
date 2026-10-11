const http = require('http');

const data = JSON.stringify({
  cliente: "FAMILIA CENTER (TEST WEBHOOK)",
  ruta: "SAIRU VALLES",
  observaciones: "Prueba técnica de integración",
  origen: "FAMILIA CENTER",
  articulos: [
    {
      codigo: "TEST-01",
      descripcion: "PRODUCTO DE PRUEBA APP FDV",
      cantidad_solicitada: 5,
      precio_unitario: 10,
      sub_total: 50
    }
  ],
  total_pedido: 50
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/integrations/fdv',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'codizulca-secret-2026',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let responseBody = '';
  res.on('data', (chunk) => { responseBody += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', responseBody);
  });
});

req.on('error', (e) => {
  console.error('Error con la petición:', e.message);
});

req.write(data);
req.end();
