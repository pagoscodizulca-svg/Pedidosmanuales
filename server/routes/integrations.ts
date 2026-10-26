import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { parseAndValidateChainOrders } from '../services/chainOrderParser.js';

const router = Router();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Autenticación por API Key estática para integraciones externas (x-api-key: codizulca-secret-2026)
const authenticateAPIKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'] || req.query?.api_key;
  if (apiKey !== 'codizulca-secret-2026') {
    return res.status(403).json({ error: 'Acceso denegado. API Key inválido.' });
  }
  next();
};

async function handleChainOrderWebhook(req: any, res: any, forcedOrigin?: string) {
  const rawPayload = req.body;

  try {
    const payloadToParse =
      forcedOrigin && rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? { origen: forcedOrigin, ...rawPayload }
        : rawPayload;

    const parseResult = parseAndValidateChainOrders(payloadToParse);

    if (parseResult.orders.length === 0 && parseResult.ignoredTestCount > 0) {
      return res.status(200).json({
        success: true,
        ignored: true,
        message: 'Pedidos de prueba QA ignorados.',
        pedidos_procesados: 0,
        detalle: []
      });
    }

    const rowsToUpsert = parseResult.orders.map(o => o.dbRow);
    const createdOrdersSummary = parseResult.orders.map(o => ({
      id: o.id,
      numero_pedido: o.numero_pedido,
      cliente: o.orderData.cliente,
      id_cliente: o.orderData.id_cliente,
      cadena: o.cadena,
      status: o.status,
      hasFormatError: o.hasFormatError,
      anomalies: o.anomalies,
      total: o.orderData.total_pedido,
      items: o.orderData.articulos.length
    }));

    // Upsert idempotente en Supabase para garantizar que nunca falle por reintentos del webhook
    const { error: upsertErr } = await supabase
      .from('orders')
      .upsert(rowsToUpsert, { onConflict: 'id' });

    if (upsertErr) {
      console.error('[Webhook Cadenas] Error en upsert primario, activando fallback de emergencia:', upsertErr);
      // Fallback de emergencia: insertar registro de rescate con estado ERROR_FORMATO
      const fallbackId = `alk-err-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      await supabase.from('orders').insert({
        id: fallbackId,
        numero_pedido: 'APP-FDV',
        cliente: forcedOrigin ? `ORDEN ${forcedOrigin} (ERROR DE INGESTA)` : 'ORDEN CADENA COMERCIAL (ERROR DE INGESTA)',
        id_cliente: '',
        ruta: 'SAIRU VALLES / CUENTAS CLAVE 2',
        observaciones: `Error de base de datos al procesar payload: ${upsertErr.message}`,
        fecha: nowIso.split('T')[0],
        total_pedido: 0,
        monto_pedido: 0,
        status: 'ERROR_FORMATO',
        cxc_note: `ERROR_FORMATO: ${upsertErr.message}`,
        articulos: [
          {
            codigo: 'ERROR',
            descripcion: 'FALLO EN ESTRUCTURA DE DATOS - REVISAR PAYLOAD EN AUDITORÍA',
            unidad_medida: 'BULTO',
            cantidad_solicitada: 0,
            cantidad_despachada: 0,
            precio_unitario: 0,
            sub_total: 0
          }
        ],
        raw_order: { original_payload: rawPayload, db_error: upsertErr.message },
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
        status_history: [
          {
            status: 'ERROR_FORMATO',
            department: 'Ventas',
            changedBy: 'Sistema Integración',
            timestamp: nowIso,
            reason: `Fallback activado por error en esquema: ${upsertErr.message}`
          }
        ]
      });

      return res.status(202).json({
        success: true,
        warning: 'La orden presentó anomalías críticas y fue registrada en Sala de Espera con estado ERROR_FORMATO.',
        pedidos_procesados: 1,
        detalle: [{ id: fallbackId, status: 'ERROR_FORMATO', error: upsertErr.message }]
      });
    }

    console.log(
      `[Webhook Cadenas] Procesados ${rowsToUpsert.length} pedidos en Sala de Espera (Válidos: ${parseResult.validCount}, Error de Formato: ${parseResult.errorFormatoCount}).`
    );

    return res.status(201).json({
      success: true,
      message: `Se integraron con éxito ${rowsToUpsert.length} pedidos en la Sala de Espera.`,
      pedidos_procesados: rowsToUpsert.length,
      validos: parseResult.validCount,
      con_error_formato: parseResult.errorFormatoCount,
      detalle: createdOrdersSummary
    });
  } catch (err: any) {
    console.error('[Webhook Cadenas] Excepción no controlada:', err);
    return res.status(500).json({ error: 'Hubo un error al procesar el webhook', details: err?.message });
  }
}

router.post('/fdv', authenticateAPIKey, (req, res) => handleChainOrderWebhook(req, res));
router.post('/alkosto', authenticateAPIKey, (req, res) => handleChainOrderWebhook(req, res, 'ALKOSTO'));
router.post('/familia-center', authenticateAPIKey, (req, res) => handleChainOrderWebhook(req, res, 'FAMILIA CENTER'));

export default router;
