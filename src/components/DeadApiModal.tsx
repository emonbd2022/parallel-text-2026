import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  Trash2, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ShieldAlert, 
  Image as ImageIcon, 
  RefreshCw, 
  Flame, 
  Sparkles,
  StopCircle,
  CheckCircle,
  Eye,
  Info,
  Clock,
  Layers
} from 'lucide-react';
import { CentralKeyRecord, testSingleCentralKey, markSingleCentralKeyDead } from '../services/centralKeyService';
import { getAttemptModel, getModelDisplayName, formatScanErrorMessage, SCAN_FALLBACK_MODELS } from '../utils/scanModelWaterfall';

// Default lightweight sample image (1x1 transparent PNG)
const DEFAULT_DEMO_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface DeadApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  centralKeys: CentralKeyRecord[];
  onScanComplete: () => void;
}

export interface KeyTestResult {
  keyId: string;
  label: string;
  maskedKey: string;
  contributorName?: string;
  status: 'pending' | 'testing' | 'healthy' | 'dead';
  attempt: number;
  maxAttempts: number;
  title?: string;
  error?: string;
  markedDead?: boolean;
}

export const DeadApiModal: React.FC<DeadApiModalProps> = ({
  isOpen,
  onClose,
  centralKeys,
  onScanComplete
}) => {
  const [demoImage, setDemoImage] = useState<string | null>(DEFAULT_DEMO_IMAGE);
  const [demoImageName, setDemoImageName] = useState<string>('Stock Camera Sample (Preset)');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite-preview');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scanFinished, setScanFinished] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [currentAttempt, setCurrentAttempt] = useState<number>(0);
  const [activeAttemptModel, setActiveAttemptModel] = useState<string>('gemini-3.1-flash-lite-preview');
  const [cooldownCountdown, setCooldownCountdown] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<KeyTestResult[]>([]);
  const [logMessages, setLogMessages] = useState<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

  const stopRequestedRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scanStartedRef = useRef<boolean>(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Scroll logs to bottom on new log
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logMessages]);

  // Auto-start scan from 1st key to last key immediately every time modal opens
  useEffect(() => {
    if (isOpen && centralKeys.length > 0 && !isScanning && !scanStartedRef.current) {
      scanStartedRef.current = true;
      startScan();
    }
    if (!isOpen) {
      scanStartedRef.current = false;
    }
  }, [isOpen, centralKeys]);

  if (!isOpen) return null;

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogMessages(prev => [...prev.slice(-100), { id: Math.random().toString(36), time, text, type }]);
  };

  const compressImage = (dataUrl: string, callback: (compressed: string) => void) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 800;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        callback(dataUrl);
      }
    };
    img.src = dataUrl;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        compressImage(event.target.result as string, (compressed) => {
          setDemoImage(compressed);
          setDemoImageName(file.name);
          addLog(`Demo image loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB) -> compressed`, 'info');
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          compressImage(event.target.result as string, (compressed) => {
            setDemoImage(compressed);
            setDemoImageName(file.name);
            addLog(`Demo image dropped: ${file.name} -> compressed`, 'info');
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startScan = async () => {
    if (!demoImage) {
      alert("Please upload or select a demo image to test API keys against.");
      return;
    }
    if (centralKeys.length === 0) {
      alert("No Central API keys found to test.");
      return;
    }

    stopRequestedRef.current = false;
    setIsScanning(true);
    setIsPaused(false);
    setScanFinished(false);
    setLogMessages([]);

    const initialResults: KeyTestResult[] = centralKeys.map(k => ({
      keyId: k.id,
      label: k.label || 'Central Key',
      maskedKey: k.maskedKey,
      contributorName: k.contributorName || k.contributedBy,
      status: 'pending',
      attempt: 0,
      maxAttempts: 3
    }));

    setTestResults(initialResults);
    addLog(`Starting Dead API Scan across ${centralKeys.length} Central API keys.`, 'info');
    addLog(`Multi-Model Waterfall: Try 1 (${getModelDisplayName(getAttemptModel(selectedModel, 1))}) -> Try 2 (${getModelDisplayName(getAttemptModel(selectedModel, 2))}) -> Try 3 (${getModelDisplayName(getAttemptModel(selectedModel, 3))}).`, 'info');

    let healthyCount = 0;
    let deadCount = 0;

    for (let i = 0; i < centralKeys.length; i++) {
      if (stopRequestedRef.current) {
        addLog(`Scan stopped by administrator.`, 'warn');
        break;
      }

      // Handle pause loop
      while (isPausedRef.current && !stopRequestedRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }
      if (stopRequestedRef.current) break;

      const currentKey = centralKeys[i];
      setCurrentIndex(i);
      setCooldownCountdown(null);

      setTestResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'testing', attempt: 1 } : r));
      addLog(`[${i + 1}/${centralKeys.length}] Testing key "${currentKey.label}" (${currentKey.maskedKey})...`, 'info');

      let passed = false;
      let generatedTitle = '';
      let lastErrorMessage = '';
      let attemptNumber = 0;
      let hadRateLimit = false;

      // Up to 3 attempts with distinct models and 5s delays
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (stopRequestedRef.current) break;
        attemptNumber = attempt;
        setCurrentAttempt(attempt);

        const currentModelForAttempt = getAttemptModel(selectedModel, attempt);
        setActiveAttemptModel(currentModelForAttempt);

        setTestResults(prev => prev.map((r, idx) => idx === i ? { ...r, attempt } : r));
        addLog(`  -> Attempt ${attempt}/3: Calling Gemini API (${getModelDisplayName(currentModelForAttempt)}) with demo image...`, 'info');

        try {
          const testRes = await testSingleCentralKey(currentKey.id, demoImage, currentModelForAttempt);
          if (testRes.success && testRes.title) {
            passed = true;
            generatedTitle = testRes.title;
            addLog(`  ✓ Attempt ${attempt}/3 PASSED with ${getModelDisplayName(currentModelForAttempt)}: "${generatedTitle.substring(0, 55)}..."`, 'success');
            break;
          } else {
            lastErrorMessage = testRes.error || 'Failed to generate title';
            const cleanErr = formatScanErrorMessage(lastErrorMessage);
            if (lastErrorMessage.includes('429') || lastErrorMessage.includes('RESOURCE_EXHAUSTED')) {
              hadRateLimit = true;
            }
            addLog(`  ✗ Attempt ${attempt}/3 FAILED [${getModelDisplayName(currentModelForAttempt)}]: ${cleanErr}`, 'warn');

            if (attempt < 3 && !stopRequestedRef.current) {
              const nextAttemptModel = getAttemptModel(selectedModel, attempt + 1);
              addLog(`  ⏳ Waiting 5s cooldown before starting Attempt ${attempt + 1}/3 with alternate model (${getModelDisplayName(nextAttemptModel)})...`, 'warn');
              
              // 5 second cooldown countdown
              for (let s = 5; s >= 1; s--) {
                if (stopRequestedRef.current) break;
                while (isPausedRef.current && !stopRequestedRef.current) {
                  await new Promise(r => setTimeout(r, 400));
                }
                setCooldownCountdown(s);
                await new Promise(r => setTimeout(r, 1000));
              }
              setCooldownCountdown(null);
            }
          }
        } catch (err: any) {
          lastErrorMessage = err?.message || 'Network exception';
          const cleanErr = formatScanErrorMessage(lastErrorMessage);
          if (lastErrorMessage.includes('429') || lastErrorMessage.includes('RESOURCE_EXHAUSTED')) {
            hadRateLimit = true;
          }
          addLog(`  ✗ Attempt ${attempt}/3 EXCEPTION [${getModelDisplayName(currentModelForAttempt)}]: ${cleanErr}`, 'warn');

          if (attempt < 3 && !stopRequestedRef.current) {
            const nextAttemptModel = getAttemptModel(selectedModel, attempt + 1);
            addLog(`  ⏳ Waiting 5s cooldown before starting Attempt ${attempt + 1}/3 with alternate model (${getModelDisplayName(nextAttemptModel)})...`, 'warn');
            
            for (let s = 5; s >= 1; s--) {
              if (stopRequestedRef.current) break;
              while (isPausedRef.current && !stopRequestedRef.current) {
                await new Promise(r => setTimeout(r, 400));
              }
              setCooldownCountdown(s);
              await new Promise(r => setTimeout(r, 1000));
            }
            setCooldownCountdown(null);
          }
        }
      }

      if (passed) {
        healthyCount++;
        setTestResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: 'healthy',
          title: generatedTitle,
          attempt: attemptNumber
        } : r));
      } else {
        deadCount++;
        const finalCleanErr = formatScanErrorMessage(lastErrorMessage);
        addLog(`  🚨 KEY MARKED DEAD (Failed all 3 model tiers). Deactivating "${currentKey.label}" and storing in database...`, 'error');
        
        // Mark dead key as DEAD (deactivated and stored, not deleted)
        try {
          await markSingleCentralKeyDead(currentKey.id, finalCleanErr || 'Failed 3/3 Gemini API multi-model verification attempts');
          addLog(`  🏷️ Key "${currentKey.label}" labeled as DEAD & disabled (kept in database to prevent login re-add).`, 'error');
        } catch (delErr: any) {
          addLog(`  ⚠️ Failed to mark key as dead: ${delErr?.message}`, 'error');
        }

        setTestResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: 'dead',
          error: finalCleanErr || 'Failed 3/3 model attempts',
          attempt: attemptNumber,
          markedDead: true
        } : r));
      }

      // Safe pacing between separate keys to prevent rate limit cascade
      const keyCooldown = hadRateLimit ? 3500 : 1500;
      await new Promise(r => setTimeout(r, keyCooldown));
    }

    setIsScanning(false);
    setScanFinished(true);
    setCurrentIndex(-1);
    setCurrentAttempt(0);
    addLog(`🏁 Scan cycle finished. Verified all ${centralKeys.length} keys (Active: ${healthyCount}, Dead Deactivated: ${deadCount}).`, 'success');
    onScanComplete();
  };

  const handleStopScan = () => {
    stopRequestedRef.current = true;
    setIsScanning(false);
    setIsPaused(false);
    addLog("Scan stopped by user.", "warn");
  };

  const healthyCount = testResults.filter(r => r.status === 'healthy').length;
  const deadCount = testResults.filter(r => r.status === 'dead').length;
  const remainingCount = testResults.filter(r => r.status === 'pending').length;
  const currentKeyItem = currentIndex >= 0 && currentIndex < centralKeys.length ? centralKeys[currentIndex] : null;
  const progressPercent = testResults.length > 0 && currentIndex >= 0 
    ? Math.round(((currentIndex + (scanFinished ? 1 : 0)) / testResults.length) * 100) 
    : (scanFinished ? 100 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">Dead API Detection & Safe Deactivation</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  Max 3 Tries Rule
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically tests each API key with a demo image. Any key failing 3 consecutive attempts will be marked as DEAD & deactivated (stored safely to prevent re-addition on login).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* STEP 1: Demo Image Setup (Always visible or customizable) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Demo Test Image</h4>
              </div>
              <span className="text-[11px] text-slate-400">Used to verify title generation on each API</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Image Preview Card */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 h-32 flex items-center justify-center group">
                {demoImage ? (
                  <>
                    <img
                      src={demoImage}
                      alt="Demo Test"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanning}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-3 text-slate-500 text-xs">
                    <Upload className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <span>No image selected</span>
                  </div>
                )}
              </div>

              {/* Upload Dropzone & Preset Controls */}
              <div className="md:col-span-2 space-y-2.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={isScanning}
                />

                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => !isScanning && fileInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-3.5 text-center transition-all ${
                    isScanning 
                      ? 'border-slate-800 bg-slate-900/30 opacity-50 cursor-not-allowed' 
                      : 'border-slate-700 hover:border-purple-500/50 bg-slate-900/40 hover:bg-slate-900/70 cursor-pointer'
                  }`}
                >
                  <p className="text-xs text-slate-300 font-medium">
                    <span className="text-purple-400 font-semibold">Click to upload custom image</span> or drag and drop
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, or WebP up to 10MB</p>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[200px]">
                    Current: <strong className="text-slate-200">{demoImageName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDemoImage(DEFAULT_DEMO_IMAGE);
                      setDemoImageName('Stock Camera Sample (Preset)');
                    }}
                    disabled={isScanning}
                    className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Reset to Default Preset</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Gemini Model Selection */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Validation Gemini Model</h4>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Using Latest API Standard
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              {[
                { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', badge: 'New', desc: 'Cutting-edge speed' },
                { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', badge: 'Default (500 RPD)', desc: 'Fastest verification' },
                { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Latest', desc: 'High intelligence' },
                { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'Stable', desc: 'Standard validation' },
                { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', badge: 'Lite', desc: 'High quota' },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m.id)}
                  disabled={isScanning}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedModel === m.id
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white block">{m.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      selectedModel === m.id ? 'bg-purple-500/30 text-purple-200' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Workflow Explanation Banner */}
          {!isScanning && !scanFinished && (
            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold">
                <Info className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Strict 3-Try Testing Workflow:</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-1 pl-6 list-disc">
                <li>Takes the demo image and requests metadata generation from Gemini.</li>
                <li><strong className="text-emerald-400">Success on Try 1, 2, or 3:</strong> API key is validated active and kept in rotation pool.</li>
                <li><strong className="text-rose-400">Fails all 3 tries:</strong> Key is labeled as DEAD and deactivated from active dispatch pool (stored safely to prevent re-adding upon future user logins).</li>
                <li>Sequentially proceeds across all <strong>{centralKeys.length}</strong> Central API keys.</li>
              </ul>
            </div>
          )}

          {/* Real-time Scan Progress Section */}
          {(isScanning || scanFinished || testResults.length > 0) && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Metric Counters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Keys</p>
                  <p className="text-lg font-bold text-white mt-0.5">{centralKeys.length}</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-emerald-500/20 rounded-xl">
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase">Healthy (Active)</p>
                  <p className="text-lg font-bold text-emerald-300 mt-0.5">{healthyCount}</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-rose-500/20 rounded-xl">
                  <p className="text-[10px] text-rose-400 font-semibold uppercase">Dead (Deactivated)</p>
                  <p className="text-lg font-bold text-rose-400 mt-0.5">{deadCount}</p>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Remaining</p>
                  <p className="text-lg font-bold text-slate-300 mt-0.5">{remainingCount}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {isScanning 
                      ? `Testing Key ${currentIndex + 1} of ${centralKeys.length}` 
                      : scanFinished 
                        ? `All ${centralKeys.length} Keys Processed • Active: ${healthyCount}, Deactivated: ${deadCount}` 
                        : `Ready to Scan ${centralKeys.length} Keys (1st to Last)`}
                  </span>
                  <span className="font-mono text-purple-400 font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Active Testing Card */}
              {isScanning && currentKeyItem && (
                <div className="p-4 bg-slate-950/90 border border-purple-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-purple-500/5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{currentKeyItem.label}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                          {currentKeyItem.maskedKey}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-purple-300">
                          Testing with demo image • Model: <strong className="text-white font-mono">{getModelDisplayName(activeAttemptModel)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cooldownCountdown !== null ? (
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        Next Model Retry in {cooldownCountdown}s
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold rounded-lg flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Attempt {currentAttempt} of 3
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Live Terminal Log / Execution Stream */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>Live Activity Stream</span>
                  <span>{logMessages.length} entries</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                  {logMessages.map(msg => (
                    <div key={msg.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-600 select-none">[{msg.time}]</span>
                      <span className={
                        msg.type === 'success' ? 'text-emerald-400 font-medium' :
                        msg.type === 'error' ? 'text-rose-400 font-semibold' :
                        msg.type === 'warn' ? 'text-amber-300' :
                        'text-slate-300'
                      }>
                        {msg.text}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

              {/* Verified Keys Table */}
              {testResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Test Results Breakdown
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Key Label</th>
                          <th className="py-2.5 px-3">Masked ID</th>
                          <th className="py-2.5 px-3">Attempts</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Result / Generated Title</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {testResults.map(r => (
                          <tr key={r.keyId} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[140px]">
                              {r.label}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {r.maskedKey}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.status === 'pending' ? (
                                <span className="text-slate-600">-</span>
                              ) : (
                                <span className="font-mono text-slate-300">{r.attempt}/3</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.status === 'healthy' && (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold text-[11px] inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Active
                                </span>
                              )}
                              {r.status === 'dead' && (
                                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded font-semibold text-[11px] inline-flex items-center gap-1" title="Stored in database but permanently deactivated from rotation">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" /> Dead (Deactivated)
                                </span>
                              )}
                              {r.status === 'testing' && (
                                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-semibold text-[11px] inline-flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Testing
                                </span>
                              )}
                              {r.status === 'pending' && (
                                <span className="text-slate-500 text-[11px]">Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 truncate max-w-[260px]" title={r.title || r.error}>
                              {r.title ? (
                                <span className="text-emerald-300 font-normal">"{r.title}"</span>
                              ) : r.error ? (
                                <span className="text-rose-400/90 font-normal">{r.error}</span>
                              ) : (
                                <span className="text-slate-600">Waiting in queue</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            {scanFinished ? (
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Verified all {centralKeys.length} Central API keys ({healthyCount} Active, {deadCount} Deactivated) • Database updated
              </span>
            ) : isScanning ? (
              <span className="text-purple-300 flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                Scanning from first to last API ({currentIndex + 1}/{centralKeys.length})...
              </span>
            ) : (
              <span>Ready to test {centralKeys.length} Central API keys sequentially.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isScanning ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsPaused(p => !p)}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStopScan}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Stop Scan</span>
                </button>
              </>
            ) : scanFinished ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Close & Refresh Table
                </button>

                <button
                  type="button"
                  onClick={startScan}
                  disabled={centralKeys.length === 0}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  title="Restart scan from the 1st key to the last key"
                >
                  <Flame className="w-4 h-4" />
                  <span>Rescan All Keys ({centralKeys.length})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={startScan}
                  disabled={centralKeys.length === 0}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>Start Scan from 1st Key ({centralKeys.length})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
