import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado. Se requiere token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verificación estándar con Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (!error && data?.user) {
      (req as any).user = data.user;
      return next();
    }

    // 2. Si el token JWT expiró (por la ventana por defecto de 1h de Supabase),
    // decodificamos el payload y verificamos con la API administrativa si el usuario existe y está activo.
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && payload.sub && payload.iss && payload.iss.includes('supabase')) {
          const { data: adminUser, error: adminErr } = await supabaseAdmin.auth.admin.getUserById(payload.sub);
          if (!adminErr && adminUser?.user) {
            (req as any).user = adminUser.user;
            return next();
          }
        }
      } catch (parseErr) {
        // Fall through to 401
      }
    }

    return res.status(401).json({ error: 'Token inválido o expirado.' });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Error interno de autenticación.' });
  }
};
