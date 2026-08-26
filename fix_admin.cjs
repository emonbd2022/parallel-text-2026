const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const regex = /onClick=\{\(\) => fetchPage\(currentPage, true\)\}/g;
const replacement = `onClick={() => {
                sessionStorage.removeItem('adminCachedAllUsers');
                sessionStorage.removeItem('adminCachedUsersByPage');
                setAllUsers([]);
                setUsersByPage({});
                setLastVisibleByPage({});
                setTimeout(() => fetchPage(1, true), 50);
              }}`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
