const fs = require('fs');
let code = fs.readFileSync('src/components/shared/SeguimientoBlock.tsx', 'utf8');

// Update activeFilterTab state type
code = code.replace(
  /useState\<'TODOS' \| 'PROCESO' \| 'LISTOS' \| 'RECHAZADOS'\>\('TODOS'\)/,
  `useState<'TODOS' | 'PROCESO' | 'LISTOS' | 'RECHAZADOS' | 'ALKOSTO'>('TODOS')`
);

// Add filter logic for Alkosto
code = code.replace(
  /if \(activeFilterTab === 'RECHAZADOS' && o\.status !== 'RECHAZADO'\) return false;/,
  `if (activeFilterTab === 'RECHAZADOS' && o.status !== 'RECHAZADO') return false;\n    if (activeFilterTab === 'ALKOSTO') {\n       const isAlkosto = (o.order.origen === 'ALKOSTO') || (o.order.cliente && o.order.cliente.toUpperCase().includes('ALKOSTO')) || (o.order.observaciones && o.order.observaciones.toUpperCase().includes('ALKOSTO'));\n       if (!isAlkosto) return false;\n    }`
);

// Add Alkosto counter
code = code.replace(
  /const countRechazados = orders\.filter\(o => o\.status === 'RECHAZADO'\)\.length;/,
  `const countRechazados = orders.filter(o => o.status === 'RECHAZADO').length;\n  const countAlkosto = orders.filter(o => (o.order.origen === 'ALKOSTO') || (o.order.cliente && o.order.cliente.toUpperCase().includes('ALKOSTO')) || (o.order.observaciones && o.order.observaciones.toUpperCase().includes('ALKOSTO'))).length;`
);

// Render the Alkosto Tab Button in the UI
code = code.replace(
  /onClick=\{\(\) => setActiveFilterTab\('RECHAZADOS'\)\}[\s\S]*?<\/button>/,
  `onClick={() => setActiveFilterTab('RECHAZADOS')}
            className={\`px-4 py-2 font-bold text-sm transition-colors flex items-center gap-2 border-b-2 \${
              activeFilterTab === 'RECHAZADOS' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }\`}
          >
            RECHAZADOS
            <span className={\`text-xs px-2 py-0.5 rounded-full \${activeFilterTab === 'RECHAZADOS' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}\`}>
              {countRechazados}
            </span>
          </button>
          
          <button
            onClick={() => setActiveFilterTab('ALKOSTO')}
            className={\`px-4 py-2 font-bold text-sm transition-colors flex items-center gap-2 border-b-2 \${
              activeFilterTab === 'ALKOSTO' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }\`}
          >
            ALKOSTO (App)
            <span className={\`text-xs px-2 py-0.5 rounded-full \${activeFilterTab === 'ALKOSTO' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}\`}>
              {countAlkosto}
            </span>
          </button>`
);

fs.writeFileSync('src/components/shared/SeguimientoBlock.tsx', code, 'utf8');
console.log('SeguimientoBlock updated');
