const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    'const [sessionRequestCount, setSessionRequestCount] = useState(0);',
    'const sessionRequestCountRef = useRef(0);'
);

content = content.replace(
    /setSessionRequestCount\(prev => prev \+ 1\);/g,
    'sessionRequestCountRef.current += 1;'
);

content = content.replace(
    'const totalRequests = sessionRequestCount;',
    'const totalRequests = sessionRequestCountRef.current;'
);

fs.writeFileSync('src/App.tsx', content);
