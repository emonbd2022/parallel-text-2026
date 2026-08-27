const fs = require('fs');

let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

// Replace "Requires 4 keys" button text
content = content.replace(
    /Requires 4 keys \(\{uniqueLocalKeysCount\}\/4\)/g,
    'Requires 1 key (${uniqueLocalKeysCount}/1)'
);

// We will just do a Regex replace for the Central Unlock Progress Notice block
const noticeRegex = /\{\/\*\s*Central Unlock Progress \/ Notice\s*\*\/\}([\s\S]*?)<\/span>\s*<\/div>\s*<\/div>\s*\)\}/;
if (noticeRegex.test(content)) {
    const newNotice = `{/* Central API Usage / Status */}
      {apiMode === 'central' && centralUsage && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/30 rounded-xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
             <div className="font-bold text-purple-300 text-sm flex items-center gap-2">
                 <Zap className="w-4 h-4 text-purple-400 shrink-0" /> Central API Available
             </div>
             <button onClick={fetchCentralUsage} className="text-xs text-purple-400/80 hover:text-purple-300 transition-colors">
                 {fetchingUsage ? 'Refreshing...' : 'Refresh'}
             </button>
          </div>
          
          <div className="flex flex-col gap-1">
             <div className="text-xl font-black text-white">
                 {centralUsage.remainingImages} images remaining
             </div>
             <div className="text-xs text-slate-400">
                 {centralUsage.remainingRequests} / {centralUsage.limitRequests} requests available today
             </div>
          </div>
          
          <div className="text-xs font-mono text-purple-300/80 bg-purple-950/30 p-2 rounded border border-purple-500/20">
             {centralUsage.localKeyCount} Local API Keys × 50 Images = {centralUsage.limitImages} Images
          </div>
          
          <div className="text-[11px] text-slate-400 flex justify-between items-center pt-1 border-t border-slate-800">
             <span>Need more capacity?</span>
             <span className="text-emerald-400 font-semibold cursor-pointer hover:underline" onClick={() => { onChangeApiMode('local'); setShowAddModal(true); }}>
                 Add 2 more API keys → +100 images/day
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
    content = content.replace(noticeRegex, newNotice);
} else {
    console.error("Notice regex did not match!");
}

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
console.log('ApiKeyManager patched (part 2)');
