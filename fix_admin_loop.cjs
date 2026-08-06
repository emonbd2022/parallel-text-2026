const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(
  `                      </tr>
                  ))
                )}`,
  `                      </tr>
                  );
                })
                )}`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
