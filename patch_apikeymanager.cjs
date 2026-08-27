const fs = require('fs');

let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

// Replace isEligibleForCentral
content = content.replace(
    /const hasEightKeysUnlocked = Boolean\(\(user \|\| userData\) && uniqueLocalKeysCount >= 4\);\n\s*const isEligibleForCentral = hasExplicitAdminGrant \|\| isCentralAdmin \|\| hasEightKeysUnlocked;/,
    `const hasEightKeysUnlocked = Boolean((user || userData) && uniqueLocalKeysCount >= 1);
  const isEligibleForCentral = hasExplicitAdminGrant || isCentralAdmin || hasEightKeysUnlocked;`
);

// Add the hook and state for usage tracking
const usageStateCode = `
  const [centralUsage, setCentralUsage] = React.useState<any>(null);
  const [fetchingUsage, setFetchingUsage] = React.useState(false);

  const fetchCentralUsage = React.useCallback(async () => {
    if (!auth?.currentUser) return;
    setFetchingUsage(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const keys = sourceLocalKeys.map(k => k.key);
      const res = await fetch('/api/central-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ localKeys: keys })
      });
      if (res.ok) {
        const data = await res.json();
        setCentralUsage(data);
      }
    } catch (e) {
      console.error('Failed to fetch central usage', e);
    } finally {
      setFetchingUsage(false);
    }
  }, [sourceLocalKeys]);

  React.useEffect(() => {
    if (apiMode === 'central') {
      fetchCentralUsage();
    }
  }, [apiMode, fetchCentralUsage]);
`;

// Insert the state code inside ApiKeyManager
content = content.replace(
    /const \[showAddModal, setShowAddModal\] = useState\(false\);/,
    `const [showAddModal, setShowAddModal] = useState(false);\n${usageStateCode}`
);

// We need to import `auth` if not imported
if (!content.includes("import { auth }")) {
    content = content.replace("import { addGlobalNotification }", "import { auth } from '../lib/firebase';\nimport { addGlobalNotification }");
}

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
console.log('ApiKeyManager patched (part 1)');
