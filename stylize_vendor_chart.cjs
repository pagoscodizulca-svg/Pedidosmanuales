const fs = require('fs');
let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');

const oldVendorChart = `<div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="vendedor" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} angle={-15} textAnchor="end" />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => '$' + (val/1000).toFixed(0) + 'k'} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar yAxisId="left" dataKey="ventas" name="Ventas ($)" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar yAxisId="right" dataKey="aprob" name="Pedidos Aprob." fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar yAxisId="right" dataKey="rech" name="Rechazos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>`;

const newVendorChart = `<div className="h-[380px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vendorStats.slice(0, 12)} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="vendedor" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} 
                  angle={-25} 
                  textAnchor="end"
                  tickFormatter={(v) => {
                    const words = v.split(' ');
                    return words.length > 2 ? words.slice(0, 2).join(' ') + '...' : v;
                  }}
                />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={(val) => '$' + (val/1000).toFixed(0) + 'k'} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingBottom: '20px' }} />
                
                {/* Barras gruesas y vistosas para el dinero */}
                <Bar yAxisId="left" dataKey="ventas" name="Volumen de Ventas ($)" fill="url(#colorVentas)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                
                {/* Lneas para conteo de interacciones para no aplastar las barras */}
                <Line yAxisId="right" type="monotone" dataKey="aprob" name="Pedidos Aprob." stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="rech" name="Rechazos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>`;

code = code.replace(oldVendorChart, newVendorChart);
fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Stylized vendor chart.');
