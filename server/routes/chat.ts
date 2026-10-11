import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Declaraciones de Herramientas para Codibot
const toolsDeclarations = [
  {
    name: 'buscar_pedidos',
    description: 'Busca pedidos aplicando uno o varios filtros combinados (numero_pedido, cliente, id_cliente, vendedor/ruta, status, producto). Úsala para cualquier consulta sobre pedidos o clientes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        numero_pedido: { type: 'STRING', description: 'Número de pedido exacto o parcial (ej: 100258, 4550)' },
        cliente: { type: 'STRING', description: 'Nombre o parte del nombre del cliente (ej: ALKOSTO, INVERSIONES)' },
        id_cliente: { type: 'STRING', description: 'Código o ID del cliente (ej: 2333, 8314)' },
        vendedor: { type: 'STRING', description: 'Nombre del vendedor o ruta (ej: MARYERY GARCÍA, DANIEL DEL GALLEGO)' },
        status: { type: 'STRING', description: 'Estatus del pedido (POR_VALIDAR, PENDIENTE_CXC, PENDIENTE_FACTURACION, COMPLETADO, RECHAZADO)' },
        producto: { type: 'STRING', description: 'Nombre o código de producto para buscar en los artículos del pedido' },
        limite: { type: 'INTEGER', description: 'Cantidad máxima de pedidos a traer (máx 15, default 8)' }
      }
    }
  },
  {
    name: 'obtener_detalle_pedido',
    description: 'Obtiene el desglose completo 360° de artículos, notas de rechazo y observaciones de un pedido específico por su número.',
    parameters: {
      type: 'OBJECT',
      properties: {
        numero_pedido: { type: 'STRING', description: 'Número exacto de pedido (ej: 100258, 100207)' }
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

// Ejecutor de Herramientas de Base de Datos
async function executeTool(name: string, args: any) {
  try {
    if (name === 'buscar_pedidos') {
      let q = supabase
        .from('orders')
        .select('numero_pedido, cliente, id_cliente, ruta, status, total_pedido, monto_pedido, created_at, reject_reason, cxc_note, fact_note, observaciones, articulos');

      if (args.numero_pedido) {
        q = q.ilike('numero_pedido', `%${String(args.numero_pedido).trim()}%`);
      }
      if (args.cliente) {
        q = q.ilike('cliente', `%${String(args.cliente).trim()}%`);
      }
      if (args.id_cliente) {
        q = q.ilike('id_cliente', `%${String(args.id_cliente).trim()}%`);
      }
      if (args.vendedor) {
        q = q.ilike('ruta', `%${String(args.vendedor).trim()}%`);
      }
      if (args.status && args.status !== 'TODOS') {
        q = q.eq('status', String(args.status).trim().toUpperCase());
      }

      const limit = Math.min(args.limite || 8, 20);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);

      if (error) return { error: error.message };

      let results = data || [];
      if (args.producto) {
        const prodLower = String(args.producto).toLowerCase();
        results = results.filter(order => {
          if (!Array.isArray(order.articulos)) return false;
          return order.articulos.some(a => 
            (a.descripcion && String(a.descripcion).toLowerCase().includes(prodLower)) ||
            (a.codigo && String(a.codigo).includes(prodLower))
          );
        });
      }

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
      const num = String(args.numero_pedido).trim();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .ilike('numero_pedido', `%${num}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return { error: 'No se encontró el pedido #' + num };

      return {
        numero_pedido: data.numero_pedido,
        cliente: data.cliente,
        id_cliente: data.id_cliente,
        vendedor: data.ruta,
        supervisor: data.supervisor,
        chofer: data.chofer,
        status: data.status,
        total_pedido: data.total_pedido || data.monto_pedido,
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
        q = q.ilike('ruta', `%${String(args.vendedor).trim()}%`);
      }
      if (args.status) {
        q = q.eq('status', String(args.status).trim().toUpperCase());
      }

      const { data, error } = await q.limit(1000);
      if (error) return { error: error.message };

      const rows = data || [];
      let totalDolares = 0;
      const porStatus: Record<string, number> = {};
      const porVendedor: Record<string, number> = {};

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
  } catch (err: any) {
    return { error: err?.message || 'Error al consultar base de datos' };
  }
}

router.post('/', async (req, res) => {
  const { query } = req.body; 
  if (!query) return res.status(400).json({ error: 'Query is required' });
  if (!ai) return res.json({ response: 'El bot está en modo local sin conexión de IA.' });

  const systemInstruction = `Eres Codibot, el Asistente Oficial de Inteligencia de Negocios y Operaciones del sistema de Pedidos Manuales de Codizulca.
Tu misión es asistir a los analistas de Ventas, Cuentas por Cobrar (CxC), Facturación y Auditoría con respuestas 100% exactas, verificables y profesionales.
TIENES ACCESO DIRECTO A LA BASE DE DATOS DE CODIZULCA a través de tus herramientas:
- 'buscar_pedidos': para buscar pedidos filtrando por cliente, número de pedido, vendedor, status o producto.
- 'obtener_detalle_pedido': para ver el desglose completo de productos, precios y notas de un pedido puntual.
- 'resumen_metricas_ventas': para consultar totales generales, montos acumulados en dólares o conteos de pedidos.

REGLAS CRÍTICAS DE RESPUESTA:
1. NUNCA inventes números de pedido, nombres de clientes ni montos. SIEMPRE consulta tus herramientas antes de responder.
2. Si un pedido fue RECHAZADO, menciona con claridad la nota o motivo de rechazo ('nota_rechazo') para que el analista sepa la razón.
3. Si te preguntan por un pedido específico, indica su número (#), cliente, estatus, monto ($), vendedor y fecha.
4. Si te piden los artículos, enuméralos claramente con cantidad, descripción y precio/monto.
5. Si no se encuentra un resultado, responde amablemente indicando qué datos faltan o sugiriendo alternativas de búsqueda.
6. Usa formato Markdown elegante: viñetas (*), negritas (**), encabezados y tablas si es conveniente.`;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolsDeclarations }]
      }
    });

    let response = await chat.sendMessage({ message: query });

    // Loop multi-turn para ejecutar Function Calls (hasta 3 turnos)
    let turns = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && turns < 3) {
      turns++;
      const call = response.functionCalls[0];
      const toolResult = await executeTool(call.name, call.args);

      response = await chat.sendMessage({
        message: [{
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        }]
      });
    }

    return res.json({ response: response.text });
  } catch (err: any) {
    console.error('[chat] Error en Gemini:', err?.message || err);
    return res.status(500).json({ error: 'Hubo un error al procesar tu solicitud con Gemini.' });
  }
});

export default router;
