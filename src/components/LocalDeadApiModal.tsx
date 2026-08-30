import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  Trash2, 
  Play, 
  Pause, 
  AlertTriangle, 
  Loader2, 
  ShieldAlert, 
  Image as ImageIcon, 
  RefreshCw, 
  Sparkles,
  StopCircle,
  CheckCircle,
  Eye,
  Info,
  RotateCcw,
  Flame,
  CheckCircle2,
  Lock,
  Key,
  Copy,
  Check,
  Zap,
  Clock,
  Layers
} from 'lucide-react';
import { ApiKey } from '../types';
import { getAttemptModel, getModelDisplayName, formatScanErrorMessage, SCAN_FALLBACK_MODELS } from '../utils/scanModelWaterfall';

const DEFAULT_DEMO_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface LocalDeadApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  localKeys: ApiKey[];
  onRemove: (id: string) => void;
  onRemoveMultiple?: (ids: string[]) => void;
  onScanComplete?: () => void;
}

export interface LocalKeyTestResult {
  keyId: string;
  label: string;
  maskedKey: string;
  rawKey: string;
  status: 'pending' | 'testing' | 'healthy' | 'dead';
  attempt: number;
  maxAttempts: number;
  latencyMs?: number;
  title?: string;
  error?: string;
  deleted?: boolean;
}

export const LocalDeadApiModal: React.FC<LocalDeadApiModalProps> = ({
  isOpen,
  onClose,
  localKeys,
  onRemove,
  onRemoveMultiple,
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
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  
  const [testResults, setTestResults] = useState<LocalKeyTestResult[]>([]);
  const [logMessages, setLogMessages] = useState<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  
  const stopRequestedRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const hasAutoStartedRef = useRef<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Filter valid local keys (exclude central pseudo-keys)
  const validLocalKeys = React.useMemo(() => {
    return (localKeys || []).filter(k => k && k.key && !k.key.startsWith('central-') && k.key.trim().length > 10);
  }, [localKeys]);

  const maskKey = (key: string): string => {
    if (!key) return '••••••••';
    const trimmed = key.trim();
    if (trimmed.length <= 10) return `${trimmed.substring(0, 3)}...`;
    return `${trimmed.substring(0, 5)}...${trimmed.substring(trimmed.length - 4)}`;
  };

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logMessages]);

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogMessages(prev => [...prev.slice(-150), { id: Math.random().toString(36).substring(2, 9), time, text, type }]);
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
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          compressImage(event.target.result as string, (compressed) => {
            setDemoImage(compressed);
            setDemoImageName(file.name);
            addLog(`Custom test image uploaded: ${file.name}`, 'info');
          });
        }
      };
      reader.readAsDataURL(file);
    }
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
            addLog(`Demo image dropped: ${file.name}`, 'info');
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const testSingleLocalKeyApi = async (rawKey: string, base64Img: string, model: string) => {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/admin/keys/test-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawKey,
          base64Image: base64Img,
          model
        })
      });
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);
      return { ...data, latencyMs };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: false, error: err?.message || 'Network request failed', latencyMs };
    }
  };

  const startScan = async () => {
    if (!demoImage) {
      addLog("Please upload or select a demo image to test API keys against.", 'error');
      return;
    }
    if (validLocalKeys.length === 0) {
      addLog("No local API keys found to test.", 'warn');
      return;
    }

    stopRequestedRef.current = false;
    setIsScanning(true);
    setIsPaused(false);
    setScanFinished(false);
    setLogMessages([]);
    setCurrentLatency(null);

    const initialResults: LocalKeyTestResult[] = validLocalKeys.map(k => ({
      keyId: k.id,
      label: k.label || 'Local Key',
      maskedKey: maskKey(k.key),
      rawKey: k.key,
      status: 'pending',
      attempt: 0,
      maxAttempts: 3
    }));

    setTestResults(initialResults);
    addLog(`Starting Local Dead API Scan across ${validLocalKeys.length} local API keys.`, 'info');
    addLog(`Multi-Model Waterfall: Try 1 (${getModelDisplayName(getAttemptModel(selectedModel, 1))}) -> Try 2 (${getModelDisplayName(getAttemptModel(selectedModel, 2))}) -> Try 3 (${getModelDisplayName(getAttemptModel(selectedModel, 3))}).`, 'info');

    let healthyCount = 0;
    let deadCount = 0;

    for (let i = 0; i < validLocalKeys.length; i++) {
      if (stopRequestedRef.current) {
        addLog(`Scan stopped by user.`, 'warn');
        break;
      }

      // Handle pause loop
      while (isPausedRef.current && !stopRequestedRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }
      if (stopRequestedRef.current) break;

      const currentKey = validLocalKeys[i];
      setCurrentIndex(i);
      setCooldownCountdown(null);

      setTestResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'testing', attempt: 1 } : r));
      addLog(`[${i + 1}/${validLocalKeys.length}] Testing key "${currentKey.label}" (${maskKey(currentKey.key)})...`, 'info');

      let passed = false;
      let generatedTitle = '';
      let lastErrorMessage = '';
      let attemptNumber = 0;
      let lastLatency = 0;
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
          const testRes = await testSingleLocalKeyApi(currentKey.key, demoImage, currentModelForAttempt);
          lastLatency = testRes.latencyMs || 0;
          setCurrentLatency(lastLatency);

          if (testRes.success && testRes.title) {
            passed = true;
            generatedTitle = testRes.title;
            addLog(`  ✓ Attempt ${attempt}/3 PASSED (${lastLatency}ms) with ${getModelDisplayName(currentModelForAttempt)}: "${generatedTitle.substring(0, 55)}..."`, 'success');
            break;
          } else {
            lastErrorMessage = testRes.error || 'Failed to generate title';
            const cleanErr = formatScanErrorMessage(lastErrorMessage);
            if (lastErrorMessage.includes('429') || lastErrorMessage.includes('RESOURCE_EXHAUSTED')) {
              hadRateLimit = true;
            }

            // Only abort early if key is literally invalid / revoked in GCP
            if (lastErrorMessage.includes('API key not valid') || lastErrorMessage.includes('API_KEY_INVALID')) {
              addLog(`  ✗ Attempt ${attempt}/3 FATAL: API key is invalid or deleted in Google Cloud.`, 'error');
              break;
            }

            addLog(`  ✗ Attempt ${attempt}/3 FAILED (${lastLatency}ms) [${getModelDisplayName(currentModelForAttempt)}]: ${cleanErr}`, 'warn');

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

      if (stopRequestedRef.current) break;

      if (passed) {
        healthyCount++;
        setTestResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: 'healthy',
          title: generatedTitle,
          attempt: attemptNumber,
          latencyMs: lastLatency
        } : r));
      } else {
        deadCount++;
        const finalCleanErr = formatScanErrorMessage(lastErrorMessage);
        setTestResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: 'dead',
          error: finalCleanErr,
          attempt: attemptNumber,
          latencyMs: lastLatency
        } : r));
        addLog(`  🚨 KEY MARKED AS DEAD after ${attemptNumber} attempt(s): "${currentKey.label}" (${finalCleanErr})`, 'error');
      }

      // Safe pacing delay between keys to prevent 429 cascading
      const keyCooldown = hadRateLimit ? 3500 : 1500;
      await new Promise(r => setTimeout(r, keyCooldown));
    }

    setIsScanning(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    setCurrentAttempt(0);
    setScanFinished(true);

    if (!stopRequestedRef.current) {
      addLog(`Scan finished. Healthy: ${healthyCount} | Dead: ${deadCount} of ${validLocalKeys.length} keys tested.`, 'info');
      if (onScanComplete) onScanComplete();
    }
  };

  // Auto start scan on initial modal open
  useEffect(() => {
    if (isOpen && validLocalKeys.length > 0 && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      const timer = setTimeout(() => {
        startScan();
      }, 350);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen]);

  const handleStopScan = () => {
    stopRequestedRef.current = true;
    setIsScanning(false);
    setIsPaused(false);
    addLog(`Stop requested by user. Terminating process...`, 'warn');
  };

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    addLog(isPaused ? 'Resuming scan...' : 'Pausing scan...', 'warn');
  };

  const handleDeleteSingleDeadKey = (id: string, label: string) => {
    onRemove(id);
    addLog(`Deleted local key: "${label}"`, 'success');
    setTestResults(prev => prev.map(tr => tr.keyId === id ? { ...tr, deleted: true } : tr));
  };

  const handleDeleteAllDeadKeys = () => {
    const deadKeyIds = testResults.filter(t => t.status === 'dead' && !t.deleted).map(t => t.keyId);
    if (deadKeyIds.length === 0) return;

    if (!window.confirm(`Delete all ${deadKeyIds.length} dead local API key(s) from this browser?`)) {
      return;
    }

    if (onRemoveMultiple) {
      onRemoveMultiple(deadKeyIds);
    } else {
      deadKeyIds.forEach(id => onRemove(id));
    }

    addLog(`Deleted all ${deadKeyIds.length} dead local key(s).`, 'success');
    setTestResults(prev => prev.map(tr => deadKeyIds.includes(tr.keyId) ? { ...tr, deleted: true } : tr));
  };

  const copyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const healthyCount = testResults.filter(r => r.status === 'healthy').length;
  const deadCount = testResults.filter(r => r.status === 'dead').length;
  const remainingCount = testResults.filter(r => r.status === 'pending').length;
  const currentKeyItem = currentIndex >= 0 && currentIndex < validLocalKeys.length ? validLocalKeys[currentIndex] : null;
  const progressPercent = testResults.length > 0 && currentIndex >= 0 
    ? Math.round(((currentIndex + (scanFinished ? 1 : 0)) / testResults.length) * 100) 
    : (scanFinished ? 100 : 0);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-950/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-white tracking-tight">Local Dead API Cleaner</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  Max 3 Tries Rule
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {validLocalKeys.length} Local Keys
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Sequentially tests each local browser API key with a demo image. Failed keys (3 consecutive retries) are identified for 1-click cleanup.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* STEP 1: Demo Image Setup */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Demo Test Image</h4>
              </div>
              <span className="text-[11px] text-slate-400">Used to verify title generation on each local key</span>
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
                <CheckCircle2 className="w-3.5 h-3.5" /> High-Quota Standard
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
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
                <li>Takes the demo image and executes a test generation request on each key.</li>
                <li><strong className="text-emerald-400">Success on Try 1, 2, or 3:</strong> Key is healthy and kept in local browser storage.</li>
                <li><strong className="text-rose-400">Fails all 3 tries:</strong> Key is flagged as DEAD (invalid credentials, revoked key, or exhausted quota).</li>
                <li>Provides 1-click automatic deletion of all dead keys so your processing queue runs without errors.</li>
              </ul>
            </div>
          )}

          {/* Real-time Scan Progress Section */}
          {(isScanning || scanFinished || testResults.length > 0) && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Metric Counters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-slate-400 text-xs font-medium">Total Local Keys</div>
                  <div className="text-2xl font-bold text-white mt-1">{validLocalKeys.length}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">In Browser Storage</div>
                </div>

                <div className="bg-slate-950/80 border border-emerald-500/30 p-4 rounded-2xl">
                  <div className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Healthy
                  </div>
                  <div className="text-2xl font-bold text-emerald-300 mt-1">{healthyCount}</div>
                  <div className="text-[10px] text-emerald-500/80 mt-0.5">Verified Working</div>
                </div>

                <div className="bg-slate-950/80 border border-rose-500/30 p-4 rounded-2xl">
                  <div className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Dead Keys
                  </div>
                  <div className="text-2xl font-bold text-rose-300 mt-1">{deadCount}</div>
                  <div className="text-[10px] text-rose-500/80 mt-0.5">Failed 3 Attempts</div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Remaining
                  </div>
                  <div className="text-2xl font-bold text-slate-300 mt-1">{remainingCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Pending Execution</div>
                </div>
              </div>

              {/* Progress Bar & Status */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {isScanning ? (
                      <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isPaused ? 'Scan Paused' : `Testing Key ${currentIndex + 1} of ${validLocalKeys.length}`}
                      </span>
                    ) : scanFinished ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Scan Finished
                      </span>
                    ) : (
                      <span className="text-slate-400">Ready to begin</span>
                    )}

                    {isScanning && currentAttempt > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        Attempt {currentAttempt}/3
                      </span>
                    )}

                    {currentLatency !== null && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {currentLatency}ms
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-purple-300 font-bold">{progressPercent}%</span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* In-Progress Key Card */}
              {isScanning && currentKeyItem && (
                <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-purple-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{currentKeyItem.label || 'Local Key'}</span>
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                          {maskKey(currentKeyItem.key)}
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

              {/* Dual Column: Terminal Console + Results Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Live Terminal Log */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col h-72">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-900 text-xs">
                    <span className="font-mono text-slate-400 font-semibold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" /> Live Execution Terminal
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{logMessages.length} events</span>
                  </div>

                  <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 pt-2 custom-scrollbar pr-1">
                    {logMessages.map(msg => (
                      <div key={msg.id} className="leading-relaxed flex items-start gap-2">
                        <span className="text-[10px] text-slate-600 shrink-0">{msg.time}</span>
                        <span className={`break-words ${
                          msg.type === 'success' ? 'text-emerald-400 font-medium' :
                          msg.type === 'error' ? 'text-rose-400 font-medium' :
                          msg.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                        }`}>
                          {msg.text}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Scanned Keys List */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col h-72">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-900 text-xs">
                    <span className="font-semibold text-slate-300">Scanned Keys List</span>
                    <span className="text-[10px] text-slate-500">{testResults.length} Keys</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pt-2 custom-scrollbar pr-1">
                    {testResults.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs">
                        No keys processed yet
                      </div>
                    ) : (
                      testResults.map(r => (
                        <div
                          key={r.keyId}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                            r.deleted 
                              ? 'bg-slate-900/30 border-slate-900 opacity-40' 
                              : r.status === 'healthy'
                                ? 'bg-emerald-950/10 border-emerald-500/20'
                                : r.status === 'dead'
                                  ? 'bg-rose-950/20 border-rose-500/30'
                                  : r.status === 'testing'
                                    ? 'bg-purple-950/30 border-purple-500/40'
                                    : 'bg-slate-900/40 border-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0">
                              {r.deleted ? (
                                <span className="text-[10px] text-slate-500 font-mono line-through">DELETED</span>
                              ) : r.status === 'healthy' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : r.status === 'dead' ? (
                                <AlertTriangle className="w-4 h-4 text-rose-400" />
                              ) : r.status === 'testing' ? (
                                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                              ) : (
                                <Clock className="w-4 h-4 text-slate-500" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-semibold truncate ${r.deleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                  {r.label}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                                  {r.maskedKey}
                                </span>
                              </div>
                              {r.title && (
                                <span className="text-[10px] text-emerald-400/90 truncate block">
                                  ✓ {r.title}
                                </span>
                              )}
                              {r.error && (
                                <span className="text-[10px] text-rose-400/90 truncate block" title={r.error}>
                                  ✗ {r.error}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {r.latencyMs && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {r.latencyMs}ms
                              </span>
                            )}
                            {r.status === 'dead' && !r.deleted && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSingleDeadKey(r.keyId, r.label)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Delete Dead Local Key"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {deadCount > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllDeadKeys}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete All Dead Keys ({testResults.filter(t => t.status === 'dead' && !t.deleted).length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isScanning ? (
              <>
                <button
                  type="button"
                  onClick={handlePauseToggle}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopScan}
                  className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-600/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Stop</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startScan}
                  disabled={validLocalKeys.length === 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-900/30 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rescan All Keys</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-700"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
