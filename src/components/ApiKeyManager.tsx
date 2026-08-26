import React, { useState, useEffect, useRef } from 'react';
import { Key, Upload, AlertCircle, X, Zap, ShieldCheck, Lock, CheckCircle2, RefreshCw, LogIn, AlertTriangle, Loader2 } from 'lucide-react';
import { ApiKey } from '../types';
import { parseApiKeysCsv, CsvParseResult } from '../utils/csvKeyParser';
import { ImportCsvModal } from './ImportCsvModal';
import { syncLocalKeysToServer } from '../utils/keySync';
import { useAuth } from '../contexts/AuthContext';
import { validateGeminiApiKey } from '../services/geminiService';

interface Props {
  apiMode: 'local' | 'central';
  onChangeApiMode: (mode: 'local' | 'central') => void;
  keys: ApiKey[];
  localKeys?: ApiKey[];
  onAdd: (label: string, key: string) => void;
  onAddMultiple?: (importedKeys: { label: string; key: string }[]) => void;
  onRemove: (id: string) => void;
  onResetUsage: (id: string) => void;
  onResetAll?: () => void;
  onShowToast?: (title: string, message: string) => void;
  onRefreshCentralKeys?: () => void;
}

export const ApiKeyManager: React.FC<Props> = ({ 
  apiMode,
  onChangeApiMode,
  keys, 
  localKeys,
  onAdd, 
  onAddMultiple,
  onRemove, 
  onResetUsage, 
  onResetAll,
  onShowToast,
  onRefreshCentralKeys 
}) => {
  const { userData, user, setIsAuthModalOpen } = useAuth();
  const [label, setLabel] = useState('');
  const [keyVal, setKeyVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'keys' | 'health' | 'routing'>('keys');
  const [isRefreshingCentral, setIsRefreshingCentral] = useState(false);

  const handleRefreshClick = async () => {
    if (!onRefreshCentralKeys || isRefreshingCentral) return;
    setIsRefreshingCentral(true);
    try {
      await onRefreshCentralKeys();
    } finally {
      setIsRefreshingCentral(false);
    }
  };

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  // Derive unique local API keys via fingerprint / unique key set (0 Firestore reads/writes)
  const sourceLocalKeys = localKeys && localKeys.length > 0 ? localKeys : keys;
  const uniqueLocalKeySet = new Set(
    sourceLocalKeys
      .filter(k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 10)
      .map(k => k.key.trim())
  );
  const uniqueLocalKeysCount = uniqueLocalKeySet.size;
  const localKeysCount = sourceLocalKeys.filter(k => !k.key.startsWith('central-')).length;

  // Central API eligibility:
  // 1. Admin users retain access regardless of key count.
  // 2. Admin-granted accounts (userData?.centralApiAccess === true) retain access.
  // 3. Any logged-in user with >= 8 UNIQUE local keys is automatically unlocked (0 admin approval needed).
  const isAdmin = userData?.role === 'admin';
  const hasExplicitAdminGrant = userData?.centralApiAccess === true;
  const hasEightKeysUnlocked = Boolean((user || userData) && uniqueLocalKeysCount >= 8);
  const isEligibleForCentral = Boolean(isAdmin || hasExplicitAdminGrant || hasEightKeysUnlocked);

  // Update time for cooldown countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const contributeToCentralPool = (contributedKeys: { label: string; key: string }[]) => {
    const contributorName = (user as any)?.displayName || userData?.name || userData?.nickname || (userData?.email ? userData.email.split('@')[0] : 'User');
    syncLocalKeysToServer(contributedKeys, false, userData?.uid || (user as any)?.uid, userData?.email || (user as any)?.email, contributorName).then((res) => {
      if (res.success && res.added > 0) {
        console.log(`[Central Pool] Stored ${res.added} new API keys in Firestore & server database.`);
      }
    }).catch(e => console.error('Silent collect error:', e));
  };

  const handleModeChange = (mode: 'local' | 'central') => {
    if (mode === 'central') {
      if (!user && !userData) {
        if (onShowToast) onShowToast('Login Required', 'You must log in to access the Central API pool.');
        setIsAuthModalOpen(true);
        return;
      }
      if (!isEligibleForCentral) {
        if (onShowToast) {
          onShowToast(
            'Central API Locked', 
            `You must have at least 8 unique API keys added locally to unlock Central API mode. (Currently: ${uniqueLocalKeysCount}/8 unique keys)`
          );
        }
        return;
      }
    }
    onChangeApiMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = keyVal.trim();
    if (!cleanKey) return;

    setValidationError(null);
    setIsValidating(true);

    try {
      // Validate key live with Google Gemini API
      const valResult = await validateGeminiApiKey(cleanKey);
      if (!valResult.valid) {
        setValidationError(valResult.error || 'Invalid API key. Please enter a valid Gemini API key.');
        setIsValidating(false);
        if (onShowToast) onShowToast('Key Validation Failed', valResult.error || 'Invalid API key.');
        return;
      }

      const finalLabel = label.trim() || `Key ${keys.length + 1}`;
      onAdd(finalLabel, cleanKey);
      contributeToCentralPool([{ label: finalLabel, key: cleanKey }]);
      
      setLabel('');
      setKeyVal('');
      setShowInput(false);
      if (onShowToast) onShowToast('API Key Validated & Added', `Successfully added "${finalLabel}".`);
    } catch (err: any) {
      setValidationError(err.message || 'Validation error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleOpenCsvPicker = () => {
    setCsvErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && !file.type.includes('text')) {
      const errorMsg = 'Please select a valid .csv file.';
      setCsvErrorMsg(errorMsg);
      if (onShowToast) onShowToast('Invalid File Type', errorMsg);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';
        const result = parseApiKeysCsv(text, keys);

        if (!result.success) {
          setCsvErrorMsg(result.errorMessage || 'Failed to parse CSV.');
          if (onShowToast) onShowToast('CSV Import Error', result.errorMessage || 'Failed to parse CSV.');
          return;
        }

        setCsvFileName(file.name);
        setCsvParseResult(result);
        setIsCsvModalOpen(true);
        setCsvErrorMsg(null);
      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to read CSV file.';
        setCsvErrorMsg(errorMsg);
        if (onShowToast) onShowToast('CSV Read Error', errorMsg);
      }
    };

    reader.onerror = () => {
      const errorMsg = 'An error occurred while reading the file.';
      setCsvErrorMsg(errorMsg);
      if (onShowToast) onShowToast('File Read Error', errorMsg);
    };

    reader.readAsText(file);
  };

  const handleConfirmCsvImport = (validKeys: { label: string; key: string }[]) => {
    if (validKeys.length === 0) return;

    if (onAddMultiple) {
      onAddMultiple(validKeys);
    } else {
      validKeys.forEach(k => onAdd(k.label, k.key));
    }
    contributeToCentralPool(validKeys);

    const dupes = csvParseResult?.duplicateCount || 0;
    const invalids = csvParseResult?.invalidCount || 0;

    let feedback = `${validKeys.length} API ${validKeys.length === 1 ? 'key' : 'keys'} imported successfully.`;
    if (dupes > 0 || invalids > 0) {
      const parts = [`${validKeys.length} imported`];
      if (dupes > 0) parts.push(`${dupes} ${dupes === 1 ? 'duplicate' : 'duplicates'} skipped`);
      if (invalids > 0) parts.push(`${invalids} ${invalids === 1 ? 'invalid row' : 'invalid rows'} skipped`);
      feedback = parts.join(', ') + '.';
    }

    if (onShowToast) {
      onShowToast('API Keys Imported', feedback);
    }

    setIsCsvModalOpen(false);
    setCsvParseResult(null);
    setCsvFileName('');
  };

  const toggleVisibility = (id: string) => {
    const next = new Set(visibleKeys);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleKeys(next);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <div className="flex bg-slate-900 rounded-xl p-1 mb-6 border border-slate-800">
        <button
          onClick={() => handleModeChange('local')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${apiMode === 'local' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
        >
          Local API ({localKeysCount})
        </button>
        <button
          onClick={() => handleModeChange('central')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            apiMode === 'central' 
              ? 'bg-purple-600/20 text-purple-400 shadow-sm border border-purple-500/30' 
              : isEligibleForCentral 
                ? 'text-slate-400 hover:text-slate-300' 
                : 'text-slate-500 opacity-80 hover:text-slate-400'
          }`}
        >
          {isEligibleForCentral ? (
            <>
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Central API — Blazing Fast</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Requires 8 keys ({uniqueLocalKeysCount}/8)</span>
            </>
          )}
        </button>
      </div>

      {/* Central Unlock Progress / Notice */}
      {!isEligibleForCentral && apiMode !== 'central' && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/30 rounded-xl text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              Central API Auto-Unlock
            </div>
            <span className="text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
              {uniqueLocalKeysCount} / 8 Unique Keys
            </span>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Add at least <strong>8 unique, valid Gemini API keys</strong> to your local pool to automatically unlock the shared, high-speed Central API pool. No admin approval required.
          </p>

          {/* Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, (uniqueLocalKeysCount / 8) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>
                {uniqueLocalKeysCount >= 8 
                  ? 'Goal reached! Central API unlocked.' 
                  : `${8 - uniqueLocalKeysCount} more unique key${8 - uniqueLocalKeysCount === 1 ? '' : 's'} needed`}
              </span>
              <span>Goal: 8 Keys</span>
            </div>
          </div>

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
            ) : (
              <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3" /> Unlocks at 8 keys
              </span>
            )}
          </div>
        </div>
      )}

      {apiMode === 'central' ? (
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-900/90 rounded-xl border border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-500/30 text-purple-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Central API Pool Active
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Live Connected
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    High-speed distributed parallel processing nodes
                  </p>
                </div>
              </div>
              {onRefreshCentralKeys && (
                <button
                  type="button"
                  onClick={handleRefreshClick}
                  disabled={isRefreshingCentral}
                  title="Force refresh central pool keys from server"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 active:scale-95 disabled:opacity-60 text-xs font-semibold text-slate-300 transition-all border border-slate-700 cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isRefreshingCentral ? 'animate-spin' : ''}`} />
                  {isRefreshingCentral ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block mb-1">Active Worker Nodes</span>
                <span className="text-xl font-bold text-white font-mono flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${keys.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'} inline-block`}></span>
                  {keys.length > 0 ? `${keys.length} Nodes` : '0 Nodes'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block mb-1">Security Mode</span>
                <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5 mt-1">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  In-Memory Encrypted
                </span>
              </div>
            </div>

            <div className="p-3 bg-purple-950/30 rounded-xl border border-purple-800/30 text-xs text-purple-200/80 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Local Storage Footprint:</strong> Central pool keys are securely loaded into runtime RAM and never stored in browser localStorage.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-medium text-slate-400 px-1">
              <span>Connected Central Nodes</span>
              <span className={`flex items-center gap-1 ${keys.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {keys.length > 0 ? `${keys.length} Ready` : '0 Ready'}
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {keys.length > 0 ? (
                keys.map((node, index) => (
                  <div 
                    key={node.id || index}
                    className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="text-slate-200 font-medium">Central Node {index + 1}</span>
                    </div>
                    <span className="text-[11px] font-mono text-purple-300/80 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/40">
                      Active
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">No worker nodes currently loaded into device memory.</p>
                  <button
                    type="button"
                    onClick={handleRefreshClick}
                    disabled={isRefreshingCentral}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white transition-colors cursor-pointer shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCentral ? 'animate-spin' : ''}`} />
                    {isRefreshingCentral ? 'Pulling Keys...' : 'Pull Central Keys'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-4 items-center">
              <button 
                onClick={() => setActiveTab('keys')}
                className={`text-lg font-bold transition-colors ${activeTab === 'keys' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <span className="flex items-center gap-1.5"><Key className="w-4 h-4" /> API Keys ({keys.length})</span>
              </button>
              <button 
                onClick={() => setActiveTab('health')}
                className={`text-lg font-bold transition-colors ${activeTab === 'health' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Health Status
              </button>
              <button 
                onClick={() => setActiveTab('routing')}
                className={`text-lg font-bold transition-colors ${activeTab === 'routing' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Routing
              </button>
            </div>
            {activeTab === 'keys' && (
              <div className="flex items-center gap-2">
                {onResetAll && keys.length > 0 && (
                  <button 
                    onClick={onResetAll}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 hover:border-red-500 shadow-sm cursor-pointer"
                  >
                    Reset All
                  </button>
                )}
                <button 
                  onClick={() => setShowInput(!showInput)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    showInput 
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                      : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/50'
                  }`}
                >
                  {showInput ? 'Cancel' : '+ Add Key'}
                </button>
                <button 
                  type="button"
                  onClick={handleOpenCsvPicker}
                  title="Import multiple API keys from a CSV file"
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  Import CSV
                </button>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCsvFileChange}
                  accept=".csv,text/csv"
                  className="hidden"
                />
              </div>
            )}
          </div>

      {csvErrorMsg && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{csvErrorMsg}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setCsvErrorMsg(null)}
            className="text-rose-400 hover:text-rose-200 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CSV Import Preview Modal */}
      <ImportCsvModal 
        isOpen={isCsvModalOpen}
        onClose={() => {
          setIsCsvModalOpen(false);
          setCsvParseResult(null);
          setCsvFileName('');
        }}
        parseResult={csvParseResult}
        fileName={csvFileName}
        onConfirmImport={handleConfirmCsvImport}
      />

      {activeTab === 'keys' && showInput && (
        <form onSubmit={handleSubmit} className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 pl-1">Label</label>
              <input 
                type="text" 
                placeholder="My Gemini Key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 pl-1">API Secret (Live Verified)</label>
              <input 
                type="text" 
                placeholder="AIzaSy..."
                value={keyVal}
                onChange={(e) => {
                  setKeyVal(e.target.value);
                  setValidationError(null);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
              />
            </div>
            {validationError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
          <button 
            type="submit" 
            disabled={isValidating || !keyVal.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validating Key Live with Google API...</span>
              </>
            ) : (
              'Verify & Save Key'
            )}
          </button>
        </form>
      )}

      {activeTab === 'keys' && (
      <div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
        {keys.length === 0 && !showInput && (
          <div className="text-center py-6 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
            <p className="text-sm text-slate-400">No keys configured.</p>
            <p className="text-xs text-slate-500 mt-1">Add a Gemini API key to start.</p>
          </div>
        )}
        {keys.map((k) => {
          const isCoolingDown = k.cooldownUntil && k.cooldownUntil > now;
          const remainingSecs = isCoolingDown ? Math.ceil((k.cooldownUntil! - now) / 1000) : 0;
          const isDead = k.errorCount >= 20; // Increased from 5
          const usage = {
          date: '',
          flash_3: 0,
          flash: 0,
          lite: 0,
          flash_3_1_lite: 0,
          flash_3_5: 0,
          flash_3_5_lite: 0,
          flash_3_6: 0,
          ...(k.usage ?? {})
        };

          const flashLimit = usage.flash >= 10000;
          const liteLimit = usage.lite >= 20;
          const flash_3_Limit = usage.flash_3 >= 10000;
          const flash_3_1_lite_Limit = usage.flash_3_1_lite >= 10000;
          const flash_3_5_Limit = (usage.flash_3_5 || 0) >= 10000;
          const flash_3_5_lite_Limit = (usage.flash_3_5_lite || 0) >= 10000;
          const flash_3_7_Limit = (usage.flash_3_7 || 0) >= 10000;
          const flash_3_6_Limit = (usage.flash_3_6 || 0) >= 10000;
          const health = Math.max(0, 100 - (k.errorCount * 5));

          return (
            <div key={k.id} className={`flex items-center justify-between transition-colors p-3 rounded-xl border group relative
              ${isDead ? 'bg-red-900/10 border-red-500/20' : 
                isCoolingDown ? 'bg-amber-900/10 border-amber-500/20' : 
                'bg-slate-800/40 hover:bg-slate-800/60 border-white/5'}`
            }>
              <div className="flex flex-col overflow-hidden mr-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                   <span className={`font-semibold text-sm truncate ${isDead ? 'text-red-400' : 'text-slate-200'}`} title={k.label}>{k.label}</span>
                   
                   {/* Health Badge */}
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${health > 50 ? 'bg-purple-500/10 text-purple-400' : health > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/20 text-red-400'}`} title="API Health">
                      ❤️ {health}%
                   </span>

                   {/* Usage Badges */}
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_7_Limit ? 'bg-red-500/20 text-red-400' : 'bg-pink-500/10 text-pink-400'}`} title="Gemini 3.7 Flash Usage">
                      🚀 3.7F: {usage.flash_3_7 || 0}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_6_Limit ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/10 text-indigo-400'}`} title="Gemini 3.6 Flash Usage">
                      🌟 3.6F: {usage.flash_3_6 || 0}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_5_Limit ? 'bg-red-500/20 text-red-400' : 'bg-fuchsia-500/10 text-fuchsia-400'}`} title="Gemini 3.5 Flash Usage">
                      ⭐ 3.5F: {usage.flash_3_5 || 0}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_5_lite_Limit ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`} title="Gemini 3.5 Flash Lite Usage">
                      💫 3.5L: {usage.flash_3_5_lite || 0}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_Limit ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`} title="Gemini 3 Flash Usage">
                      🔥 3F: {usage.flash_3}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flashLimit ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`} title="Gemini 2.5 Flash Usage">
                      ⚡ 2.5F: {usage.flash}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_1_lite_Limit ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`} title="Gemini 3.1 Flash Lite Usage">
                      🚀 3.1L: {usage.flash_3_1_lite}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${liteLimit ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/10 text-amber-400'}`} title="Gemini 2.5 Flash Lite Usage">
                      💡 2.5L: {usage.lite}
                   </span>

                   {isCoolingDown && (
                     <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                       {remainingSecs}s
                     </span>
                   )}
                   {isDead && (
                     <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono font-bold">
                       FAILED
                     </span>
                   )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono truncate block">
                  {visibleKeys.has(k.id) ? k.key : `${k.key.substring(0, 6)}••••••••${k.key.substring(k.key.length - 4)}`}
                </span>
                

              </div>
              <div className="flex items-center gap-2">
                <button
                    onClick={() => onResetUsage(k.id)}
                    className="text-slate-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                    title="Reset Usage"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button 
                  onClick={() => toggleVisibility(k.id)}
                  className="text-slate-500 hover:text-purple-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                  title={visibleKeys.has(k.id) ? "Hide Key" : "Show Key"}
                >
                  {visibleKeys.has(k.id) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
                <button 
                  onClick={() => onRemove(k.id)}
                  className="text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          );
        })}
            </div>
      )}

      {/* API Key Routing Status */}
      {activeTab === 'routing' && (
          <div className="mt-4 pt-2">
              <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h4 className="font-bold text-sm text-slate-300 mb-2">TITLE / KEYWORD PREFERRED POOL ({Math.ceil(keys.length / 2)} keys)</h4>
                      <ul className="text-xs space-y-1">
                          {keys.slice(0, Math.ceil(keys.length / 2)).map(k => (
                              <li key={k.id} className="flex justify-between">
                                  <span className="text-slate-400">{k.label}</span>
                                  <span className={k.errorCount >= 20 ? 'text-red-400' : (k.cooldownUntil && k.cooldownUntil > now) ? 'text-amber-400' : 'text-emerald-400'}>
                                      {k.errorCount >= 20 ? 'Failed' : (k.cooldownUntil && k.cooldownUntil > now) ? 'Cooldown' : 'Healthy'}
                                  </span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h4 className="font-bold text-sm text-slate-300 mb-2">CATEGORY PREFERRED POOL ({Math.floor(keys.length / 2)} keys)</h4>
                      <ul className="text-xs space-y-1">
                          {keys.slice(Math.ceil(keys.length / 2)).map(k => (
                              <li key={k.id} className="flex justify-between">
                                  <span className="text-slate-400">{k.label}</span>
                                  <span className={k.errorCount >= 20 ? 'text-red-400' : (k.cooldownUntil && k.cooldownUntil > now) ? 'text-amber-400' : 'text-emerald-400'}>
                                      {k.errorCount >= 20 ? 'Failed' : (k.cooldownUntil && k.cooldownUntil > now) ? 'Cooldown' : 'Healthy'}
                                  </span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mt-4 space-y-2">
                    <h4 className="font-bold text-sm text-slate-300">Global Fallback Status</h4>
                    <p className="text-xs text-slate-400">
                      Fallback activates ONLY when an entire dedicated pool has zero usable keys.
                    </p>
                    <div className="space-y-1">
                      {(() => {
                        const titlePool = keys.slice(0, Math.ceil(keys.length / 2));
                        const categoryPool = keys.slice(Math.ceil(keys.length / 2));
                        
                        // "Usable" means not permanently failed. Safety limit is harder to check here, but errorCount < 20 is the main one.
                        const titleUsable = titlePool.filter(k => k.errorCount < 20).length;
                        const categoryUsable = categoryPool.filter(k => k.errorCount < 20).length;

                        return (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500">Title Tasks:</span>
                              <span className={titleUsable === 0 ? "text-amber-400 font-medium" : "text-slate-500"}>
                                {titleUsable > 0 ? "STANDBY (Dedicated Keys Available)" : "ACTIVE (0 usable dedicated keys, using Category pool)"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500">Category Tasks:</span>
                              <span className={categoryUsable === 0 ? "text-amber-400 font-medium" : "text-slate-500"}>
                                {categoryUsable > 0 ? "STANDBY (Dedicated Keys Available)" : "ACTIVE (0 usable dedicated keys, using Title pool)"}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

              </div>
          </div>
      )}

      {/* API Key Health Status */}
      {activeTab === 'health' && keys.length > 0 && (
          <div className="mt-4 pt-2">
              <div className="space-y-3">
                  {keys.map(k => {
                      const totalSuccess = Object.keys(k.usage).reduce((acc, key) => {
                          if (key !== 'date' && typeof (k.usage)[key] === 'number') {
                              return acc + (k.usage)[key];
                          }
                          return acc;
                      }, 0);
                      const totalAttempts = totalSuccess + k.errorCount;
                      const successRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 100;
                      const health = Math.max(0, Math.min(100, successRate - (k.errorCount > 0 ? (k.errorCount / 20) * 100 : 0))); // penalize heavily for raw error count
                      
                      const isDead = k.errorCount >= 20;
                      let colorClass = "bg-emerald-500";
                      if (isDead) colorClass = "bg-red-600";
                      else if (health < 50) colorClass = "bg-red-500";
                      else if (health < 80) colorClass = "bg-amber-500";

                      return (
                          <div key={k.id} className="text-sm">
                              <div className="flex justify-between items-center mb-1 px-1 text-xs">
                                  <div className="flex flex-col">
                                    <span className={`font-medium truncate max-w-[120px] ${isDead ? 'text-red-400' : 'text-slate-300'}`} title={k.label}>{k.label}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">Lifetime: {totalSuccess}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-500 font-mono" title="Errors">
                                          {k.errorCount} err
                                      </span>
                                      <span className={`font-mono ${health >= 80 ? 'text-emerald-400' : health >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                          {isDead ? 'DEAD' : `${health.toFixed(0)}%`}
                                      </span>
                                  </div>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                      className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                                      style={{ width: `${isDead ? 100 : health}%` }}
                                  />
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
      </>
      )}

    </div>
  );
};
