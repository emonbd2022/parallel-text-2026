const fs = require('fs');

const content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('{/* Central Unlock Progress / Notice */}'));
// find the closing div of this block which ends around line 360
// let's just search for `{/* Central Mode Admin Notice */}` or the end of the block
let endIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes('Unlocks at 4 keys')) {
        endIdx = i + 3; // roughly the end of the block
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    const newNotice = `      {/* Central API Usage / Status */}
      {apiMode === 'central' && centralUsage && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/30 rounded-xl space-y-4 shadow-lg shadow-purple-900/20">
          <div className="flex justify-between items-center pb-3 border-b border-purple-500/20">
             <div className="font-bold text-purple-100 text-sm flex items-center gap-2">
                 <Zap className="w-4 h-4 text-purple-400 shrink-0" /> Central API Available
             </div>
             <button onClick={fetchCentralUsage} className="text-xs text-purple-400/80 hover:text-purple-300 transition-colors">
                 {fetchingUsage ? 'Refreshing...' : 'Refresh'}
             </button>
          </div>
          
          <div className="flex flex-col gap-1.5 items-center justify-center py-2">
             <div className="text-3xl font-black text-white tracking-tight">
                 {centralUsage.remainingImages} <span className="text-base font-semibold text-purple-300/80">images remaining</span>
             </div>
             <div className="text-sm font-medium text-slate-400 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700/50">
                 {centralUsage.remainingRequests} / {centralUsage.limitRequests} requests available
             </div>
          </div>
          
          <div className="text-xs font-mono font-medium text-purple-200/90 bg-purple-950/40 p-2.5 rounded-lg border border-purple-500/20 text-center shadow-inner">
             {centralUsage.localKeyCount} Local API Key{centralUsage.localKeyCount === 1 ? '' : 's'} × 50 Images = {centralUsage.limitImages} Images/day
          </div>
          
          <div className="text-[11px] text-slate-300 flex justify-between items-center pt-3 border-t border-purple-500/20">
             <span className="font-medium text-purple-200/70">Need more Central API capacity?</span>
             <span className="text-emerald-400 font-bold cursor-pointer hover:text-emerald-300 hover:underline transition-all flex items-center gap-1" onClick={() => { onChangeApiMode('local'); setShowAddModal(true); }}>
                 Add 2 more API keys <span className="text-emerald-500/50">→</span> +100 images/day
             </span>
          </div>
        </div>
      )}
      
      {/* Central Unlock Progress / Notice */}
      {!isCentralDisabledForUser && !isEligibleForCentral && apiMode !== 'central' && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/30 rounded-xl text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              Central API Mode
            </div>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Add at least <strong>1 valid Gemini API key</strong> to your local pool to use the Central API.
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              Account Status: {!user && !userData ? (
                <strong className="text-slate-500">Not Logged In</strong>
              ) : (
                <strong className="text-purple-300">
                  {userData?.email || user?.email || 'Logged In'}
                </strong>
              )}
            </span>
            {!user && !userData ? (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 underline cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Login Required
              </button>
            ) : null}
          </div>
        </div>
      )}`;
      
    lines.splice(startIdx, endIdx - startIdx + 1, newNotice);
    fs.writeFileSync('src/components/ApiKeyManager.tsx', lines.join('\n'));
    console.log('patched');
} else {
    console.log('could not find block');
}
