const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan credenciales de Supabase en el entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncClientes() {
  const jsonPath = path.resolve(__dirname, 'server/data/clientes.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('No se encontró server/data/clientes.json');
    return;
  }

  const clientes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Iniciando sincronización de ${clientes.length} clientes a Supabase...`);

  // Verificar si la tabla existe
  const { error: testErr } = await supabase.from('clientes').select('id_cliente').limit(1);
  if (testErr) {
    console.log('Aviso: La tabla public.clientes no existe todavía en Supabase.');
    console.log('Mensaje de Supabase:', testErr.message);
    console.log('\nPara crearla en Supabase SQL Editor ejecuta el siguiente SQL:');
    console.log(`
CREATE TABLE IF NOT EXISTS public.clientes (
    id_cliente VARCHAR(20) PRIMARY KEY,
    nombre TEXT NOT NULL,
    vendedor TEXT
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura clientes" ON public.clientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Gestión clientes" ON public.clientes FOR ALL TO service_role, authenticated USING (true);
    `);
    return;
  }

  // Si existe, subir por lotes de 200
  const BATCH_SIZE = 200;
  let totalInserted = 0;

  for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
    const batch = clientes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('clientes')
      .upsert(batch, { onConflict: 'id_cliente' });

    if (error) {
      console.error(`Error en lote ${i} - ${i + batch.length}:`, error.message);
    } else {
      totalInserted += batch.length;
      console.log(`Progreso: ${totalInserted}/${clientes.length} clientes sincronizados`);
    }
  }

  console.log(`✅ Sincronización finalizada: ${totalInserted} clientes en Supabase.`);
}

syncClientes().catch(console.error);
