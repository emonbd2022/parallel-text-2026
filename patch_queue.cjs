const fs = require('fs');
let code = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf8');

const oldStatusLine = `<span>{item.status === 'processing' ? (item.progressMsg || 'Processing...') : isWaitingRetry(item) ? \`Retrying (\${item.attempts})...\` : item.status}</span>`;
const newStatusLine = `<span>{item.status === 'processing' ? (item.progressMsg || 'Processing...') : isWaitingRetry(item) ? \`Retrying (\${item.attempts})...\` : (item.status === 'pending' && item.title && !item.category) ? 'pending category' : item.status}</span>`;

code = code.replace(oldStatusLine, newStatusLine);

fs.writeFileSync('src/components/ProcessingQueue.tsx', code);
