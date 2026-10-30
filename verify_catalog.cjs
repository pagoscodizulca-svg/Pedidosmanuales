const fs = require('fs');

console.log('=== TEST DE VERIFICACIÓN Y AUDITORÍA DE PRODUCTOS ===');

// 1. Verificar src/data/productos.ts
const prodTs = fs.readFileSync('src/data/productos.ts', 'utf8');
const idDescRegex = /{\s*id:\s*'([^']+)',\s*descripcion:\s*'([^']+)'\s*}/g;
let m;
const products = [];
const seenIds = new Set();
let duplicates = 0;

while ((m = idDescRegex.exec(prodTs)) !== null) {
  const id = m[1];
  const desc = m[2];
  if (seenIds.has(id)) duplicates++;
  seenIds.add(id);
  products.push({ id, desc });
}

console.log(`1. Total productos en src/data/productos.ts: ${products.length} (Esperado: 158)`);
console.log(`2. Duplicados encontrados: ${duplicates} (Esperado: 0)`);

// 2. Verificar extremos
const pFirst = products[0];
const pLast = products[products.length - 1];
console.log(`3. Primer producto: [${pFirst.id}] "${pFirst.desc}" (Esperado: 000009 - FILETE DE PECHUGA A GRANEL POR KG)`);
console.log(`4. Último producto: [${pLast.id}] "${pLast.desc}" (Esperado: 001592 - SALMON POR KILO)`);

// 3. Verificar caracteres especiales (Ñ)
const p151 = products.find(p => p.id === '000151');
const p1464 = products.find(p => p.id === '001464');
const p1471 = products.find(p => p.id === '001471');

console.log(`5. Código 000151: "${p151 ? p151.desc : 'NO ENCONTRADO'}"`);
console.log(`6. Código 001464: "${p1464 ? p1464.desc : 'NO ENCONTRADO'}"`);
console.log(`7. Código 001471: "${p1471 ? p1471.desc : 'NO ENCONTRADO'}"`);

// Verificar que no contenga el replacement char U+FFFD
const hasReplacementChar = products.some(p => p.desc.includes('\uFFFD'));
console.log(`8. Caracteres Unicode corruptos (\\uFFFD): ${hasReplacementChar ? 'SI (ERROR)' : 'NO (CORRECTO)'}`);

// 4. Verificar prompt en server/routes/parse.ts
const parseContent = fs.readFileSync('server/routes/parse.ts', 'utf8');
const parseCatalogLines = parseContent.split('\n').filter(l => l.startsWith('- 00'));
console.log(`9. Productos en prompt server/routes/parse.ts: ${parseCatalogLines.length} (Esperado: 158)`);

// Resumen general
const allOk = products.length === 158 &&
  duplicates === 0 &&
  pFirst.id === '000009' &&
  pLast.id === '001592' &&
  p151.desc === 'QUESO MOZARELLA EN BARRA DOÑA FLORA' &&
  p1464.desc === 'MORT NAVIDEÑA ASTURIAS XKG' &&
  p1471.desc === 'FS MORT NAVIDEÑA ASTURIAS POR KG' &&
  !hasReplacementChar &&
  parseCatalogLines.length === 158;

if (allOk) {
  console.log('\n>>> RESULTADO FINAL: TODOS LOS TESTS PASARON EXITOSAMENTE (100% OK) <<<');
  process.exit(0);
} else {
  console.error('\n>>> ERROR EN ALGUNAS VERIFICACIONES <<<');
  process.exit(1);
}
