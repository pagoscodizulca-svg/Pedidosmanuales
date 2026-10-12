import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientesJsonPath = path.resolve(__dirname, '../data/clientes.json');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Cache local en memoria
let localClientes: Array<{ id_cliente: string; nombre: string; vendedor: string }> = [];

try {
  if (fs.existsSync(clientesJsonPath)) {
    localClientes = JSON.parse(fs.readFileSync(clientesJsonPath, 'utf8'));
  }
} catch (err) {
  console.error('[clientes] Error leyendo clientes.json:', err);
}

// Auto-seeding si la tabla existe en Supabase pero está vacía
async function checkAndSeedSupabase() {
  try {
    const { count, error } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
    if (!error && count === 0 && localClientes.length > 0) {
      console.log('[clientes] Tabla en Supabase encontrada vacía. Sincronizando datos...');
      const BATCH_SIZE = 200;
      for (let i = 0; i < localClientes.length; i += BATCH_SIZE) {
        const batch = localClientes.slice(i, i + BATCH_SIZE);
        await supabase.from('clientes').upsert(batch, { onConflict: 'id_cliente' });
      }
      console.log('[clientes] Sincronización automática a Supabase completada con éxito.');
    }
  } catch (err) {
    // Si la tabla no existe en el schema cache, ignorar
  }
}
checkAndSeedSupabase();

// GET /api/clientes - Lista de clientes con búsqueda opcional
router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toUpperCase() : '';

  try {
    // Intentar leer de Supabase primero si la tabla existe
    const { data, error } = await supabase.from('clientes').select('*').limit(3000);
    if (!error && data && data.length > 0) {
      if (!q) return res.json(data);
      const filtered = data.filter((c: any) =>
        c.id_cliente?.toUpperCase().includes(q) ||
        c.nombre?.toUpperCase().includes(q) ||
        c.vendedor?.toUpperCase().includes(q)
      );
      return res.json(filtered);
    }
  } catch (err) {
    // Silently fallback to local
  }

  // Fallback a clientes locales
  if (!q) {
    return res.json(localClientes);
  }

  const filtered = localClientes.filter(
    (c) =>
      c.id_cliente.toUpperCase().includes(q) ||
      c.nombre.toUpperCase().includes(q) ||
      c.vendedor.toUpperCase().includes(q)
  );
  return res.json(filtered);
});

// GET /api/clientes/count - Cantidad total de clientes
router.get('/count', async (req, res) => {
  try {
    const { count, error } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
    if (!error && typeof count === 'number' && count > 0) {
      return res.json({ count, source: 'supabase' });
    }
  } catch (err) {
    // Fallback
  }

  return res.json({ count: localClientes.length, source: 'local' });
});

// GET /api/clientes/:id - Buscar cliente por código
router.get('/:id', async (req, res) => {
  const rawId = req.params.id.trim().toUpperCase();
  const paddedId = rawId.padStart(6, '0');

  // Buscar en local primero o Supabase
  let found = localClientes.find((c) => c.id_cliente === rawId || c.id_cliente === paddedId);

  if (!found) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .or(`id_cliente.eq.${rawId},id_cliente.eq.${paddedId}`)
        .maybeSingle();
      if (!error && data) found = data;
    } catch {
      // Ignore
    }
  }

  if (!found) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  return res.json(found);
});

export default router;
