const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import confetti')) {
    content = content.replace(
        "import { Clock, Key, Hourglass, Cat } from 'lucide-react';",
        "import { Clock, Key, Hourglass, Cat } from 'lucide-react';\nimport confetti from 'canvas-confetti';"
    );
}

const target = `        if (!hasActive) {
            setIsProcessing(false);
            const allDone = items.length > 0 && items.every(i => i.status === 'done');
            if (allDone) {
                setStatusMsg('Processing complete.');
                playSuccessSound();`;

const replacement = `        if (!hasActive) {
            setIsProcessing(false);
            const allDone = items.length > 0 && items.every(i => i.status === 'done');
            if (allDone) {
                setStatusMsg('Processing complete.');
                playSuccessSound();
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#a855f7', '#d946ef', '#10b981', '#3b82f6', '#f59e0b']
                });`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
