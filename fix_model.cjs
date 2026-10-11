const fs = require('fs');

let code = fs.readFileSync('server/routes/chat.ts', 'utf8');
code = code.replace(/model: 'gemini-2\.5-pro'/, "model: 'gemini-3.1-pro-preview'");

fs.writeFileSync('server/routes/chat.ts', code, 'utf8');
console.log('Updated model version to gemini-3.1-pro-preview.');
