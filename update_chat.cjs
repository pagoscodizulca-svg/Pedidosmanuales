const fs = require('fs');

const code = \import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const buscarPedidosDeclarations = {
  name: 'buscar_pedidos',
  description: 'Busca pedidos en la base de datos por un campo especifico. Usa esto para responder consultas sobre pedidos puntuales o de un cliente/vendedor.',
  parameters: {
    type: 'OBJECT',
    properties: {
      campo: { type: 'STRING', description: 'El campo a buscar en la BD (ej. numero_pedido, cliente, ruta, status)' },
      valor: { type: 'STRING', description: 'El valor exacto o parcial a buscar' },
      limite: { type: 'INTEGER', description: 'Cantidad maxima de resultados, por defecto 5' }
    },
    required: ['campo', 'valor']
  }
};

router.post('/', async (req, res) => {
  const { query } = req.body; // Ya no necesitamos ordersData masivo
  if (!query) return res.status(400).json({ error: 'Query is required' });
  if (!ai) return res.json({ response: 'El bot esta en modo local.' });

  const systemInstruction = \\\Eres el Codibot, el Asistente Oficial del sistema de Pedidos Manuales de Codizulca.
Tu objetivo es ayudar a los usuarios (Ventas, CxC, Facturacion, Auditoria) a encontrar informacion.
Tienes acceso a la base de datos a traves de la herramienta 'buscar_pedidos'. SIEMPRE usala si te preguntan por un pedido especifico, un cliente, o los pedidos de un vendedor.
REGLAS:
1. Responde de forma clara, amable y concisa.
2. Si el pedido no esta, indicalo cortesmente.
3. Menciona el estatus del pedido, vendedor, y fechas si son relevantes.
4. Usa listas con viñetas (bullets), negritas y separaciones de linea (Markdown) para estructurar tu respuesta de forma sumamente facil de leer. No envies bloques de texto densos.\\\;

  try {
    const chat = ai.chats.create({
       model: 'gemini-2.5-flash',
       config: {
         systemInstruction,
         tools: [{ functionDeclarations: [buscarPedidosDeclarations] }]
       }
    });

    let response = await chat.sendMessage({ message: query });

    if (response.functionCalls && response.functionCalls.length > 0) {
       const call = response.functionCalls[0];
       if (call.name === 'buscar_pedidos') {
          const campo = call.args.campo;
          const valor = call.args.valor;
          const limite = call.args.limite || 5;

          const { data, error } = await supabase
             .from('orders')
             .select('numero_pedido, cliente, ruta, status, total_pedido, fecha, articulos')
             .ilike(campo, \\\%\\\%\\\)
             .limit(limite)
             .order('created_at', { ascending: false });

          response = await chat.sendMessage({
             message: [{
               functionResponse: {
                 name: 'buscar_pedidos',
                 response: { result: data || [], error: error?.message }
               }
             }]
          });
       }
    }

    return res.json({ response: response.text });
  } catch (err) {
    console.error('[chat] Error en Gemini:', err?.message || err);
    return res.status(500).json({ error: 'Hubo un error al procesar tu solicitud con Gemini.' });
  }
});

export default router;
\;

fs.writeFileSync('server/routes/chat.ts', code, 'utf8');
console.log('chat.ts updated to use Function Calling!');

