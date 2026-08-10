const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const searchBarHtml = `<div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
          <div className="flex items-center gap-3 mb-6 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <Search className="w-5 h-5 text-slate-500 ml-2" />`;

const newSearchBarHtml = `<div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800 mr-4">
              <Search className="w-5 h-5 text-slate-500 ml-2" />
              <input 
                type="text" 
                placeholder="Search users by name, email, or nickname..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-200 w-full py-1"
              />
            </div>
            <button 
              onClick={() => setNotifModal({isOpen: true, message: ''})}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Bell className="w-4 h-4" />
              Global Notification
            </button>
          </div>
          <div className="flex items-center gap-3 mb-6 bg-slate-950 p-2 rounded-xl border border-slate-800 hidden">
            <Search className="w-5 h-5 text-slate-500 ml-2" />`;

code = code.replace(searchBarHtml, newSearchBarHtml);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
