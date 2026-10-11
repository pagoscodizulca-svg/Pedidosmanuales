const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const toolsDeclarations = [
  {
    name: 'buscar_pedidos',
    description: 'Busca pedidos aplicando uno o varios filtros combinados (numero_pedido, cliente, id_cliente, vendedor/ruta, status, producto). Úsala para cualquier consulta sobre pedidos o clientes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        numero_pedido: { type: 'STRING', description: 'Número de pedido exacto o parcial (ej: 100258)' },
        cliente: { type: 'STRING', description: 'Nombre o parte del nombre del cliente (ej: ALKOSTO, INVERSIONES)' },
        id_cliente: { type: 'STRING', description: 'Código o ID del cliente (ej: 2333, 8314)' },
        vendedor: { type: 'STRING', description: 'Nombre del vendedor o ruta (ej: MARYERY GARCÍA, DANIEL DEL GALLEGO)' },
        status: { type: 'STRING', description: 'Estatus del pedido (POR_VALIDAR, PENDIENTE_CXC, PENDIENTE_FACTURACION, COMPLETADO, RECHAZADO)' },
        producto: { type: 'STRING', description: 'Nombre o código de producto para buscar en los artículos del pedido' },
        limite: { type: 'INTEGER', description: 'Cantidad máxima de pedidos a traer (máx 15, default 5)' }
      }
    }
  },
  {
    name: 'obtener_detalle_pedido',
    description: 'Obtiene el detalle completo y desglose de artículos de un pedido específico por su número.',
    parameters: {
      type: 'OBJECT',
      properties: {
        numero_pedido: { type: 'STRING', description: 'Número exacto de pedido (ej: 100257)' }
      },
      required: ['numero_pedido']
    }
  },
  {
    name: 'resumen_metricas_ventas',
    description: 'Calcula totales acumulados, conteo de pedidos y montos monetarios en dólares ($) agrupados por estatus o por vendedor.',
    parameters: {
      type: 'OBJECT',
      properties: {
        vendedor: { type: 'STRING', description: 'Nombre del vendedor específico si se requiere (opcional)' },
        status: { type: 'STRING', description: 'Estatus específico si se requiere (opcional)' }
      }
    }
  }
];

async function handleToolCall(name, args) {
  console.log(`[Tool Call] ${name}:`, args);

  if (name === 'buscar_pedidos') {
    let q = supabase
      .from('orders')
      .select('numero_pedido, cliente, id_cliente, ruta, status, total_pedido, monto_pedido, created_at, reject_reason, cxc_note, fact_note, observaciones, articulos');

    if (args.numero_pedido) {
      q = q.ilike('numero_pedido', `%${args.numero_pedido.trim()}%`);
    }
    if (args.cliente) {
      q = q.ilike('cliente', `%${args.cliente.trim()}%`);
    }
    if (args.id_cliente) {
      q = q.ilike('id_cliente', `%${args.id_cliente.trim()}%`);
    }
    if (args.vendedor) {
      q = q.ilike('ruta', `%${args.vendedor.trim()}%`);
    }
    if (args.status && args.status !== 'TODOS') {
      q = q.eq('status', args.status.trim().toUpperCase());
    }

    const limit = Math.min(args.limite || 8, 20);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);

    if (error) return { error: error.message };

    // Si filtraron por producto, filtrar en memoria sobre los articulos
    let results = data || [];
    if (args.producto) {
      const prodLower = args.producto.toLowerCase();
      results = results.filter(order => {
        if (!Array.isArray(order.articulos)) return false;
        return order.articulos.some(a => 
          (a.descripcion && a.descripcion.toLowerCase().includes(prodLower)) ||
          (a.codigo && String(a.codigo).includes(prodLower))
        );
      });
    }

    // Resumir articulos para no saturar el contexto de la IA
    const cleanResults = results.map(r => ({
      numero_pedido: r.numero_pedido,
      cliente: r.cliente,
      id_cliente: r.id_cliente,
      vendedor: r.ruta,
      status: r.status,
      total_pedido: r.total_pedido || r.monto_pedido,
      fecha: r.created_at,
      observaciones: r.observaciones,
      nota_rechazo: r.reject_reason,
      nota_cxc: r.cxc_note,
      cantidad_articulos: Array.isArray(r.articulos) ? r.articulos.length : 0,
      resumen_articulos: Array.isArray(r.articulos) ? r.articulos.map(a => `${a.cantidad_solicitada || 0}x ${a.descripcion} ($${a.sub_total || a.monto || 0})`).slice(0, 5) : []
    }));

    return { total_encontrados: cleanResults.length, pedidos: cleanResults };
  }

  if (name === 'obtener_detalle_pedido') {
    const num = args.numero_pedido.trim();
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('numero_pedido', `%${num}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return { error: 'No se encontró el pedido ' + num };

    return {
      numero_pedido: data.numero_pedido,
      cliente: data.cliente,
      id_cliente: data.id_cliente,
      vendedor: data.ruta,
      supervisor: data.supervisor,
      chofer: data.chofer,
      status: data.status,
      total_pedido: data.total_pedido,
      fecha: data.created_at,
      observaciones: data.observaciones,
      nota_rechazo: data.reject_reason,
      nota_cxc: data.cxc_note,
      nota_facturacion: data.fact_note,
      articulos: data.articulos || []
    };
  }

  if (name === 'resumen_metricas_ventas') {
    let q = supabase.from('orders').select('ruta, status, total_pedido, monto_pedido');
    if (args.vendedor) {
      q = q.ilike('ruta', `%${args.vendedor.trim()}%`);
    }
    if (args.status) {
      q = q.eq('status', args.status.trim().toUpperCase());
    }

    const { data, error } = await q.limit(1000);
    if (error) return { error: error.message };

    const rows = data || [];
    let totalDolares = 0;
    const porStatus = {};
    const porVendedor = {};

    rows.forEach(r => {
      const monto = parseFloat(r.total_pedido || r.monto_pedido || 0);
      totalDolares += isNaN(monto) ? 0 : monto;
      porStatus[r.status] = (porStatus[r.status] || 0) + 1;
      const v = (r.ruta || 'Sin Vendedor').trim();
      porVendedor[v] = (porVendedor[v] || 0) + 1;
    });

    return {
      pedidos_evaluados: rows.length,
      monto_total_usd: totalDolares.toFixed(2),
      distribucion_status: porStatus,
      top_vendedores: Object.entries(porVendedor).sort((a,b) => b[1] - a[1]).slice(0, 5)
    };
  }

  return { error: 'Herramienta no reconocida' };
}

async function testAsk(question) {
  console.log(`\n========================================`);
  console.log(`PREGUNTA: "${question}"`);
  console.log(`========================================`);

  const systemInstruction = `Eres Codibot, el Asistente Oficial de Inteligencia de Negocios y Operaciones del sistema de Pedidos Manuales de Codizulca.
Tu misión es asistir a los analistas de Ventas, Cuentas por Cobrar (CxC), Facturación y Auditoría con respuestas 100% exactas, verificables y profesionales.
TIENES ACCESO DIRECTO A LA BASE DE DATOS de Codizulca a través de tus herramientas:
- 'buscar_pedidos': para buscar pedidos filtrando por cliente, número de pedido, vendedor, status, o producto.
- 'obtener_detalle_pedido': para ver el desglose completo de productos de un pedido puntual.
- 'resumen_metricas_ventas': para consultar totales generales, montos en dólares o conteos de pedidos.

REGLAS CRÍTICAS DE RESPUESTA:
1. NUNCA inventes números de pedido, nombres de clientes ni montos. SIEMPRE consulta tus herramientas antes de responder.
2. Si un pedido fue RECHAZADO, menciona claramente la 'nota_rechazo' para que el analista sepa el motivo.
3. Si te preguntan por un pedido específico, indica su número (#), cliente, estatus, monto ($), vendedor y fecha.
4. Si te piden los artículos, enuméralos claramente con cantidad, descripción y precio/monto.
5. Usa formato Markdown elegante: viñetas (*), negritas (**), encabezados y tablas si es conveniente.`;

  const chat = ai.chats.create({
    model: 'gemini-3.1-pro-preview',
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: toolsDeclarations }]
    }
  });

  let response = await chat.sendMessage({ message: question });

  // Ciclo de Function Calling (hasta 3 iteraciones)
  let turns = 0;
  while (response.functionCalls && response.functionCalls.length > 0 && turns < 3) {
    turns++;
    const call = response.functionCalls[0];
    const toolResult = await handleToolCall(call.name, call.args);

    response = await chat.sendMessage({
      message: [{
        functionResponse: {
          name: call.name,
          response: toolResult
        }
      }]
    });
  }

  console.log('\nRESPUESTA DE CODIBOT:');
  console.log(response.text);
}

async function runAllTests() {
  await testAsk("¿Cuál es el estatus del pedido 100258, quién es el cliente y qué productos pidió?");
  await testAsk("¿Qué pedidos tiene el cliente con ID 2333?");
  await testAsk("¿Cuántos pedidos hay y cuánto se ha vendido en total?");
}

runAllTests().catch(console.error);
