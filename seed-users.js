import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const users = [
  { username: 'Admin', password_hash: '123456', role: 'master', estado: '', sucursal: '' },
  { username: 'Mari01', password_hash: 'Codi.123', role: 'ventas', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Erika01', password_hash: 'Codi.124', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Windi01', password_hash: 'Codi.125', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Francis01', password_hash: 'Codi.126', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Roxidey01', password_hash: 'Codi.127', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Neilibeth01', password_hash: 'Codi.133', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Issi01', password_hash: 'Codi.134', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Lorenys01', password_hash: 'Codi.135', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Marisabel01', password_hash: 'Codi.136', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Yanitze01', password_hash: 'Codi.128', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Yariannys01', password_hash: 'Codi.129', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Diego01', password_hash: 'Codi.130', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Genesis01', password_hash: 'Codi.131', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Jessica01', password_hash: 'Codi.132', role: 'ventas', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Nelson01', password_hash: 'Codi.137', role: 'ventas', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Ramon01', password_hash: 'Codi.01', role: 'gerencia', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Yilda01', password_hash: 'Codi.138', role: 'cxc', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Norka01', password_hash: 'Codi.139', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Egglys01', password_hash: 'Codi.140', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Maria01', password_hash: 'Codi.141', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' },
  { username: 'Lisseth01', password_hash: 'Codi.142', role: 'facturacion', estado: 'Zulia', sucursal: 'Maracaibo' }
];

async function run() {
  const { data, error } = await supabase.from('users').insert(users).select();
  console.log({data, error});
}
run();
