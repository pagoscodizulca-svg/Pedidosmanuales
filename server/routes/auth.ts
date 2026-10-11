import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contrasea son requeridos' });
  }

  try {
    // Migrate login to Supabase Auth by appending the dummy domain
    const email = `${username}@codizulca.com`.toLowerCase();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Usuario o contrasea incorrectos (Auth).' });
    }

    const metadata = authData.user.user_metadata || {};

    res.json({
      id: authData.user.id,
      username: metadata.username || username,
      role: metadata.role || 'ventas',
      estado: metadata.estado || '',
      sucursal: metadata.sucursal || '',
      token: authData.session.access_token // Optional for future strict RLS
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
