const fs = require('fs');

let code = fs.readFileSync('src/pages/Auditoria.tsx', 'utf8');

const oldChart = `<div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productStats} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis dataKey="desc" type="category" width={180} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} 
                       tickFormatter={(v) => v.length > 25 ? v.substring(0, 25) + '...' : v} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="pedidos" name="N° Pedidos" fill="#64748b" radius={[0, 4, 4, 0]} barSize={12} onClick={(data: any) => setSelectedProduct(data.desc)} cursor="pointer" />
                <Bar dataKey="volumen" name="Volumen Físico" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={12} onClick={(data: any) => setSelectedProduct(data.desc)} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>`;

const newChart = `<div className="h-[380px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productStats} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorVolumen" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorPedidos" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e30a17" stopOpacity={0.7}/>
                    <stop offset="100%" stopColor="#b9000b" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="desc" type="category" width={220} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} 
                       tickFormatter={(v) => v.length > 32 ? v.substring(0, 32) + '...' : v} />
                <RechartsTooltip 
                   cursor={{ fill: '#f8fafc' }} 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} 
                   itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                <Bar dataKey="pedidos" name="Interacciones (Pedidos)" fill="url(#colorPedidos)" radius={[0, 6, 6, 0]} barSize={14} onClick={(data: any) => setSelectedProduct(data.desc)} cursor="pointer" />
                <Bar dataKey="volumen" name="Volumen Solicitado" fill="url(#colorVolumen)" radius={[0, 6, 6, 0]} barSize={14} onClick={(data: any) => setSelectedProduct(data.desc)} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>`;

code = code.replace(oldChart, newChart);
fs.writeFileSync('src/pages/Auditoria.tsx', code, 'utf8');
console.log('Updated Auditoria chart styling.');
