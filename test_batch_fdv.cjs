require('dotenv').config();

async function testBatchFDV() {
  console.log('--- Probando Webhook FDV con Orden de Compra Multi-Sucursal ---');

  // Simulamos una orden de compra enviada por Sairu que contiene 4 tiendas: 2 de Alkosto y 2 de Familia Center
  const payloadMulti = {
    orden_compra: "OC-77890",
    ruta: "SAIRU VALLES",
    pedidos: [
      {
        cliente: "ALKOSTO 1 SAN FELIPE",
        id_cliente: "7498",
        articulos: [
          { codigo: "1496", descripcion: "MORTADELA ESP D/POLLO ASTURIAS", cantidad_solicitada: 50, precio_unitario: 20, sub_total: 1000 }
        ]
      },
      {
        cliente: "ALKOSTO 4 COROMOTO",
        id_cliente: "7500",
        articulos: [
          { codigo: "1360", descripcion: "PATATAS FRESCAS MARQUISE 4X2.5KG", cantidad_solicitada: 30, precio_unitario: 22.8, sub_total: 684 }
        ]
      },
      {
        cliente: "FAMILIA CENTER 1 PLAZA LAGO",
        id_cliente: "7490",
        articulos: [
          { codigo: "POLLO-01", descripcion: "POLLO VENCAMPO POR KG", cantidad_solicitada: 400, precio_unitario: 2.55, sub_total: 1020 }
        ]
      },
      {
        cliente: "FAMILIA CENTER 3 COQUIVACOA",
        id_cliente: "7494",
        articulos: [
          { codigo: "POLLO-01", descripcion: "POLLO VENCAMPO POR KG", cantidad_solicitada: 600, precio_unitario: 2.55, sub_total: 1530 }
        ]
      }
    ]
  };

  const res = await fetch('http://localhost:3000/api/integrations/fdv', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'codizulca-secret-2026'
    },
    body: JSON.stringify(payloadMulti)
  });

  const data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Respuesta del Webhook:', JSON.stringify(data, null, 2));
}

testBatchFDV();
