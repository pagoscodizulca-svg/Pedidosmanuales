const fs = require('fs');
let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');

code = code.replace(/key=\{\\\`cell-\\\$\{index\}\\\`\}/, 'key={`cell-${index}`}');
code = code.replace(/style=\{\{ width: \\\`\\\$\{\(r\.count \/ rejectReasonsData\[0\]\.count\) \* 100\}%\\\` \}\}/, 'style={{ width: `${(r.count / rejectReasonsData[0].count) * 100}%` }}');

fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Fixed Auditoria syntax');
