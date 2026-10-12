import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ordersRouter from './routes/orders.js';
import parseRouter from './routes/parse.js';
import adminRouter from './routes/admin.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import analyticsRouter from './routes/analytics.js';
import integrationsRouter from './routes/integrations.js';
import clientesRouter from './routes/clientes.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

// Unprotected routes
app.use('/api/auth', authRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/clientes', requireAuth, clientesRouter);

// Protected routes
app.use('/api/orders', requireAuth, ordersRouter);
app.use('/api/parse-order', requireAuth, parseRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/analytics', requireAuth, analyticsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
