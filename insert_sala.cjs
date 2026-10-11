const fs = require('fs');
let code = fs.readFileSync('src/pages/Ventas.tsx', 'utf8');

code = code.replace(
  /import \{ SeguimientoBlock \} from '\.\.\/components\/shared\/SeguimientoBlock';/,
  `import { SeguimientoBlock } from '../components/shared/SeguimientoBlock';\nimport { SalaEsperaAlkosto } from '../components/ventas/SalaEsperaAlkosto';`
);

code = code.replace(
  /\{\/\* ================= BLOQUE DE SEGUIMIENTO GLOBAL ================= \*\/\}/,
  `{/* ================= SALA DE ESPERA ALKOSTO ================= */}\n      <div className="lg:col-span-2 mt-6">\n        <SalaEsperaAlkosto />\n      </div>\n\n      {/* ================= BLOQUE DE SEGUIMIENTO GLOBAL ================= */}`
);

fs.writeFileSync('src/pages/Ventas.tsx', code, 'utf8');
console.log('Ventas.tsx updated');
