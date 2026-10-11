import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import type { OrderData, ArticuloItem } from '../../src/types.js';

const router = Router();
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const UNIT_MAP: Record<string, string> = {
  kg: 'KG', kgs: 'KG', kilo: 'KG', kilos: 'KG',
  und: 'UND', unid: 'UND', unidad: 'UND', unidades: 'UND', un: 'UND',
  bto: 'BTOS', btos: 'BTOS', bulto: 'BTOS', bultos: 'BTOS',
  caja: 'CAJAS', cajas: 'CAJAS', cj: 'CAJAS', cjs: 'CAJAS',
  paq: 'PAQ', paquete: 'PAQ', paquetes: 'PAQ', pqt: 'PAQ',
  lt: 'LTS', lts: 'LTS', litro: 'LTS', litros: 'LTS',
};

const today = () => new Date().toLocaleDateString('en-CA');
const num = (s?: string) => (s ? Number(s.replace(',', '.')) || 0 : 0);

/** Motor heurístico local (sin IA) para mensajes de WhatsApp / Telegram. */
function regexFallbackParse(text: string): Partial<OrderData> {
  const order: Partial<OrderData> = { cliente: '', fecha: today(), articulos: [] };
  const clean = text.replace(/\r/g, '');

  const grab = (re: RegExp) => clean.match(re)?.[1]?.trim();

  order.cliente = grab(/(?<!id\s)cliente[:\s]+(.+?)(?=\s+ruta\b|\s+vendedor\b|,|\n|$)/i) || '';
  order.ruta = grab(/(?:ruta|vendedor)[:\s]+(.+?)(?=\s+supervisor\b|\s+chofer\b|,|\n|$)/i);
  order.supervisor = grab(/supervisor[:\s]+([^\n,]+)/i);
  order.chofer = grab(/chofer[:\s]+([^\n,]+)/i);
  order.observaciones = grab(/(?:observaci[oó]n(?:es)?|obs|direcci[oó]n)[:\s]+([^\n]+)/i);
  order.id_cliente = grab(/(?:id|c[oó]digo)\s*(?:de\s*)?cliente[:\s]+(\S+)/i);

  const unitAlt = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length).join('|');
  const itemRe = new RegExp(
    String.raw`^\s*[-•*]?\s*(\d+(?:[.,]\d+)?)\s*(${unitAlt})?\.?\s+(?:\[?#?(\d{2,6})\]?\s+)?(.+?)(?:\s+(?:a|@|x|precio|por)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?)?\s*$`,
    'i'
  );

  for (const line of clean.split('\n')) {
    const m = line.match(itemRe);
    if (!m) continue;
    const cantidad = num(m[1]);
    const precio = num(m[5]);
    const item: ArticuloItem = {
      cantidad_solicitada: cantidad,
      unidad_medida: m[2] ? UNIT_MAP[m[2].toLowerCase()] : '',
      codigo: m[3] || '',
      descripcion: m[4].trim().toUpperCase(),
      precio_unitario: precio,
      sub_total: Math.round(cantidad * precio * 100) / 100,
    };
    order.articulos!.push(item);
  }

  return order;
}

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const prompt = `
Eres un asistente que extrae pedidos de ventas (distribuidora de alimentos en Venezuela) desde mensajes de WhatsApp/Telegram.
Devuelve EXCLUSIVAMENTE un objeto JSON con este esquema:
{
  "cliente": string (en MAYÚSCULAS),
  "id_cliente": string (opcional),
  "ruta": string (vendedor/ruta, opcional),
  "supervisor": string (opcional),
  "chofer": string (opcional),
  "observaciones": string (dirección u observaciones, opcional),
  "fecha": "YYYY-MM-DD" (si no se indica usa ${today()}),
  "articulos": [
    {
      "cantidad_solicitada": number,
      "unidad_medida": "UND" | "KG" | "BTOS" | "CAJAS" | "PAQ" | "LTS" | "",
      "codigo": string (código entre corchetes o numérico si existe),
      "descripcion": string (en MAYÚSCULAS),
      "precio_unitario": number (0 si no se indica)
    }
  ]
}

IMPORTANTE: Revisa el siguiente catálogo de productos. Si un artículo del mensaje coincide (parcialmente, por nombre o marca), asigna su codigo y descripcion EXACTOS del catálogo:
CATÁLOGO:
- 000008 : POLLO EBENEZER POR KG
- 000069 : GALLINA ENTERA POR KG
- 000073 : GALLINA DESNUDA POR KG
- 000130 : POLLO CORRAL POR KG
- 001241 : POLLO ENTERO JUAN POLLO POR KG
- 001343 : POLLO ESPECIAL DE 1RA LOS LLANOS (E)
- 001478 : POLLO LLANERITO POR KG
- 001568 : POLLO VENCAMPO POR KG
- 000046 : NUGGETS INSTITUCIONAL CORRAL POR KG
- 000270 : NUGGETS CORRAL 12X0.460GR
- 001360 : PATATAS FRESCAS MARQUISE 4X2.5KG
- 001569 : PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG

Mensaje:
"""
${text}
"""
`;

  try {
    if (!ai) throw new Error('GEMINI_API_KEY no configurada, usando motor local');

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) throw new Error('Respuesta vacía de Gemini');

    const parsed = JSON.parse(response.text);
    (parsed.articulos || []).forEach((art: any) => {
      art.cantidad_solicitada = Number(art.cantidad_solicitada) || 0;
      art.precio_unitario = Number(art.precio_unitario) || 0;
      art.unidad_medida = (art.unidad_medida || '').toUpperCase();
      art.sub_total = Math.round(art.cantidad_solicitada * art.precio_unitario * 100) / 100;
    });
    return res.json(parsed);
  } catch (error: any) {
    console.warn('[parse] Fallback heurístico:', error?.message || error);
    return res.json(regexFallbackParse(text));
  }
});

export default router;
