const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const navSearch = `          <div className="w-px h-6 bg-slate-800 mx-2" />
          {userData ? (
            <>
              <div className="flex items-center gap-3 mr-4">`;

const navReplace = `          <div className="w-px h-6 bg-slate-800 mx-2" />
          {userData ? (
            <>
              <div className="relative cursor-pointer mr-2 flex items-center" onClick={() => setShowNotifications(!showNotifications)}>
                 <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                 {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{unreadCount}</span>}
              </div>
              {showNotifications && (
                 <div className="absolute top-16 right-20 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 font-bold flex justify-between items-center">
                       Notifications
                       <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                       {notifications.length === 0 ? (
                          <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
                       ) : (
                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={\`p-3 border-b border-slate-700 text-sm cursor-pointer hover:bg-slate-700/50 transition-colors \${!n.read ? 'bg-slate-700/20' : 'opacity-60'}\`}>
                                <div className="flex items-center justify-between gap-2">
                                   <span className={\`font-medium \${!n.read ? 'text-white' : 'text-slate-400'}\`}>{n.message}</span>
                                   {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>}
                                </div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              )}
              <div className="flex items-center gap-3 mr-4">`;

code = code.replace(navSearch, navReplace);
fs.writeFileSync('src/components/Layout.tsx', code);
