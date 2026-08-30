import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Key, 
  Upload, 
  AlertCircle, 
  X, 
  Zap, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  RefreshCw, 
  LogIn, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  HelpCircle, 
  Info, 
  ChevronRight, 
  ShieldAlert,
  RotateCcw,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Check,
  Activity,
  Network
} from 'lucide-react';
import { ApiKey } from '../types';
import { parseApiKeysCsv, CsvParseResult } from '../utils/csvKeyParser';
import { ImportCsvModal } from './ImportCsvModal';
import { LocalDeadApiModal } from './LocalDeadApiModal';
import { syncLocalKeysToServer } from '../utils/keySync';
import { useAuth } from '../contexts/AuthContext';
import { validateGeminiApiKey } from '../services/geminiService';
import { fetchServerCentralUsage, formatTimeUntilReset, CentralUsageStats, calculateLocalCentralLimit } from '../services/centralUsageService';

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
  const { userData, user, setIsAuthModalOpen, centralModeEnabled } = useAuth();
  const [label, setLabel] = useState('');
  const [keyVal, setKeyVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'keys' | 'health' | 'routing'>('keys');

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isLocalDeadApiModalOpen, setIsLocalDeadApiModalOpen] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  // Derive unique local API keys via fingerprint / unique key set (0 Firestore reads/writes)
  const sourceLocalKeys = useMemo(() => {
    return localKeys && localKeys.length > 0 ? localKeys : keys;
  }, [localKeys, keys]);

  const uniqueLocalKeySet = useMemo(() => {
    return new Set(
      sourceLocalKeys
        .filter(k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 10)
        .map(k => k.key.trim())
    );
  }, [sourceLocalKeys]);

  const uniqueLocalKeysCount = uniqueLocalKeySet.size;
  const localKeysCount = useMemo(() => {
    return sourceLocalKeys.filter(k => !k.key.startsWith('central-')).length;
  }, [sourceLocalKeys]);

  // Central API eligibility rules
  const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin' || user?.email === 'reactoremon2022@gmail.com' || user?.email === 'titaniumfact97@gmail.com';
  const isCentralDisabledForUser = centralModeEnabled === false && !isAdmin;
  const hasExplicitAdminGrant = userData?.centralApiAccess === true;
  const hasEightKeysUnlocked = Boolean((user || userData) && uniqueLocalKeysCount >= 4);
  const isEligibleForCentral = isAdmin || (!isCentralDisabledForUser && Boolean(hasExplicitAdminGrant || hasEightKeysUnlocked));

  // Auto-revert normal users to Local API mode if admin turns off Central Mode while Central mode is active
  useEffect(() => {
    if (centralModeEnabled === false && apiMode === 'central' && !isAdmin) {
      onChangeApiMode('local');
      if (onShowToast) {
        onShowToast('Central API Locked', 'Central API mode has been disabled by the administrator. Switched to Local API mode.');
      }
    }
  }, [centralModeEnabled, apiMode, onChangeApiMode, onShowToast, isAdmin]);

  // Central API Usage State
  const [usageStats, setUsageStats] = useState<CentralUsageStats | null>(() => {
    try {
      const saved = localStorage.getItem('centralUsageStats');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Derive estimated fallback if server stats are loading
  const localEstimatedLimits = calculateLocalCentralLimit(uniqueLocalKeysCount, isAdmin);

  const loadUsageStats = async () => {
    try {
      setIsLoadingUsage(true);
      const token = user ? await (user as any).getIdToken?.() : undefined;
      const rawLocalKeyStrings = sourceLocalKeys.map(k => k.key).filter(Boolean);
      const stats = await fetchServerCentralUsage(rawLocalKeyStrings, token, {
        email: user?.email || userData?.email,
        uid: (user as any)?.uid || userData?.uid,
        role: userData?.role,
        isAdmin
      });
      if (stats) {
        try {
            const saved = localStorage.getItem('centralUsageStats');
            if (saved) {
                const parsedSaved = JSON.parse(saved);
                // Prevent server memory reset from wiping out client usage
                if (parsedSaved && parsedSaved.cycleId === stats.cycleId && stats.usedRequests < parsedSaved.usedRequests) {
                    stats.usedRequests = parsedSaved.usedRequests;
                    stats.remainingRequests = Math.max(0, stats.totalRequests - stats.usedRequests);
                    stats.remainingImages = Math.floor(stats.remainingRequests / 2);
                    stats.isLimitReached = stats.usedRequests >= stats.totalRequests;
                }
            }
        } catch (err) {}
        setUsageStats(stats);
        localStorage.setItem('centralUsageStats', JSON.stringify(stats));
      }
    } catch (e) {
      console.warn('Could not fetch usage stats:', e);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  useEffect(() => {
    loadUsageStats();
    const interval = setInterval(loadUsageStats, 20000);
    const handleForceUpdate = () => loadUsageStats();
    const handleLocalUpdate = () => {
        try {
            const saved = localStorage.getItem('centralUsageStats');
            if (saved) setUsageStats(JSON.parse(saved));
        } catch (e) {}
    };
    window.addEventListener('central-usage-update', handleForceUpdate);
    window.addEventListener('central-usage-update-local', handleLocalUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('central-usage-update', handleForceUpdate);
      window.removeEventListener('central-usage-update-local', handleLocalUpdate);
    };
  }, [uniqueLocalKeysCount, apiMode, user, userData, isAdmin]);

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
      if (centralModeEnabled === false && !isAdmin) {
        if (onShowToast) onShowToast('Central API Locked', 'Central API mode has been disabled by the administrator.');
        return;
      }
      if (!user && !userData) {
        if (onShowToast) onShowToast('Login Required', 'You must log in to access the Central API pool.');
        setIsAuthModalOpen(true);
        return;
      }
      if (!isEligibleForCentral) {
        if (onShowToast) {
          onShowToast(
            'Central API Locked', 
            `You must have at least 4 unique API keys added locally to unlock Central API mode. (Currently: ${uniqueLocalKeysCount}/4 unique keys)`
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

  const copyKeyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 1500);
  };

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/5 shadow-xl w-full max-w-full overflow-hidden">
      {/* Top Mode Selector Tabs */}
      <div className="flex bg-slate-950/80 rounded-xl p-1 mb-5 border border-slate-800/90 shadow-inner">
        <button
          type="button"
          onClick={() => handleModeChange('local')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
            apiMode === 'local' 
              ? 'bg-slate-800 text-white shadow-md border border-slate-700/60' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Local API ({localKeysCount})
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('central')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            apiMode === 'central' 
              ? 'bg-purple-600/20 text-purple-300 shadow-md border border-purple-500/40' 
              : isCentralDisabledForUser
                ? 'text-slate-500 opacity-60 hover:text-slate-400 cursor-not-allowed bg-slate-900/40'
                : isEligibleForCentral 
                  ? 'text-slate-400 hover:text-purple-300' 
                  : 'text-slate-500 opacity-80 hover:text-slate-400'
          }`}
        >
          {isCentralDisabledForUser ? (
            <>
              <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-rose-300/90 truncate">Central Locked</span>
            </>
          ) : isEligibleForCentral ? (
            <>
              <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">Central API Pool</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Unlock ({uniqueLocalKeysCount}/4)</span>
            </>
          )}
        </button>
      </div>

      {/* Central Mode Disabled by Admin Banner */}
      {isCentralDisabledForUser && (
        <div className="mb-5 p-4 bg-gradient-to-r from-rose-950/30 via-slate-900 to-slate-900 border border-rose-500/30 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              Central API Mode Locked
            </div>
            <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
              Disabled by Admin
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Central API mode is currently turned off by the system administrator. All operations will process using your configured <strong>Local API keys</strong>.
          </p>
        </div>
      )}

      {/* Central Unlock Progress / Notice */}
      {!isCentralDisabledForUser && !isEligibleForCentral && apiMode !== 'central' && (
        <div className="mb-5 p-4 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/30 rounded-xl text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              Central API Auto-Unlock
            </div>
            <span className="text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
              {uniqueLocalKeysCount} / 4 Unique Keys
            </span>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Add at least <strong>4 unique, valid Gemini API keys</strong> to your local pool to automatically unlock the shared, high-speed Central API pool. No admin approval required.
          </p>

          <div className="p-2.5 bg-slate-950/70 rounded-lg border border-purple-500/20 flex items-center justify-between text-[11px]">
            <span className="text-purple-300 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Unlock Reward:
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              4 Keys = 200 Images/day (400 requests)
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, (uniqueLocalKeysCount / 4) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>
                {uniqueLocalKeysCount >= 4 
                  ? 'Goal reached! Central API unlocked.' 
                  : `${4 - uniqueLocalKeysCount} more unique key${4 - uniqueLocalKeysCount === 1 ? '' : 's'} needed`}
              </span>
              <span>Goal: 4 Keys</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              Account Status: {!user && !userData ? (
                <strong className="text-slate-500">Not Logged In</strong>
              ) : (
                <strong className="text-purple-300 truncate max-w-[140px]">
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
                <Lock className="w-3 h-3" /> Unlocks at 4 keys
              </span>
            )}
          </div>
        </div>
      )}

      {apiMode === 'central' ? (
        <div className="space-y-4">
          {/* Main Central Pool Status Card */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-900/90 rounded-xl border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-500/30 text-purple-400 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                    <span>Central API Pool Active</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shrink-0">
                      Live Connected
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    High-speed distributed parallel processing nodes
                  </p>
                </div>
              </div>
              {onRefreshCentralKeys && (
                <button
                  type="button"
                  onClick={() => {
                    if (onRefreshCentralKeys) onRefreshCentralKeys();
                    loadUsageStats();
                  }}
                  className="p-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-purple-300 transition-colors shrink-0 cursor-pointer"
                  title="Refresh Central Pool & Usage"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsage ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Authoritative Daily Usage & Quota Box */}
            {(() => {
              const totalReqs = usageStats ? usageStats.totalRequests : localEstimatedLimits.totalRequests;
              const usedReqs = usageStats ? usageStats.usedRequests : 0;
              const remainingReqs = usageStats ? usageStats.remainingRequests : totalReqs;
              const totalImgs = usageStats ? usageStats.totalImages : localEstimatedLimits.totalImages;
              const remainingImgs = usageStats ? usageStats.remainingImages : totalImgs;
              const isExhausted = usageStats?.isLimitReached || (totalReqs > 0 && remainingReqs <= 0);
              const nextReset = usageStats?.nextResetMs || (Date.now() + 1000 * 60 * 60 * 8);
              const timeUntilResetStr = formatTimeUntilReset(nextReset);
              const percentageUsed = totalReqs > 0 ? Math.min(100, Math.round((usedReqs / totalReqs) * 100)) : 0;

              return (
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[11px] font-bold text-white tracking-wide uppercase">
                        Central Daily Allocation
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isExhausted 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {isExhausted ? 'Quota Exhausted' : 'Allocation Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Images Remaining</span>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-lg font-bold font-mono ${isExhausted ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {remainingImgs}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">/ {totalImgs}</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Requests Avail</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold font-mono text-purple-300">
                          {remainingReqs}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">/ {totalReqs}</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Local Key Factor</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold font-mono text-amber-400">
                          {isAdmin ? 'Admin Unlimited' : `${uniqueLocalKeysCount} Keys`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Used: <strong className="text-slate-200 font-mono">{usedReqs}</strong> requests ({percentageUsed}%)</span>
                      <span>Capacity: <strong className="text-slate-200 font-mono">{totalReqs}</strong> / day</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full transition-all duration-500 ease-out ${
                          isExhausted
                            ? 'bg-rose-500'
                            : percentageUsed > 80
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-purple-500 to-emerald-400'
                        }`}
                        style={{ width: `${percentageUsed}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2 bg-purple-950/30 rounded-lg border border-purple-900/30 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Clock className="w-3 h-3 text-purple-400 shrink-0" />
                      <span>Resets daily at <strong>2:00 PM BST (GMT+6)</strong></span>
                    </div>
                    <span className="font-mono text-purple-300 font-bold bg-purple-900/40 px-2 py-0.5 rounded border border-purple-700/40 text-[10px]">
                      {timeUntilResetStr}
                    </span>
                  </div>
                </div>
              );
            })()}

            {!isAdmin && (
              <div className="p-3 bg-gradient-to-r from-purple-900/30 via-indigo-950/40 to-slate-900/90 rounded-xl border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Want more Central API daily quota?
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Add <strong>2 more local keys</strong> for <strong className="text-emerald-400">+100 images/day</strong>!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChangeApiMode('local');
                    setShowInput(true);
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg border border-purple-400/30 shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
                >
                  <Key className="w-3 h-3" /> + Add Local Keys
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block mb-0.5">Active Central Nodes</span>
                <span className="text-base font-bold text-white font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                  {keys.length > 0 ? keys.length : '16'} Nodes
                </span>
              </div>
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block mb-0.5">Storage Mode</span>
                <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  In-Memory RAM
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LOCAL API INTERFACE */
        <div className="space-y-4">
          {/* Sub-Header: Segmented Tab Bar */}
          <div className="flex items-center justify-between gap-2 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button 
                type="button"
                onClick={() => setActiveTab('keys')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'keys' 
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Keys ({keys.length})</span>
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('health')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'health' 
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Health</span>
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('routing')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'routing' 
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Routing</span>
              </button>
            </div>
          </div>

          {/* Action Toolbar for Keys Tab */}
          {activeTab === 'keys' && (
            <div className="flex flex-wrap items-center gap-2 justify-between pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setShowInput(!showInput)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm ${
                    showInput 
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' 
                      : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/40 border border-purple-400/30'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{showInput ? 'Cancel' : '+ Add Key'}</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setIsLocalDeadApiModalOpen(true)}
                  title="Scan for dead or rate-limited API keys"
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 hover:text-white border border-rose-800/40 hover:border-rose-600 shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Scan Local Keys</span>
                </button>

                <button 
                  type="button"
                  onClick={handleOpenCsvPicker}
                  title="Import multiple API keys from a CSV file"
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Import CSV</span>
                </button>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCsvFileChange}
                  accept=".csv,text/csv"
                  className="hidden"
                />
              </div>

              {onResetAll && keys.length > 0 && (
                <button 
                  type="button"
                  onClick={onResetAll}
                  title="Reset error counts and usage counters for all local keys"
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all bg-red-950/30 text-red-300 hover:bg-red-900/60 hover:text-white border border-red-900/40 hover:border-red-700 shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3 text-red-400" />
                  <span>Reset All</span>
                </button>
              )}
            </div>
          )}

          {/* CSV Parsing Error Banner */}
          {csvErrorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between animate-in fade-in">
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

          {/* Local Dead API Scanner Modal */}
          <LocalDeadApiModal
            isOpen={isLocalDeadApiModalOpen}
            onClose={() => setIsLocalDeadApiModalOpen(false)}
            localKeys={sourceLocalKeys}
            onRemove={onRemove}
            onRemoveMultiple={(ids) => {
              ids.forEach(id => onRemove(id));
            }}
            onScanComplete={() => {}}
          />

          {/* Add Key Inline Form */}
          {activeTab === 'keys' && showInput && (
            <form onSubmit={handleSubmit} className="bg-slate-900/90 p-4 rounded-xl border border-purple-500/30 space-y-3 animate-in fade-in">
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-0.5">Label (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Primary Gemini Key"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-0.5">API Secret (Live Verified)</label>
                  <input 
                    type="password" 
                    placeholder="AIzaSy..."
                    value={keyVal}
                    onChange={(e) => {
                      setKeyVal(e.target.value);
                      setValidationError(null);
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none font-mono"
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
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating Key Live with Google API...</span>
                  </>
                ) : (
                  <span>Verify & Save Key</span>
                )}
              </button>
            </form>
          )}

          {/* Keys Tab: Key Cards List */}
          {activeTab === 'keys' && (
            <div className="space-y-2 max-h-80 sm:max-h-96 min-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
              {keys.length === 0 && !showInput ? (
                <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 space-y-2 p-4">
                  <Key className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">No Local API Keys Configured</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Add a Gemini API key or import a CSV to start generating captions and processing images.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInput(true)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      + Add Key
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCsvPicker}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-all"
                    >
                      Import CSV
                    </button>
                  </div>
                </div>
              ) : (
                keys.map((k) => {
                  const isCoolingDown = k.cooldownUntil && k.cooldownUntil > now;
                  const remainingSecs = isCoolingDown ? Math.ceil((k.cooldownUntil! - now) / 1000) : 0;
                  const isDead = k.errorCount >= 20;
                  const usage = k.usage || {};
                  const totalUsed = Object.entries(usage).reduce((sum, [key, val]) => {
                    return key !== 'date' && typeof val === 'number' ? sum + val : sum;
                  }, 0);

                  const health = Math.max(0, 100 - (k.errorCount * 5));

                  return (
                    <div 
                      key={k.id} 
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isDead 
                          ? 'bg-rose-950/20 border-rose-500/30' 
                          : isCoolingDown 
                          ? 'bg-amber-950/20 border-amber-500/30' 
                          : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/80'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 flex-1 gap-1">
                        {/* Header & Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span 
                            className={`font-bold text-xs truncate max-w-[140px] sm:max-w-[180px] ${
                              isDead ? 'text-rose-400' : 'text-slate-200'
                            }`} 
                            title={k.label}
                          >
                            {k.label}
                          </span>

                          <span 
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                              health > 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                              health > 30 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                              'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`} 
                            title="Health Score"
                          >
                            {health}%
                          </span>

                          {totalUsed > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {totalUsed} reqs
                            </span>
                          )}

                          {isCoolingDown && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                              Cooldown {remainingSecs}s
                            </span>
                          )}

                          {isDead && (
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                              FAILED
                            </span>
                          )}
                        </div>

                        {/* Masked Key Identifier */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                            {visibleKeys.has(k.id) 
                              ? k.key 
                              : `${k.key.substring(0, 6)}••••••••${k.key.substring(k.key.length - 4)}`}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyKeyText(k.id, k.key)}
                          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Copy Key"
                        >
                          {copiedKeyId === k.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button 
                          type="button"
                          onClick={() => toggleVisibility(k.id)}
                          className="text-slate-400 hover:text-purple-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          title={visibleKeys.has(k.id) ? "Hide Key" : "Show Key"}
                        >
                          {visibleKeys.has(k.id) ? (
                            <EyeOff className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onResetUsage(k.id)}
                          className="text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Reset Usage"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        <button 
                          type="button"
                          onClick={() => onRemove(k.id)}
                          className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Health Status Tab */}
          {activeTab === 'health' && (
            <div className="space-y-3 max-h-80 sm:max-h-96 min-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
              {keys.length === 0 ? (
                <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 space-y-1">
                  <p className="text-xs font-semibold text-slate-300">No Keys Available</p>
                  <p className="text-[11px] text-slate-500">Add local keys to monitor live health & error rates.</p>
                </div>
              ) : (
                keys.map(k => {
                  const totalSuccess = Object.keys(k.usage || {}).reduce((acc, key) => {
                    if (key !== 'date' && typeof (k.usage as any)[key] === 'number') {
                      return acc + (k.usage as any)[key];
                    }
                    return acc;
                  }, 0);
                  const totalAttempts = totalSuccess + k.errorCount;
                  const successRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 100;
                  const health = Math.max(0, Math.min(100, successRate - (k.errorCount > 0 ? (k.errorCount / 20) * 100 : 0)));
                  
                  const isDead = k.errorCount >= 20;
                  let colorClass = "bg-emerald-500";
                  if (isDead) colorClass = "bg-rose-600";
                  else if (health < 50) colorClass = "bg-rose-500";
                  else if (health < 80) colorClass = "bg-amber-500";

                  return (
                    <div key={k.id} className="p-3 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex flex-col min-w-0">
                          <span className={`font-semibold truncate max-w-[140px] ${isDead ? 'text-rose-400' : 'text-slate-200'}`} title={k.label}>
                            {k.label}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Lifetime Requests: {totalSuccess}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {k.errorCount} err
                          </span>
                          <span className={`font-mono font-bold text-xs ${health >= 80 ? 'text-emerald-400' : health >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {isDead ? 'DEAD' : `${health.toFixed(0)}%`}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                          style={{ width: `${isDead ? 100 : health}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Routing Status Tab */}
          {activeTab === 'routing' && (
            <div className="space-y-3 max-h-80 sm:max-h-96 min-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
              {keys.length === 0 ? (
                <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 space-y-1">
                  <p className="text-xs font-semibold text-slate-300">No Keys Available for Routing</p>
                  <p className="text-[11px] text-slate-500">Add local keys to enable automated dual-pool load balancing.</p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                    <h4 className="font-bold text-xs text-purple-300 uppercase tracking-wide">
                      Title & Keyword Pool ({Math.ceil(keys.length / 2)} keys)
                    </h4>
                    <ul className="space-y-1.5">
                      {keys.slice(0, Math.ceil(keys.length / 2)).map(k => (
                        <li key={k.id} className="flex justify-between items-center p-1.5 bg-slate-950/60 rounded-lg border border-slate-850">
                          <span className="text-slate-300 font-medium truncate max-w-[140px]">{k.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            k.errorCount >= 20 ? 'bg-rose-500/20 text-rose-300' : 
                            (k.cooldownUntil && k.cooldownUntil > now) ? 'bg-amber-500/20 text-amber-300' : 
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {k.errorCount >= 20 ? 'Failed' : (k.cooldownUntil && k.cooldownUntil > now) ? 'Cooldown' : 'Healthy'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                    <h4 className="font-bold text-xs text-blue-300 uppercase tracking-wide">
                      Category & Description Pool ({Math.floor(keys.length / 2)} keys)
                    </h4>
                    <ul className="space-y-1.5">
                      {keys.slice(Math.ceil(keys.length / 2)).map(k => (
                        <li key={k.id} className="flex justify-between items-center p-1.5 bg-slate-950/60 rounded-lg border border-slate-850">
                          <span className="text-slate-300 font-medium truncate max-w-[140px]">{k.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            k.errorCount >= 20 ? 'bg-rose-500/20 text-rose-300' : 
                            (k.cooldownUntil && k.cooldownUntil > now) ? 'bg-amber-500/20 text-amber-300' : 
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {k.errorCount >= 20 ? 'Failed' : (k.cooldownUntil && k.cooldownUntil > now) ? 'Cooldown' : 'Healthy'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                    <h4 className="font-bold text-xs text-slate-300">Failover & Fallback Protocol</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      If one pool exhausts all healthy keys, requests automatically route to the counterpart pool with zero dropped jobs.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
