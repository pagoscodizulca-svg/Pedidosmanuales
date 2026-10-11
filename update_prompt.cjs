const fs = require('fs');
let code = fs.readFileSync('server/routes/chat.ts', 'utf8');

code = code.replace(/4\. Habla en espaol de Venezuela en un tono corporativo pero amigable\./, 
\4. Habla en español de Venezuela en un tono corporativo pero amigable.
5. Utiliza listas con viñetas (bullets), negritas y separaciones de línea (Markdown) para estructurar tu respuesta de forma sumamente fácil de leer. No envíes bloques de texto densos.\);

fs.writeFileSync('server/routes/chat.ts', code, 'utf8');
console.log('Prompt updated');
