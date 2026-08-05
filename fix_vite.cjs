const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf-8');

code = code.replace(
  "VitePWA({\n      workbox: {\n        maximumFileSizeToCacheInBytes: 5000000\n      },",
  "VitePWA({\n"
);

code = code.replace(
  "workbox: {\n          globPatterns: ['**/*.{js,css,html,ico,png,svg}']\n        }",
  "workbox: {\n          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],\n          maximumFileSizeToCacheInBytes: 5000000\n        }"
);

fs.writeFileSync('vite.config.ts', code);
