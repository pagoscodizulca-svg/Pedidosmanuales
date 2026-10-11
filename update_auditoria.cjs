const fs = require('fs');
let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');

if (!code.includes('ProductDashboardModal')) {
  code = code.replace(
    /import \{ Database, CalendarDays, Users, Award, TrendingUp, Activity, Layers, AlertTriangle \} from 'lucide-react';/,
    `import { Database, CalendarDays, Users, Award, TrendingUp, Activity, Layers, AlertTriangle } from 'lucide-react';\nimport { ProductDashboardModal } from '../components/shared/ProductDashboardModal';`
  );
}

if (!code.includes('selectedProduct')) {
  code = code.replace(
    /const \[loadingAction, setLoadingAction\] = useState<string \| null>\(null\);/,
    `const [loadingAction, setLoadingAction] = useState<string | null>(null);\n  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);`
  );
}

code = code.replace(
  /<tr key=\{i\} className="hover:bg-slate-50 transition-colors">/g,
  `<tr key={i} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedProduct(p.desc)} title="Clic para ver Dashboard 360 del producto">`
);

code = code.replace(
  /<\/div>\s*<\/div>\s*\);\s*\};/g,
  `</div>\n      \n      {selectedProduct && (\n        <ProductDashboardModal \n          productName={selectedProduct} \n          orders={activeOrders} \n          onClose={() => setSelectedProduct(null)} \n        />\n      )}\n    </div>\n  );\n};\n`
);

fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Auditoria updated');
