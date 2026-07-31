const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', \`\${items.length}.csv\`);`;

const replacement = `    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStrFormat = dateObj.toTimeString().split(' ')[0].replace(/:/g, '-');
    let exportFileName = \`\${items.length}.csv\`;
    if (config.exportFilenameTemplate) {
        exportFileName = config.exportFilenameTemplate
            .replace('{count}', items.length.toString())
            .replace('{date}', dateStr)
            .replace('{time}', timeStrFormat);
        if (!exportFileName.toLowerCase().endsWith('.csv')) exportFileName += '.csv';
    }
    
    link.setAttribute('download', exportFileName);`;

content = content.replace(target, replacement);

const targetStats = `setExportStats({ count: completedItems.length, path: \`\${items.length}.csv\`, elapsedTime: timeStr, requestCount: totalRequests, timeSaved: timeSavedStr });`;
const replacementStats = `setExportStats({ count: completedItems.length, path: exportFileName, elapsedTime: timeStr, requestCount: totalRequests, timeSaved: timeSavedStr });`;
content = content.replace(targetStats, replacementStats);

fs.writeFileSync('src/App.tsx', content);
