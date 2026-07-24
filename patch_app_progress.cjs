const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `                results = await generateMetadataBatch(
                  keyObj.key,
                  payload,
                  { ...config, model: usedModel }
                );`;
const replacement1 = `                results = await generateMetadataBatch(
                  keyObj.key,
                  payload,
                  { ...config, model: usedModel },
                  (msg) => {
                    setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { ...p, progressMsg: msg } : p));
                  }
                );`;

content = content.replace(target1, replacement1);

const target2 = `        results = await generateMetadataBatch(keyObj.key, payload, config);`;
const replacement2 = `        results = await generateMetadataBatch(
            keyObj.key, 
            payload, 
            config,
            (msg) => {
              setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { ...p, progressMsg: msg } : p));
            }
        );`;
content = content.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', content);
