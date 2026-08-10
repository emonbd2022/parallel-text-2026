const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldAutoCats = `const autoModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite'];`;
const newAutoCats = `const autoModels = [
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-3.1-flash-lite-preview',
          'gemini-2.5-flash-lite'
        ];
        
        autoModels.sort((a, b) => {
            const statA = modelStats[a];
            const statB = modelStats[b];
            const scoreA = statA ? ((statA.totalTimeMs / Math.max(1, statA.count)) + (statA.fails * 5000)) : 10000;
            const scoreB = statB ? ((statB.totalTimeMs / Math.max(1, statB.count)) + (statB.fails * 5000)) : 10000;
            return scoreA - scoreB;
        });`;

code = code.replace(oldAutoCats, newAutoCats);
fs.writeFileSync('src/App.tsx', code);
