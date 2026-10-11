const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf8');

if (!code.includes('apiFetch')) {
  code = "import { apiFetch } from '../utils/api';\n" + code;
}
code = code.replace(/await fetch\('/g, "await apiFetch('");

fs.writeFileSync('src/pages/Login.tsx', code, 'utf8');
console.log('Fixed Login.tsx to use apiFetch');
