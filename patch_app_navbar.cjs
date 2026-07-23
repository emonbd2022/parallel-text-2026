const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<button 
                id="save-btn"`;

const replacement = `<button
                onClick={() => setShowStats(true)}
                title="View Processing Statistics"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all font-semibold border border-white/5 text-sm flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-4"/></svg>
                Stats
              </button>

              <button 
                id="save-btn"`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
