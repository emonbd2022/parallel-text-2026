const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// I need to find the last </div>\n    </div>\n  );\n}
const oldStr = `      </div>
    </div>
  );
}`;
const newStr = `      </div>
    </div>
    </>
  );
}`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/App.tsx', content);
