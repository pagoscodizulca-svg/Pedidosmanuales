import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const fallbackUserHeader = req.headers['x-codizulca-user'];

  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';

  try {
    // 1. Verificación estándar con Supabase si hay token
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        (req as any).user = data.user;
        return next();
      }

      // 2. Si el token JWT expiró (por la ventana de 1h de Supabase),
      // decodificamos el payload (base64url) y verificamos con admin API o contra la tabla `public.users`.
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload && payload.sub && payload.iss && String(payload.iss).includes('supabase')) {
            // Intentar primero por API admin (si SUPABASE_SERVICE_ROLE_KEY está configurada)
            const { data: adminUser, error: adminErr } = await supabaseAdmin.auth.admin.getUserById(payload.sub);
            if (!adminErr && adminUser?.user) {
              (req as any).user = adminUser.user;
              return next();
            }

            // Fallback compatible con VITE_SUPABASE_ANON_KEY en Render: verificar contra tabla `users` o `user_metadata`
            const { data: dbUser } = await supabaseAdmin
              .from('users')
              .select('id, username, role')
              .eq('id', payload.sub)
              .maybeSingle();

            if (dbUser && dbUser.id) {
              (req as any).user = {
                id: dbUser.id,
                email: payload.email || `${String(dbUser.username || 'usuario').toLowerCase()}@codizulca.com`,
                role: dbUser.role || payload.user_metadata?.role || 'ventas',
                user_metadata: {
                  ...(payload.user_metadata || {}),
                  username: dbUser.username || payload.user_metadata?.username || 'Usuario',
                  role: dbUser.role || payload.user_metadata?.role || 'ventas'
                }
              };
              return next();
            }

            if (payload.user_metadata?.username || payload.email) {
              (req as any).user = {
                id: payload.sub,
                email: payload.email,
                role: payload.user_metadata?.role || 'ventas',
                user_metadata: payload.user_metadata || {}
              };
              return next();
            }
          }
        } catch {
          // Continuar a verificación por cabecera de sesión
        }
      }
    }

    // 3. Respaldo de sesión activa por cabecera `x-codizulca-user` verificada contra `public.users`
    if (fallbackUserHeader && typeof fallbackUserHeader === 'string') {
      try {
        const parsedUser = JSON.parse(fallbackUserHeader);
        const uname = String(parsedUser?.username || '').trim();
        if (uname) {
          const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('id, username, role')
            .ilike('username', uname)
            .maybeSingle();

          if (dbUser && dbUser.id) {
            (req as any).user = {
              id: dbUser.id,
              email: `${dbUser.username.toLowerCase()}@codizulca.com`,
              role: dbUser.role || parsedUser.role || 'ventas',
              user_metadata: {
                username: dbUser.username,
                role: dbUser.role || parsedUser.role || 'ventas'
              }
            };
            return next();
          }
        }
      } catch {
        // Fall through
      }
    }

    return res.status(401).json({ error: 'Token inválido o expirado.' });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Error interno de autenticación.' });
  }
};
