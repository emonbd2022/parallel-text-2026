const fs = require('fs');
let content = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf8');

const target1 = `<span>{item.status === 'processing' ? 'Processing...' : isWaitingRetry(item) ? \`Retrying (\${item.attempts})...\` : item.status}</span>`;
const replacement1 = `<span>{item.status === 'processing' ? (item.progressMsg || 'Processing...') : isWaitingRetry(item) ? \`Retrying (\${item.attempts})...\` : item.status}</span>`;

content = content.replace(target1, replacement1);

// Also replace the placeholder text of title and keywords if we want
const placeholderTarget = `placeholder={item.status === 'pending' ? 'Waiting for generation...' : 'Processing title...'}`;
const placeholderReplacement = `placeholder={item.status === 'pending' ? 'Waiting for generation...' : (item.status === 'processing' ? (item.progressMsg || 'Processing title...') : 'Processing title...')}`;
content = content.replace(placeholderTarget, placeholderReplacement);

const placeholderKwTarget = `placeholder={item.status === 'pending' ? 'Waiting for generation...' : 'Processing keywords...'}`;
const placeholderKwReplacement = `placeholder={item.status === 'pending' ? 'Waiting for generation...' : (item.status === 'processing' ? (item.progressMsg || 'Processing keywords...') : 'Processing keywords...')}`;
content = content.replace(placeholderKwTarget, placeholderKwReplacement);

fs.writeFileSync('src/components/ProcessingQueue.tsx', content);
