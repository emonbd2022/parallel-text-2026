const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `const [startTimeMs, setStartTimeMs] = useState<number | null>(() => {
    const s = localStorage.getItem('startTimeMs');
    return s ? parseInt(s) : null;
  });`,
  `const [elapsedMs, setElapsedMs] = useState<number>(() => {
    const s = localStorage.getItem('elapsedMs');
    return s ? parseInt(s, 10) : 0;
  });`
);

fs.writeFileSync('src/App.tsx', code);
