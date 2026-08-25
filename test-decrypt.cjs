const crypto = require('crypto');
const SECRET_KEY = process.env.CENTRAL_API_SECRET_KEY || 'development_secret_key_needs_32_bytes!';
const keyBuffer = crypto.createHash('sha256').update(SECRET_KEY).digest();
function decrypt(encText) {
    const [ivHex, authTagHex, encrypted] = encText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
console.log(decrypt("c6f93cde90e18022e4a9a476:7188ddf313ee93308cdaf205220f4e58:768b582acb7c38b52de6cffa4a42914b727c040635ba96d06d88052415aeff3e272f5c0f6e8868"));
