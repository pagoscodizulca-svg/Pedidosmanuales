const fs = require('fs');
let code = fs.readFileSync('src/components/shared/ProductDashboardModal.tsx', 'utf8');

code = code.replace(/fetch\(\\\`\/api\/analytics\/product\?desc=\\\$\{encodeURIComponent\(productName\)\}\\\`\)/, 'fetch(`/api/analytics/product?desc=${encodeURIComponent(productName)}`)');
code = code.replace(/key=\{\\\`cell-\\\$\{index\}\\\`\}/g, 'key={`cell-${index}`}');

fs.writeFileSync('src/components/shared/ProductDashboardModal.tsx', code, 'utf8');
console.log('Fixed syntax in Modal');
