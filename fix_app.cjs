const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Import the cache service
if (!content.includes('import { getEncryptedCentralKeys, saveEncryptedCentralKeys }')) {
    content = content.replace("import { fetchCentralKeysFromFirestore } from './services/centralKeyService';", "import { fetchCentralKeysFromFirestore } from './services/centralKeyService';\nimport { getEncryptedCentralKeys, saveEncryptedCentralKeys } from './services/centralKeyCacheService';");
}

// Replace fetchCentralKeysPool logic
const fetchRegex = /\/\/ 1-Read Central API Keys Pool Fetch[\s\S]*?return \[\];\n\s*\};\n/g;

const fetchReplacement = `// Central API Keys Pool Fetch with secure encrypted localStorage cache
  const fetchCentralKeysPool = async (forceRefresh = false): Promise<ApiKey[]> => {
    try {
      const currentSession = getUsageSessionId();
      
      // 1. Check local encrypted cache first
      if (!forceRefresh) {
        const cached = getEncryptedCentralKeys();
        if (cached && cached.keys && cached.keys.length > 0) {
          const pool: ApiKey[] = cached.keys.map((k, idx) => ({
            id: k.id || \`central-\${idx}\`,
            label: \`Central Pool Node \${idx + 1}\`,
            key: k.key, // Extracted from encrypted cache into RAM
            errorCount: 0,
            usage: { date: currentSession, flash: 0, lite: 0, pro: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_6: 0, flash_3_7: 0 }
          }));
          setCentralKeys(pool);
          return pool;
        }
      }

      // 2. Fetch fresh real keys from backend sync endpoint
      const res = await fetch('/api/central-keys-pool-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          localKeys: localKeys.map(k => k.key), 
          isAdmin: userData?.role === 'admin' || userData?.role === 'superadmin',
          hasExplicitAdminGrant: false // can add this if needed
        })
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && Array.isArray(data.keys) && data.keys.length > 0) {
            
            // Save to encrypted local storage cache
            saveEncryptedCentralKeys(data.keys);

            const pool: ApiKey[] = data.keys.map((k: any, idx: number) => ({
              id: k.id || \`central-\${idx}\`,
              label: \`Central Pool Node \${idx + 1}\`,
              key: k.key, // Load into RAM
              errorCount: 0,
              usage: { date: currentSession, flash: 0, lite: 0, pro: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_6: 0, flash_3_7: 0 }
            }));
            setCentralKeys(pool);
            return pool;
          }
        }
      }
    } catch (e) {
      console.warn("Central keys pool sync notice:", e);
    }
    return [];
  };
`;

content = content.replace(fetchRegex, fetchReplacement);

fs.writeFileSync('src/App.tsx', content);
