const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/components/shared/ChatBot.tsx',
  'src/components/shared/ProductDashboardModal.tsx',
  'src/pages/Auditoria.tsx',
  'src/store/index.ts'
];

filesToUpdate.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Add import if not present
  if (!content.includes('apiFetch')) {
     const importStmt = `import { apiFetch } from '${file.includes('components') ? '../../utils/api' : (file.includes('pages') ? '../utils/api' : '../utils/api')}';\n`;
     content = importStmt + content;
  }
  
  // Replace fetch( with apiFetch(
  content = content.replace(/await fetch\(/g, 'await apiFetch(');
  
  fs.writeFileSync(file, content, 'utf8');
});

// Update auth store
let authContent = fs.readFileSync('src/store/auth.ts', 'utf8');
authContent = authContent.replace(/sucursal\?: string;/, "sucursal?: string;\n  token?: string;");
fs.writeFileSync('src/store/auth.ts', authContent, 'utf8');

console.log('Frontend fetch calls replaced with apiFetch');
