const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const oldRouting = `
    app.use('/api/orders', ordersRouter);
    app.use('/api/parse-order', parseRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/analytics', analyticsRouter);
    app.use('/api/integrations', integrationsRouter);
`;

const newRouting = `
    const { requireAuth } = await import('./server/middleware/auth.js');
    
    app.use('/api/auth', authRouter);
    app.use('/api/integrations', integrationsRouter);

    // Protected Routes
    app.use('/api/orders', requireAuth, ordersRouter);
    app.use('/api/parse-order', requireAuth, parseRouter);
    app.use('/api/admin', requireAuth, adminRouter);
    app.use('/api/chat', requireAuth, chatRouter);
    app.use('/api/analytics', requireAuth, analyticsRouter);
`;

code = code.replace(oldRouting.trim(), newRouting.trim());

fs.writeFileSync('server.ts', code, 'utf8');
console.log('Applied Auth Middleware to server.ts');
