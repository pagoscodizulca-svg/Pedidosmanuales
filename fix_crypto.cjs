const fs = require('fs');
let code = fs.readFileSync('server/routes/integrations.ts', 'utf8');

code = code.replace(
  /import \{ createClient \} from '@supabase\/supabase-js';/,
  "import { createClient } from '@supabase/supabase-js';\nimport crypto from 'crypto';"
);

code = code.replace(
  /\s*const crypto = require\('crypto'\);/,
  ""
);

fs.writeFileSync('server/routes/integrations.ts', code, 'utf8');
console.log('Fixed crypto require in integrations.ts');
