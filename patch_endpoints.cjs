const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Replace central-generate logic
const generateMatch = content.match(/apiRouter\.post\("\/central-generate"[\s\S]*?(const apiKey = await getRealKey\(virtualKeyId\);)/);
if (generateMatch) {
    const newGenerateCheck = `
        const uid = getUidFromToken(req.headers.authorization);
        if (!uid) throw new Error("Unauthorized: Please sign in to use Central API");
        
        let localKeyCount = 0;
        if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
            localKeyCount = uniqueKeys.size;
        }

        const limitRequests = localKeyCount * 100;
        if (!isAdmin && !hasExplicitAdminGrant && localKeyCount === 0) {
            throw new Error("Central API access requires at least 1 Local API key.");
        }

        const date = getUsagePeriodId();
        const usedRequests = await fetchUserUsage(uid, date);
        const requiredRequests = items.length; // 1 request per image for this endpoint

        if (!isAdmin && !hasExplicitAdminGrant && (usedRequests + requiredRequests > limitRequests)) {
            throw new Error(\`Daily Central API limit exceeded. You have \${Math.max(0, limitRequests - usedRequests)} requests remaining.\`);
        }

        incrementUserUsage(uid, requiredRequests, date);

        $1`;
    
    // We need to carefully replace the old check
    content = content.replace(
        /let isEligible = false;[\s\S]*?throw new Error\("Central API access requires at least 4 unique local API keys or Administrator approval\."\);\s*}\s*const apiKey = await getRealKey\(virtualKeyId\);/,
        newGenerateCheck.replace('$1', 'const apiKey = await getRealKey(virtualKeyId);')
    );
}

// Replace central-category logic
const categoryMatch = content.match(/let isEligible = false;[\s\S]*?throw new Error\("Central API access requires at least 4 unique local API keys or Administrator approval\."\);\s*}\s*const apiKey = await getRealKey\(virtualKeyId\);/g);

if (categoryMatch && categoryMatch.length >= 2) {
    const newCategoryCheck = `
        const uid = getUidFromToken(req.headers.authorization);
        if (!uid) throw new Error("Unauthorized: Please sign in to use Central API");
        
        let localKeyCount = 0;
        if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
            localKeyCount = uniqueKeys.size;
        }

        const limitRequests = localKeyCount * 100;
        if (!isAdmin && !hasExplicitAdminGrant && localKeyCount === 0) {
            throw new Error("Central API access requires at least 1 Local API key.");
        }

        const date = getUsagePeriodId();
        const usedRequests = await fetchUserUsage(uid, date);
        const requiredRequests = items.length; // 1 request per image for this endpoint

        if (!isAdmin && !hasExplicitAdminGrant && (usedRequests + requiredRequests > limitRequests)) {
            throw new Error(\`Daily Central API limit exceeded. You have \${Math.max(0, limitRequests - usedRequests)} requests remaining.\`);
        }

        incrementUserUsage(uid, requiredRequests, date);

        const apiKey = await getRealKey(virtualKeyId);`;

    content = content.replace(categoryMatch[1], newCategoryCheck);
} else {
    // If we only have one match remaining (since we replaced generate already)
    const newCategoryCheck = `
        const uid = getUidFromToken(req.headers.authorization);
        if (!uid) throw new Error("Unauthorized: Please sign in to use Central API");
        
        let localKeyCount = 0;
        if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
            localKeyCount = uniqueKeys.size;
        }

        const limitRequests = localKeyCount * 100;
        if (!isAdmin && !hasExplicitAdminGrant && localKeyCount === 0) {
            throw new Error("Central API access requires at least 1 Local API key.");
        }

        const date = getUsagePeriodId();
        const usedRequests = await fetchUserUsage(uid, date);
        const requiredRequests = items.length; // 1 request per image for this endpoint

        if (!isAdmin && !hasExplicitAdminGrant && (usedRequests + requiredRequests > limitRequests)) {
            throw new Error(\`Daily Central API limit exceeded. You have \${Math.max(0, limitRequests - usedRequests)} requests remaining.\`);
        }

        incrementUserUsage(uid, requiredRequests, date);

        const apiKey = await getRealKey(virtualKeyId);`;

    content = content.replace(/let isEligible = false;[\s\S]*?throw new Error\("Central API access requires at least 4 unique local API keys or Administrator approval\."\);\s*}\s*const apiKey = await getRealKey\(virtualKeyId\);/, newCategoryCheck);
}

fs.writeFileSync('server.ts', content);
console.log('endpoints patched');
