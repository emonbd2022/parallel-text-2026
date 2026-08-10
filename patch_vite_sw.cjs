const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

const oldWorkbox = `        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 5000000
        }`;

const newWorkbox = `        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 5000000,
          clientsClaim: true,
          skipWaiting: true
        }`;

code = code.replace(oldWorkbox, newWorkbox);
fs.writeFileSync('vite.config.ts', code);
