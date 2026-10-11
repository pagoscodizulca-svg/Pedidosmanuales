const fs = require('fs');
let code = fs.readFileSync('src/components/shared/ChatBot.tsx', 'utf8');

// Update floating button
code = code.replace(
  /<Bot size=\{28\} \/>/,
  `<img src="/codibot.jpg" alt="Codibot" className="w-8 h-8 rounded-full object-cover shadow-sm" />`
);

// Update Header icon
code = code.replace(
  /<div className="bg-codizulca-cyan p-2 rounded-full">\s*<Bot size=\{20\} \/>\s*<\/div>/,
  `<div className="bg-slate-800 p-0.5 rounded-full border-2 border-codizulca-cyan">\n                <img src="/codibot.jpg" alt="Codibot" className="w-8 h-8 rounded-full object-cover" />\n              </div>`
);

// Update Message bubble icon
code = code.replace(
  /<div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center \$\{m\.role === 'user' \? 'bg-slate-200 text-slate-600' : 'bg-cyan-100 text-cyan-700'\}`}>\s*\{m\.role === 'user' \? <User size=\{16\} \/> : <Bot size=\{16\} \/>\}\s*<\/div>/,
  `<div className={\`shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden \${m.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-transparent border border-slate-200 shadow-sm'}\`}>\n                  {m.role === 'user' ? <User size={16} /> : <img src="/codibot.jpg" alt="Codibot" className="w-full h-full object-cover" />}\n                </div>`
);

fs.writeFileSync('src/components/shared/ChatBot.tsx', code, 'utf8');
console.log('Icons replaced with codibot.jpg');
