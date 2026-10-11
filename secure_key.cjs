const fs = require('fs');

const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

if (!envContent.includes('SUPABASE_SERVICE_ROLE_KEY')) {
  envContent += '\nSUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4ZHV4eXJiZXliaGhicGR5cW9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTA3NTE1OCwiZXhwIjoyMTA2NjUxMTU4fQ.9KIEDzP9q3x16HS4h4CVBtXN9LL9B9awz_NMsqqWXFE"';
  fs.writeFileSync(envPath, envContent, 'utf8');
}

// Update routes to use SERVICE_ROLE_KEY instead of ANON_KEY
const routes = [
  'server/routes/orders.ts',
  'server/routes/analytics.ts',
  'server/routes/integrations.ts',
  'server/routes/chat.ts'
];

routes.forEach(route => {
  if (fs.existsSync(route)) {
    let code = fs.readFileSync(route, 'utf8');
    code = code.replace(
      /const supabaseKey = process\.env\.VITE_SUPABASE_ANON_KEY \|\| '';/,
      "const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';"
    );
    fs.writeFileSync(route, code, 'utf8');
  }
});

console.log('Secret key added and routes updated securely.');
