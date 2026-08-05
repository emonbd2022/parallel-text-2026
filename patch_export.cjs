const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace sessionRequestCountRef initialization
code = code.replace(
    "const sessionRequestCountRef = useRef(0);",
    "const sessionRequestCountRef = useRef(parseInt(localStorage.getItem('sessionReqCount') || '0'));\n  useEffect(() => {\n    const idx = setInterval(() => localStorage.setItem('sessionReqCount', sessionRequestCountRef.current.toString()), 5000);\n    return () => clearInterval(idx);\n  }, []);"
);

// Replace startTimeMs initialization
code = code.replace(
    "const [startTimeMs, setStartTimeMs] = useState<number | null>(null);",
    "const [startTimeMs, setStartTimeMs] = useState<number | null>(() => {\n    const s = localStorage.getItem('startTimeMs');\n    return s ? parseInt(s) : null;\n  });\n  useEffect(() => {\n    if (startTimeMs) localStorage.setItem('startTimeMs', startTimeMs.toString());\n    else localStorage.removeItem('startTimeMs');\n  }, [startTimeMs]);"
);

// reset sessionRequestCountRef when clearing
code = code.replace(
    "setStartTimeMs(null);\n          setItems([]);\n          localStorage.removeItem(STORAGE_ITEMS);",
    "setStartTimeMs(null);\n          sessionRequestCountRef.current = 0;\n          localStorage.setItem('sessionReqCount', '0');\n          setItems([]);\n          localStorage.removeItem(STORAGE_ITEMS);"
);

fs.writeFileSync('src/App.tsx', code);
