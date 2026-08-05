const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');

const oldHeader = `<div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search users by name, email, or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 text-slate-200 placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Range:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 border-none" />
            <span className="text-slate-500">to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 border-none" />
          </div>
          <button onClick={fetchUsers} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>`;

const newHeader = `<div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search users by name, email, or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 text-slate-200 placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
            <div className="flex items-center pl-3 pr-2 text-slate-400">
               <Calendar className="w-4 h-4 mr-2 text-purple-400" />
               <span className="text-xs font-semibold uppercase tracking-wider">Date</span>
            </div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 rounded-lg px-3 py-2 text-sm text-slate-300 border-none outline-none focus:ring-1 focus:ring-purple-500" />
            <span className="text-slate-500 text-sm font-medium">to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 rounded-lg px-3 py-2 text-sm text-slate-300 border-none outline-none focus:ring-1 focus:ring-purple-500" />
            <button className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors ml-2 shadow-lg shadow-purple-900/20">
               Show Statistics
            </button>
          </div>
          <button onClick={fetchUsers} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors ml-auto" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>`;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
