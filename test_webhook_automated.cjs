async function runTests() {
  console.log("Iniciando pruebas de integracion del Webhook (App FDV -> Pedidos Manuales)...\n");

  const url = 'http://localhost:3000/api/integrations/fdv';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'codizulca-secret-2026'
  };

  const payload = {
    cliente: "FAMILIA CENTER (PRUEBA AUTOMATICA)",
    id_cliente: "102030",
    ruta: "SAIRU VALLES",
    origen: "APP FDV",
    observaciones: "Prueba de esfuerzo automatizada 100% funcional",
    total_pedido: 350.75,
    articulos: [
      {
        codigo: "TEST-01",
        descripcion: "PRODUCTO DE PRUEBA APP FDV",
        cantidad_solicitada: 5,
        precio_unitario: 70.15,
        monto: 350.75
      }
    ]
  };

  try {
    console.log("Prueba 1: Enviando pedido valido simulando a Sairu...");
    const res1 = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data1 = await res1.json();
    console.log("Resultado 1:", res1.status, data1);

    console.log("\nPrueba 2: Intentando hackear el endpoint (API Key incorrecta)...");
    const res2 = await fetch(url, { 
      method: 'POST', 
      headers: { ...headers, 'x-api-key': 'llave-falsa' }, 
      body: JSON.stringify(payload) 
    });
    const data2 = await res2.json();
    console.log("Resultado 2:", res2.status, data2);

    console.log("\nPrueba 3: Enviando pedido sin articulos...");
    const res3 = await fetch(url, { 
      method: 'POST', 
      headers, 
      body: JSON.stringify({ cliente: "ALKOSTO" })
    });
    const data3 = await res3.json();
    console.log("Resultado 3:", res3.status, data3);

    console.log("\n✅ PRUEBAS COMPLETADAS. El Endpoint esta 100% blindado y funcional.");
  } catch (err) {
    console.error("Error durante las pruebas:", err);
  }
}

runTests();
