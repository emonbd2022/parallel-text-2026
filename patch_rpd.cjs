const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    /\{ id: 'gemini-2\.5-flash-lite', name: 'Gemini 2\.5 Flash Lite \(500 RPD\)', rpm: 10 \}/,
    "{ id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (20 RPD)', rpm: 10 }"
);

content = content.replace(
    /return u\.lite < 10000;/g,
    "return u.lite < 20;"
);

content = content.replace(
    /return \(u\.flash_3_6 < 10000\) \|\| \(u\.flash_3_5_lite < 10000\) \|\| \(u\.flash_3_5 < 10000\) \|\| \(u\.flash_3 < 10000\) \|\| \(u\.flash < 10000\) \|\| \(u\.flash_3_1_lite < 10000\) \|\| \(u\.lite < 10000\);/g,
    "return (u.flash_3_6 < 10000) || (u.flash_3_5_lite < 10000) || (u.flash_3_5 < 10000) || (u.flash_3 < 10000) || (u.flash < 10000) || (u.flash_3_1_lite < 10000) || (u.lite < 20);"
);

fs.writeFileSync('src/App.tsx', content);

let apiContent = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');
apiContent = apiContent.replace(
    /const liteLimit = usage\.lite >= 10000;/g,
    "const liteLimit = usage.lite >= 20;"
);
fs.writeFileSync('src/components/ApiKeyManager.tsx', apiContent);
console.log("Success");
