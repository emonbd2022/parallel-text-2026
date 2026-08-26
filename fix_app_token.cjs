const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const res = await fetch\('\/api\/central-keys-pool-sync', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},/g;

const replacement = `
      let idToken = '';
      try {
        if (auth?.currentUser) {
           idToken = await auth.currentUser.getIdToken();
        }
      } catch (e) {}
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) {
          headers['Authorization'] = \`Bearer \${idToken}\`;
      }

      const res = await fetch('/api/central-keys-pool-sync', {
        method: 'POST',
        headers,`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
