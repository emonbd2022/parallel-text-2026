const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');

code = code.replace(
  `const [dateRangeImages, setDateRangeImages] = useState(0);`,
  `const [dateRangeImages, setDateRangeImages] = useState(0);\n  const [showStats, setShowStats] = useState(false);`
);

code = code.replace(
  `<button className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors ml-2 shadow-lg shadow-purple-900/20">
               Show Statistics
            </button>`,
  `<button onClick={() => setShowStats(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors ml-2 shadow-lg shadow-purple-900/20">
               Show Statistics
            </button>`
);

// Add stats modal
code = code.replace(
  `</motion.div>
  );`,
  `  {showStats && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
               <Calendar className="w-6 h-6 text-purple-400" />
               Date Range Statistics
            </h2>
            <div className="space-y-4 mb-8">
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Total Users</span>
                  <span className="text-xl font-bold text-white">{filteredUsers.length}</span>
               </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Total Images (All Time)</span>
                  <span className="text-xl font-bold text-white">{totalSiteImages}</span>
               </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Images in Date Range</span>
                  <span className="text-xl font-bold text-emerald-400">{dateRangeImages}</span>
               </div>
            </div>
            <button onClick={() => setShowStats(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors">
               Close
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
