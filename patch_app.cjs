const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const mappingCode = `
const getCategoryId = (categoryName?: string) => {
    if (!categoryName) return '';
    const map: Record<string, string> = {
        "animals": "1",
        "buildings and architecture": "2",
        "business": "3",
        "drinks": "4",
        "the environment": "5",
        "states of mind": "6",
        "food": "7",
        "graphic resources": "8",
        "hobbies and leisure": "9",
        "industry": "10",
        "landscapes": "11",
        "lifestyle": "12",
        "people": "13",
        "plants and flowers": "14",
        "culture and religion": "15",
        "science": "16",
        "social issues": "17",
        "sports": "18",
        "technology": "19",
        "transport": "20",
        "travel": "21"
    };
    return map[categoryName.trim().toLowerCase()] || categoryName;
};
`;

content = content.replace(/export default function App\(\) \{/, mappingCode + '\\nexport default function App() {');

content = content.replace(
    /const safeCategory = \`"\$\{\(item\.category \|\| 'Technology'\)\.replace\(\/"\/g, '""'\)\}"\`;/,
    `const safeCategory = \`"\${getCategoryId(item.category).replace(/"/g, '""')}"\`;`
);

content = content.replace(
    /const safeCategory = \`"\$\{\(i\.category \|\| 'Technology'\)\.replace\(\/"\/g, '""'\)\}"\`;/,
    `const safeCategory = \`"\${getCategoryId(i.category).replace(/"/g, '""')}"\`;`
);

fs.writeFileSync('src/App.tsx', content);
console.log("Success");
