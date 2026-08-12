const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const effectTarget = /  useEffect\(\(\) => \{\n    if \(\!userData\) return;\n    const fetchExports = async \(\) => \{[\s\S]*?fetchExports\(\);\n  \}, \[userData\?.uid\]\);/m;
code = code.replace(effectTarget, '');

const csvExportsTarget = /const \[csvExports, setCsvExports\] = useState<any\[\]>\(\[\]\);\n  const \[loadingExports, setLoadingExports\] = useState\(true\);/m;
code = code.replace(csvExportsTarget, '');

const divTarget = /<div className="bg-slate-900\/50 border border-slate-800 rounded-3xl p-8 shadow-xl mt-8">[\s\S]*?<\/div>\n      <\/div>/m;
code = code.replace(divTarget, '      </div>');

fs.writeFileSync('src/pages/Dashboard.tsx', code);
