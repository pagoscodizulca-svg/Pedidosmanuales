const fs = require('fs');
let code = fs.readFileSync('src/components/shared/SeguimientoBlock.tsx', 'utf8');

// Revert Tab Type
code = code.replace(
  /useState\<'TODOS' \| 'PROCESO' \| 'LISTOS' \| 'RECHAZADOS' \| 'ALKOSTO'\>\('TODOS'\)/g,
  `useState<'TODOS' | 'PROCESO' | 'LISTOS' | 'RECHAZADOS'>('TODOS')`
);

// Revert Alkosto Filter Logic
code = code.replace(
  /if \(activeFilterTab === 'RECHAZADOS' && o\.status !== 'RECHAZADO'\) return false;\s*if \(activeFilterTab === 'ALKOSTO'\) \{[\s\S]*?\n\s*\}/g,
  `if (activeFilterTab === 'RECHAZADOS' && o.status !== 'RECHAZADO') return false;`
);

// Revert Alkosto Count
code = code.replace(
  /const countRechazados = orders\.filter\(o => o\.status === 'RECHAZADO'\)\.length;\s*const countAlkosto = [\s\S]*?\.length;/g,
  `const countRechazados = orders.filter(o => o.status === 'RECHAZADO').length;`
);

// Revert Tab Button UI
code = code.replace(
  /\<button\s*onClick=\{\(\) => setActiveFilterTab\('ALKOSTO'\)\}[\s\S]*?\<\/button\>/g,
  ``
);

fs.writeFileSync('src/components/shared/SeguimientoBlock.tsx', code, 'utf8');
console.log('SeguimientoBlock reverted');
