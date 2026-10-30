import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { OrderData, ArticuloItem } from '../../src/types.js';
import { PRODUCTOS as CATALOGO_PRODUCTOS } from '../../src/data/productos.js';

const router = Router();
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
type ClienteEntry = { id_cliente: string; nombre: string; vendedor: string };
type ProductoEntry = { id_producto: string; descripcion: string };

let CLIENTS: ClienteEntry[] = [];
const CLIENT_BY_ID = new Map<string, ClienteEntry>();
const CLIENT_BY_NUM = new Map<number, ClienteEntry>();
const CLIENT_BY_NAME = new Map<string, ClienteEntry>();

let PRODUCTOS: ProductoEntry[] = [];
const PRODUCTO_BY_ID = new Map<string, ProductoEntry>();
const PRODUCTO_BY_NUM = new Map<number, ProductoEntry>();
const PRODUCTO_BY_DESC = new Map<string, ProductoEntry>();

try {
  const p = path.resolve(__dirname, '../data/clientes.json');
  if (fs.existsSync(p)) {
    CLIENTS = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const c of CLIENTS) {
      const id = c.id_cliente.trim().toUpperCase();
      CLIENT_BY_ID.set(id, c);
      CLIENT_BY_ID.set(id.padStart(6, '0'), c);
      const n = Number(id);
      if (!Number.isNaN(n) && n > 0) CLIENT_BY_NUM.set(n, c);
      CLIENT_BY_NAME.set(c.nombre.trim().toUpperCase(), c);
    }
  }
} catch (e) {
  console.warn('[parse] Error cargando catálogo de clientes:', e);
}

try {
  const prodPath = path.resolve(__dirname, '../../src/data/productos.json');
  if (fs.existsSync(prodPath)) {
    PRODUCTOS = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
  } else if (Array.isArray(CATALOGO_PRODUCTOS) && CATALOGO_PRODUCTOS.length > 0) {
    PRODUCTOS = CATALOGO_PRODUCTOS.map((p) => ({
      id_producto: p.id,
      descripcion: p.descripcion,
    }));
  }
  for (const pr of PRODUCTOS) {
    const id = pr.id_producto.trim().toUpperCase();
    PRODUCTO_BY_ID.set(id, pr);
    PRODUCTO_BY_ID.set(id.padStart(6, '0'), pr);
    const n = Number(id);
    if (!Number.isNaN(n) && n > 0) PRODUCTO_BY_NUM.set(n, pr);
    PRODUCTO_BY_DESC.set(pr.descripcion.trim().toUpperCase(), pr);
  }
} catch (e) {
  console.warn('[parse] Error cargando catálogo de productos:', e);
}

function findClientFast(code?: string, name?: string): ClienteEntry | undefined {
  if (code && code.trim()) {
    const raw = code.trim().toUpperCase();
    const padded = raw.padStart(6, '0');
    const direct = CLIENT_BY_ID.get(raw) || CLIENT_BY_ID.get(padded);
    if (direct) return direct;
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) {
      const byNum = CLIENT_BY_NUM.get(n);
      if (byNum) return byNum;
    }
  }
  if (name && name.trim()) {
    const cleanName = name.trim().toUpperCase();
    const exact = CLIENT_BY_NAME.get(cleanName);
    if (exact) return exact;
    // Si escribieron el código dentro del campo cliente
    if (/^\d{1,6}$/.test(cleanName)) {
      const byCode = CLIENT_BY_ID.get(cleanName.padStart(6, '0')) || CLIENT_BY_NUM.get(Number(cleanName));
      if (byCode) return byCode;
    }
    if (cleanName.length >= 4) {
      for (const c of CLIENTS) {
        const upper = c.nombre.toUpperCase();
        if (upper.includes(cleanName) || cleanName.includes(upper)) return c;
      }
    }
  }
  return undefined;
}

function enrichOrderWithClient(order: Partial<OrderData>) {
  if (!CLIENTS.length) return;
  const match = findClientFast(order.id_cliente, order.cliente);
  if (match) {
    order.id_cliente = match.id_cliente;
    order.cliente = match.nombre;
    if (!order.ruta && match.vendedor) {
      order.ruta = match.vendedor;
    }
  }
}

function enrichOrderWithProducts(order: Partial<OrderData>) {
  if (!order.articulos || !Array.isArray(order.articulos)) return;
  for (const art of order.articulos) {
    const rawCode = (art.codigo || '').trim().toUpperCase();
    const rawDesc = (art.descripcion || '').trim().toUpperCase();
    let matchedProd: ProductoEntry | undefined;

    if (rawCode) {
      matchedProd =
        PRODUCTO_BY_ID.get(rawCode) ||
        PRODUCTO_BY_ID.get(rawCode.padStart(6, '0')) ||
        (Number(rawCode) > 0 ? PRODUCTO_BY_NUM.get(Number(rawCode)) : undefined);
    }
    if (!matchedProd && rawDesc) {
      matchedProd = PRODUCTO_BY_DESC.get(rawDesc);
    }
    if (matchedProd) {
      art.codigo = matchedProd.id_producto;
      if (!rawDesc) {
        art.descripcion = matchedProd.descripcion;
      }
    } else if (rawCode && /^\d{1,6}$/.test(rawCode)) {
      art.codigo = rawCode.padStart(6, '0');
    }
  }
}

const UNIT_MAP: Record<string, string> = {
  kg: 'KG', kgs: 'KG', kilo: 'KG', kilos: 'KG',
  und: 'UNIDAD', unid: 'UNIDAD', uni: 'UNIDAD', unidad: 'UNIDAD', unidades: 'UNIDAD', un: 'UNIDAD',
  bto: 'BULTO', btos: 'BULTO', bulto: 'BULTO', bultos: 'BULTO',
  pza: 'PIEZA', pzas: 'PIEZA', pz: 'PIEZA', pieza: 'PIEZA', piezas: 'PIEZA',
};

const ALLOWED_UNITS = new Set(['UNIDAD', 'BULTO', 'PIEZA', 'KG']);

function normalizeUnidad(raw?: string): string {
  if (!raw) return '';
  const clean = raw.trim().toLowerCase().replace(/\./g, '');
  if (UNIT_MAP[clean]) return UNIT_MAP[clean];
  const upper = clean.toUpperCase();
  return ALLOWED_UNITS.has(upper) ? upper : '';
}

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
  order.id_cliente = grab(/(?:id|c[oó]digo|cod\.?)\s*(?:de\s*)?(?:cliente)?[:\s]+(\d{1,6})/i);

  const unitAlt = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length).join('|');
  const itemRe = new RegExp(
    String.raw`^\s*[-•*]?\s*(\d+(?:[.,]\d+)?)\s*(${unitAlt})?\.?\s+(?:\[?#?(\d{1,6})\]?\s+)?(.+?)(?:\s+(?:a|@|x|precio|por)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?)?\s*$`,
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

  enrichOrderWithClient(order);
  enrichOrderWithProducts(order);
  return order;
}

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
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
      "unidad_medida": "UNIDAD" | "BULTO" | "PIEZA" | "KG" | "",
      "codigo": string (código entre corchetes o numérico si existe),
      "descripcion": string (en MAYÚSCULAS),
      "precio_unitario": number (0 si no se indica)
    }
  ]
}

IMPORTANTE: Revisa el siguiente catálogo de productos. Si un artículo del mensaje coincide (parcialmente, por nombre o marca), asigna su codigo y descripcion EXACTOS del catálogo:
CATÁLOGO:
- 000009 : FILETE DE PECHUGA A GRANEL POR KG
- 000021 : MORTADELA ESP D/POLLO CORRAL 1X12UNI
- 000028 : HUEVOS DE CONSUMO TUNAL TIPO A 1X12UNI
- 000073 : GALLINA DESNUDA POR KG
- 000090 : COSTILLA
- 000096 : QUESO MOZZARELLA ESPECIAL EL LUCERO (E)
- 000130 : POLLO CORRAL POR KG
- 000151 : QUESO MOZARELLA EN BARRA DOÑA FLORA
- 000170 : TOCINETA AHUM S/CUERO ALIMEX X KG
- 000171 : JAMON COC. SUPERIOR ALIMEX 1X5.9KG
- 000172 : ESPALDA COCIDA ALIMEX 1X4.6KG
- 000174 : MORTADELA TAPARA ALIMEX DE 6X3.5KG
- 000176 : SALCHICHA VIENA ALIMEX 8 X 800 GRS
- 000177 : SALCHICHA VIENA ALIMEX 16 X 450 GRS
- 000179 : LECHE COMPLETA PURISIMA1X12LTRS
- 000180 : LECHE DESCREMADA PURISIMA1X12LTS
- 000181 : JUGO DE NARANJA EL TUNAL 1X12LTRS
- 000182 : NECTAR DE MANZANA EL TUNAL 1X12LTRS
- 000183 : NECTAR DE PERA EL TUNAL 1X12LTRS
- 000184 : NECTAR DE DURAZNO EL TUNAL 1X12LTRS
- 000185 : TE CON LIMON EL TUNAL 1X12LTRS
- 000186 : TE CON DURAZNO EL TUNAL 1X12LTRS
- 000241 : ESPAL. AHUM T/VISKING ALIMEX 6X3.2
- 000242 : LECHE DESLACTOSADA PURISIMA1X12LT
- 000302 : MANTEQUILLA CON SAL PURISIMA BARRA 18X200GR
- 000337 : JAMON COCIDO ESTANDAR ITALICO X KG
- 000340 : CHULETA AHUMADA ALIMEX X KG
- 000353 : MAYONESA MAVESA 445 GRS X 12 UND
- 000354 : MARGARINA MAVESA 500 GRS X 12 UND
- 000360 : KETCHUP PAMPERO 397 GRS X 24 UND
- 000388 : MAVESA ADEREZO MAYONESA 3.6GX4UN
- 000390 : PAMPERO SALSA TOMATE 4.2KGX4UN
- 000393 : MOLLEJA (EMPACADA)
- 000419 : CHULETA LOYS (DE)
- 000439 : ESPAL AHUM.T/AREPERO ALIMEX 12X1,6KG
- 000469 : HUEVOS ESTUCH. PLAST. TUNAL 12 X 30
- 000518 : PASTA PREMIUM TIPO VERMICELLI 12X1KG
- 000629 : MUSLO CUADRIL DESPRESADO POR KG
- 000630 : ALAS DESPRESADAS POR KG
- 000631 : FILET FRESCO DESPRESADO POR KG (E)
- 000632 : CARCASA DESPRESADA POR KG
- 000642 : QUESO PARMESANO X KG
- 000657 : BISTEC (DE)
- 000663 : COSTILLA Y LAGARTO(DE)
- 000668 : CARNE MOLIDA (DE)
- 000669 : CARNE PARA GUISAR (DE)
- 000670 : CARNE PARA MECHAR (DE)
- 000676 : FILET DE PECHUGA EN BANDEJA (DE)
- 000681 : FILET EN BOLSA CONG DESPRESADO POR KG
- 000687 : CUADRIL DESPRESADO POR KG
- 000688 : PIERNITAS DESPRESADA POR KG
- 000699 : MUSLO DESPRESADO EN BANDEJA
- 000829 : FILETE DE PECHUGA PROAGRO A GRANEL 5 KG
- 000860 : SALCHICHAS VIENA ALIMEX 32 X 225GRS
- 000870 : HIGADO (EMPACADO)
- 000891 : COSTILLA DE CERDO (DE)
- 000922 : HUEVOS DE CONSUMO TUNAL TIPO B 1X12UNI
- 000927 : MORTADELA ESP. CARACAS 10X900GRS
- 000934 : PULPA DE CERDO DEPOSTADA
- 000952 : HUEVOS DE CONSUMO CLASE B 1X12 UND
- 000973 : HARINA DE MAIZ 1X20UNID
- 000979 : HUEVOS DE CONSUMO CLASE A 1X12UNID
- 000993 : HUEVOS CONSUMO EXTRA TUNAL 1X12UNI
- 000995 : ESPAL. AHUM T/VISKING ITALICO 6UNDX3.2KG
- 001051 : MORTADELA ESP. CARACAS 10X500GRS
- 001057 : QUESO AMARILLO ESPECIAL
- 001088 : CHULETA FRESCA IBERICO POR KG
- 001089 : CREMA DE LECHE PURISIMA 12X250GRS
- 001091 : CREMA DE LECHE PURISIMA 6 X 500 GRS
- 001098 : JUGO DE NARANJA EL TUNAL 27X200ML
- 001099 : NECTAR DE MANZANA EL TUNAL 27X200ML
- 001100 : NECTAR DE PERA EL TUNAL 27X200ML
- 001103 : MANTEQUILLA SIN SAL PURISIMA 18X200GR
- 001181 : NECTAR DE DURAZNO EL TUNAL 27X200ML
- 001206 : ARROZ GLORIA CLASICO 24X1KG
- 001241 : POLLO ENTERO JUAN POLLO POR KG
- 001242 : MORT. CHORIZO ESPECIAL CDZ X KG
- 001250 : NECTAR DE PERA EL TUNAL12 X 500ML
- 001251 : NECTAR DE DURAZNO EL TUNAL 12 X 500ML
- 001259 : MORTADELA T/ESPECIAL MAXI CARACAS 6UNDX3.3KG
- 001264 : BANDEJA ECOTRAY NEGRA 1X100 UND
- 001268 : LECHE BARISTA PURISIMA 1X12 LTRS
- 001276 : FILET ESP. MILANESA SUPREMA POR KG
- 001277 : MUSLO ESPECIAL SIN CADERA POR KG
- 001311 : NECTAR DE MANZANA LIGHT EL TUNAL 1X12LTRS
- 001312 : NECTAR DE PERA LIGHT EL TUNAL 1X12LTRS
- 001314 : CREMA DE LECHE MONTE ADENTRO 32 X 250GR
- 001326 : MOLLEJAS LOS LLANOS POR KG
- 001334 : HIGADO (GRANEL) LOS LLANOS
- 001342 : ARROZ GLORIA PREMIUM 24X900GR
- 001343 : POLLO ESPECIAL DE 1RA LOS LLANOS (E)
- 001360 : PATATAS FRESCAS MARQUISE 4X2.5KG
- 001381 : HUEVOS ESTUCH PULPA EL TUNAL 15 X 20
- 001409 : FILET DE PECHUGA LOS LLANOS POR KG
- 001419 : ACEITE DE SOYA DIANA 12X760ML
- 001428 : FILET DE PECHUGA TIPO A CONGELADO POR KG
- 001441 : PAN HPM BLANCO GLUTEN FREE 1KGX20UND
- 001445 : TOCINO FRESCO ASTURIAS X KG
- 001446 : CHULETA FRESCA ASTURIAS POR KG
- 001456 : FS TOCINETA FRESCA ASTURIAS POR KG
- 001457 : FS CHULETA FRESCA ASTURIAS POR KG
- 001459 : FS QUESO MOZZARELA EL LUCERO POR KG
- 001461 : MORT ESTANDAR ASTURIAS X KG
- 001462 : MORT. ESPECIAL COCIDA ASTURIAS X KG
- 001463 : MORT. SUPERIOR ASTURIAS X KG
- 001464 : MORT NAVIDEÑA ASTURIAS XKG
- 001467 : FS MORT. ESTANDAR ASTURIAS POR KG
- 001468 : FS MORT ESPECIAL COCIDA ASTURIAS POR KG
- 001471 : FS MORT NAVIDEÑA ASTURIAS POR KG
- 001472 : FS MORT SUPERIOR ASTURIAS POR KG
- 001477 : RECORTE DE CHARCUTERIA POR KG
- 001478 : POLLO LLANERITO POR KG
- 001479 : ACEITE DE SOYA DIANA 12X900ML
- 001489 : AZUCAR REFINADA D CASTA 1KGX20UND
- 001493 : GATORADE 500X12UND
- 001494 : MORTADELA ESP D/POLLO LOS LLANOS 10UNDX900GR
- 001496 : MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR
- 001503 : CHURRASCO DE MUSLO POR KG
- 001504 : CHUPETICA DE POLLO POR KG
- 001507 : AZUCAR BLANCA ESPERANZA 1X20ND
- 001511 : MORT. PECHUGA DE POLLO ASTURIAS X KG
- 001512 : MORT DE PAVO ASTURIAS X KG
- 001515 : LECHE POLVO COMPLETA PURISIMA 24X200GRS
- 001516 : LECHE POLVO COMPLETA PURISIMA 24X400GR
- 001517 : LECHE POLVO COMPLETA PURISIMA 12X900GRS
- 001519 : MORTADELA ESP D/POLLO SALPICAO 10UNDX900GR
- 001521 : MORT. ECONOM COCIDA ASTURIAS X KG
- 001522 : MORT. TIPO AREPERO ASTURIAS X KG
- 001524 : POLLO BRASA POR KG
- 001536 : LECHE EN POLVO VENCAMPO 10X1KG
- 001543 : AZUCAR BLANCA VENCAMPO 1X20ND
- 001549 : ARROZ BLANCO VENCAMPO 24X900GR
- 001551 : ACEITE VENCAMPO 12X900ML
- 001556 : LECHE EN POLVO VENCAMPO 10X900GR
- 001561 : MORT. PAVO TIPO SHOULDER ASTURIAS POR KG
- 001562 : MORT. ESPECIAL COCIDA SALPICAO X KG
- 001563 : MORT. ESTANDAR SALPICAO X KG
- 001564 : MORTADELA EXTRA ASTURIAS X KG
- 001565 : FS MORT PECHUGA DE PAVO ASTURIAS POR KG
- 001568 : POLLO VENCAMPO POR KG
- 001569 : PATATAS FRESCAS DOBLE COBERTURA 4X2.5KG
- 001571 : AZUCAR VENCAMPO 1X20ND
- 001572 : CAJAS DE PIZZA 1X100
- 001574 : LECHE EN POLVO VENCAMPO 10X400GR
- 001575 : QUESO MOZZARELLA CORLASA 3.5KG X 4 UND
- 001576 : QUESO CREMA KRAFT 1.36 KG X 6 UND
- 001577 : QUESO CREMA KRAFT 226 GR X 36 UND
- 001578 : ARROZ BLANCO VENCAMPO 24X1KG
- 001579 : LECHE EN POLVO VENCAMPO 10X500GR
- 001581 : FS QUESO MOZZARELLA CORLASA X KG
- 001584 : REFRESCO 355ML X 16UND
- 001585 : AGUA MINERAL 300ML X 24UND
- 001586 : PAN DE HAMBURGUESA POR PAQUETE
- 001587 : JUGO PASTERIZADO 250ML X 24UND
- 001588 : REFRESCO 400ML X 15 UND
- 001589 : QUESO PECORINO DE MI FINCA X KG
- 001591 : QUESO AMARILLO TIPO EDAM BARRA DE MI FINCA X KG
- 001592 : SALMON POR KILO

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
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    if (!response.text) throw new Error('Respuesta vacía de Gemini');

    const cleanedText = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanedText);
    (parsed.articulos || []).forEach((art: any) => {
      art.cantidad_solicitada = Number(art.cantidad_solicitada) || 0;
      art.precio_unitario = Number(art.precio_unitario) || 0;
      art.unidad_medida = normalizeUnidad(art.unidad_medida);
      art.sub_total = Math.round(art.cantidad_solicitada * art.precio_unitario * 100) / 100;
    });
    enrichOrderWithClient(parsed);
    enrichOrderWithProducts(parsed);
    return res.json(parsed);
  } catch (error: any) {
    console.warn('[parse] Fallback heurístico:', error?.message || error);
    return res.json(regexFallbackParse(text));
  }
});

export default router;
