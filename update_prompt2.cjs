const fs = require('fs');
let code = fs.readFileSync('server/routes/chat.ts', 'utf8');

const rulesEndIndex = code.indexOf('### Base de Datos de Pedidos (JSON):');
if (rulesEndIndex !== -1) {
  code = code.substring(0, rulesEndIndex) + 
         "5. Usa listas con viñetas (bullets), negritas y separaciones de línea (Markdown) para estructurar tu respuesta de forma sumamente fácil de leer. No envíes bloques de texto densos.\n\n" + 
         code.substring(rulesEndIndex);
}

// Ensure the bot name is Codibot
code = code.replace(/Bot Asistente Oficial/, 'Codibot, el Asistente Oficial');

fs.writeFileSync('server/routes/chat.ts', code, 'utf8');
console.log('Prompt updated to markdown format.');
