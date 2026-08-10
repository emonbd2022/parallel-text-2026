const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const oldRoutes = `<Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      </Routes>`;

const newRoutes = `<Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>`;

code = code.replace(oldRoutes, newRoutes);
fs.writeFileSync('src/main.tsx', code);
