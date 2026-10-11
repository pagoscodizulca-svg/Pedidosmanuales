require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: badOrders, error } = await supabase
    .from('orders')
    .select('id, numero_pedido, created_at')
    .eq('is_archived', false)
    .gte('numero_pedido', '99909')
    .lte('numero_pedido', '99999')
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error fetching bad orders', error);
    return;
  }
  
  console.log(`Found ${badOrders.length} orders with wrong correlativo.`);
  
  let currentNum = 4826;
  for (const o of badOrders) {
    const newCorrelativo = String(currentNum).padStart(5, '0');
    console.log(`Updating ${o.numero_pedido} -> ${newCorrelativo}`);
    
    // update root numero_pedido
    const { error: updErr } = await supabase
      .from('orders')
      .update({ 
         numero_pedido: newCorrelativo,
         // we must also patch raw_order.numero_pedido to be safe, but wait, raw_order is a JSONB!
         // let's do a direct sql-like update or fetch and replace
      })
      .eq('id', o.id);
      
    if (updErr) console.error('Failed to update', updErr);
    
    // To update raw_order properly in JSONB we can just update the whole object
    const { data: row } = await supabase.from('orders').select('raw_order').eq('id', o.id).single();
    if (row && row.raw_order) {
       row.raw_order.numero_pedido = newCorrelativo;
       await supabase.from('orders').update({ raw_order: row.raw_order }).eq('id', o.id);
    }
    
    currentNum++;
  }
  
  console.log('Done fixing correlativos!');
}
run();
