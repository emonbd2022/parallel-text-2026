const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const verifyFn = `
async function verifyUserDevice(idToken: string | undefined, deviceId: string | undefined, uid: string): Promise<boolean> {
    if (!uid || !idToken || !deviceId) return false;
    
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';
    if (!projectId) return true;
    
    try {
        const url = \`https://firestore.googleapis.com/v1/projects/\${projectId}/databases/\${dbId}/documents/users/\${uid}\`;
        const headers: Record<string, string> = { 'Authorization': \`Bearer \${idToken}\` };
        const resp = await fetch(url, { headers });
        if (!resp.ok) return false;
        
        const data = await resp.json();
        const fields = data.fields || {};
        const deviceIds = fields.deviceIds?.arrayValue?.values?.map((v: any) => v.stringValue) || [];
        return deviceIds.includes(deviceId);
    } catch (e) {
        console.error("verifyUserDevice error:", e);
        return false;
    }
}
`;

content = content.replace('function getUserIdentity', verifyFn + '\nfunction getUserIdentity');

const genReplace = `
        const identity = getUserIdentity(req, user);
        const isAdmin = identity.isAdmin || adminFlag === true || hasExplicitAdminGrant === true;

        if (!isAdmin && identity.id) {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const deviceId = req.headers['x-device-id'] as string;
            const deviceAuthorized = await verifyUserDevice(idToken, deviceId, identity.id);
            if (!deviceAuthorized) {
                return res.status(403).json({ success: false, error: "Device Limit Reached. Contact Admin for device reset" });
            }
        }
`;

content = content.replace(
    /const identity = getUserIdentity\(req, user\);\s*const isAdmin = identity\.isAdmin \|\| adminFlag === true \|\| hasExplicitAdminGrant === true;/g,
    genReplace.trim()
);

fs.writeFileSync('server.ts', content);
