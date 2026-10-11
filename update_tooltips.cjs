const fs = require('fs');
let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');

// Update Rendimiento por Vendedor
code = code.replace(
  /<RechartsTooltip cursor=\{\{ fill: '#f1f5f9' \}\} contentStyle=\{\{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb\(0 0 0 \/ 0.1\)' \}\} \/>/,
  `<RechartsTooltip 
                      formatter={(value, name) => name === 'Ventas Totales ($)' ? '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
                      cursor={{ fill: '#f1f5f9' }} 
                      contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    />`
);

// Update Volumen de Ventas Semanal
code = code.replace(
  /<RechartsTooltip cursor=\{\{ fill: '#f8fafc' \}\} contentStyle=\{\{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb\(0 0 0 \/ 0.1\)' \}\} \/>/,
  `<RechartsTooltip 
                    formatter={(value) => '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    cursor={{ fill: '#f8fafc' }} 
                    contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  />`
);

fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Tooltips updated');
