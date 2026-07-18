import React, { useState, useEffect, useRef } from 'react';
import { ApiKey, ProcessingItem, ProcessingConfig, HistoryRecord, ProcessingLog } from './types';
import { ProcessingQueue } from './components/ProcessingQueue';
import { Sidebar } from './components/Sidebar';
import { StatisticsModal } from './components/StatisticsModal';
import { compressImage } from './services/imageUtils';
import { generateMetadataBatch } from './services/geminiService';
import { saveProject, loadProject, clearProject } from './services/projectStorage';
import { Clock, Key } from 'lucide-react';

// Persistence Keys
const STORAGE_KEYS = 'parrarel_keys_v5'; 
const STORAGE_HISTORY = 'parrarel_history_v3';
const STORAGE_LOGS = 'parrarel_logs_v1';
const STORAGE_CONFIG = 'parrarel_config_v3';
const STORAGE_ITEMS = 'parrarel_items_v3';
const STORAGE_STATS = 'parrarel_stats_v1';

// Models
const MODELS = [
  { id: 'auto', name: 'Auto (Best Effort)', rpm: 5 },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (20 RPD)', rpm: 5 },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (500 RPD)', rpm: 10 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (20 RPD)', rpm: 5 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (20 RPD)', rpm: 5 },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (20 RPD)', rpm: 10 }
];

// Helper: Get Session Date (Resets at 2:00 PM GMT+6)
export const getUsageSessionId = () => {
  const now = new Date();
  // Dhaka is GMT+6.
  // We want the "day" to switch at 14:00 Dhaka time.
  // So if it is 13:59 Dhaka time, it is still the "previous day".
  // If it is 14:00 Dhaka time, it is the "new day".
  
  // Get time in Dhaka
  const dhakaTimeStr = now.toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
  const dhakaTime = new Date(dhakaTimeStr);
  
  // If hour < 14, it belongs to the previous day's session
  if (dhakaTime.getHours() < 14) {
    dhakaTime.setDate(dhakaTime.getDate() - 1);
  }
  
  // Return YYYY-MM-DD
  const year = dhakaTime.getFullYear();
  const month = String(dhakaTime.getMonth() + 1).padStart(2, '0');
  const day = String(dhakaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface Toast {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export default function App() {
  // --- State ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>(() => {
    try {
      const loaded = JSON.parse(localStorage.getItem(STORAGE_KEYS) || '[]');
      const currentSession = getUsageSessionId();
      
      // Migration: Add usage if missing or reset if new session
      return loaded.map((k: any) => {
        let usage = k.usage || { date: currentSession, flash: 0, lite: 0, flash_3: 0 };
        if (usage.date !== currentSession) {
            usage = { date: currentSession, flash: 0, lite: 0, flash_3: 0 };
        }
        return { 
            ...k, 
            cooldownUntil: undefined,
            errorCount: 0, // Reset errors on reload to prevent permanent blocking
            usage: usage
        };
      });
    } catch { return []; }
  });

  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
    } catch { return []; }
  });

  const [logs, setLogs] = useState<ProcessingLog[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '[]');
    } catch { return []; }
  });

  // Items are loaded from localStorage if available
  const [items, setItems] = useState<ProcessingItem[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_ITEMS) || '[]');
      return stored.map((item: any) => {
          // If it was compressing or processing, reset its state or mark as error if we don't have the file
          if (item.status === 'compressing') {
              return { ...item, status: 'error', errorMsg: 'Interrupted. Please re-upload.' };
          }
          if (item.status === 'processing') {
              return { ...item, status: 'pending' };
          }
          return item;
      });
    } catch { return []; }
  });

  const [modelStats, setModelStats] = useState<Record<string, { totalTimeMs: number, count: number, fails: number }>>(() => {
      try {
          return JSON.parse(localStorage.getItem(STORAGE_STATS) || '{}');
      } catch {
          return {};
      }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('Ready');
  const [tick, setTick] = useState(0); 
  const [etaEndTime, setEtaEndTime] = useState<number | null>(null);
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  const [config, setConfig] = useState<ProcessingConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG);
      if (saved) {
          const parsed = JSON.parse(saved);
          return { ...parsed, batchSize: parsed.batchSize || 5, model: parsed.model || 'auto' };
      }
    } catch (e) { /* ignore */ }
    
    return {
      concurrency: 1, 
      batchSize: 1, 
      maxRetries: 3,
      titleMaxLen: 120,
      keywordsCount: 40,
      model: 'auto', 
      titlePrefix: '',
      titleSuffix: '',
      negativeTitleWords: '',
      negativeKeywords: '',
      targetExtension: '',
      forceTransparency: false,
      autoExport: false,
      migratedTo31Lite: true
    };
  });

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const processingCount = items.filter(i => i.status === 'processing').length;
  const activeKeysCount = keys.filter(k => k.errorCount < 20).length;

  useEffect(() => {
    const itemsLeft = pendingCount + processingCount;
    if (isProcessing && itemsLeft > 0) {
      let avgMsPerItem = 5000 / (config.batchSize || 1); // fallback
      if (logs.length > 0) {
        let totalItems = 0;
        let totalDuration = 0;
        logs.forEach(log => {
          totalItems += log.itemCount;
          totalDuration += log.durationMs;
        });
        if (totalItems > 0) {
          avgMsPerItem = totalDuration / totalItems;
        }
      }

      const activeKeys = Math.max(1, activeKeysCount);
      const msLeft = (itemsLeft * avgMsPerItem) / activeKeys;
      setEtaEndTime(Date.now() + msLeft);
    } else {
      setEtaEndTime(null);
    }
  }, [isProcessing, pendingCount, processingCount, activeKeysCount, logs]);

  // Refs for scrolling
  const itemRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const autoModelIndexRef = useRef(0);
  
  // Refs for Drag-to-Scroll
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);

  // Persist State
  useEffect(() => localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys)), [keys]);
  useEffect(() => localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs)), [logs]);
  useEffect(() => localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config)), [config]);
  useEffect(() => localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats)), [modelStats]);
  
  // Auto-save items every 30 seconds
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (itemsRef.current.length > 0) {
          // Omit file and blob to avoid exceeding localStorage quota and stripping issues
          const storableItems = itemsRef.current.map(item => ({
              ...item,
              file: null,
              blob: null
          }));
          try {
              localStorage.setItem(STORAGE_ITEMS, JSON.stringify(storableItems));
          } catch (e) {
              console.warn("Failed to auto-save items to localStorage:", e);
          }
      } else {
          localStorage.removeItem(STORAGE_ITEMS);
      }
    }, 30000);
    return () => clearInterval(autoSaveInterval);
  }, []);
  
  // Session Reset Check Timer
  useEffect(() => {
    const checkDate = setInterval(() => {
        const currentSession = getUsageSessionId();
        setKeys(prev => prev.map(k => {
            // Check if usage exists, if not or date mismatch, reset
            if (!k.usage || k.usage.date !== currentSession) {
                return { ...k, usage: { date: currentSession, flash: 0, lite: 0, flash_3: 0 } };
            }
            return k;
        }));
    }, 60000); // Check every minute
    return () => clearInterval(checkDate);
  }, []);

  // LOAD PROJECT ON MOUNT
  useEffect(() => {
    const initProject = async () => {
      try {
        const savedItems = await loadProject();
        if (savedItems && savedItems.length > 0) {
          setItems(savedItems);
          setStatusMsg(`Restored project with ${savedItems.length} items.`);
        }
      } catch (error) {
        console.error("Failed to load project:", error);
      }
    };
    initProject();
  }, []);

  const lastUserScrollRef = useRef(0);

  // Auto-scroll to processing item
  useEffect(() => {
    if (!isProcessing) return;
    if (Date.now() - lastUserScrollRef.current < 10000) return;

    const activeItem = items.find(i => i.status === 'processing');
    if (activeItem && itemRefs.current[activeItem.id]) {
      setTimeout(() => {
        if (Date.now() - lastUserScrollRef.current < 10000) return;
        itemRefs.current[activeItem.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [items.map(i => i.status).join(',')]); 

  // Scheduler Tick
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // --- Drag to Scroll Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'SELECT' || 
      target.closest('button') ||
      target.closest('[role="button"]') ||
      target.closest('.group.relative.border-2') || // Drop Zone
      target.closest('.cursor-ew-resize') // Custom Slider
    ) {
      return;
    }

    isDraggingRef.current = true;
    startYRef.current = e.pageY;
    if (scrollContainerRef.current) {
        startScrollTopRef.current = scrollContainerRef.current.scrollTop;
        scrollContainerRef.current.style.cursor = 'grabbing';
        scrollContainerRef.current.style.userSelect = 'none';
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (scrollContainerRef.current) {
        scrollContainerRef.current.style.cursor = 'default';
        scrollContainerRef.current.style.removeProperty('user-select');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    lastUserScrollRef.current = Date.now();
    const walk = (e.pageY - startYRef.current) * 1.5; // Multiplier for faster scrolling
    scrollContainerRef.current.scrollTop = startScrollTopRef.current - walk;
  };

  // --- Actions ---

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const existingNames = new Set(items.map(p => p.name));
    
    const newItems: ProcessingItem[] = Array.from(files)
      .filter(f => (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.eps') || f.name.toLowerCase().endsWith('.svg')) && !existingNames.has(f.name))
      .map(f => ({
        id: Math.random().toString(36).slice(2, 11),
        file: f,
        name: f.name,
        size: f.size,
        thumb: null,
        blob: null,
        status: 'pending',
        attempts: 0,
        title: '',
        keywords: '',
        failedKeyIds: []
      }));

    if (newItems.length > 0) {
      setItems(prev => [...prev, ...newItems]);

      const compressQueue = [...newItems];
      const processCompression = async () => {
        const workers = Array(3).fill(null).map(async () => {
          while (compressQueue.length > 0) {
            const item = compressQueue.shift();
            if (!item) break;

            setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'compressing' } : p));
            setStatusMsg(`Preparing ${item.name}...`);
            try {
              const { blob, dataUrl } = await compressImage(item.file!, 50);
              setItems(prev => prev.map(p => p.id === item.id ? { ...p, blob, thumb: dataUrl, status: 'pending' } : p));
            } catch (err) {
              console.error(err);
              setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error', errorMsg: 'Preparation failed' } : p));
            }
          }
        });
        await Promise.all(workers);
        setStatusMsg('Preparation complete.');
      };
      
      processCompression();
    }
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const updateItem = (id: string, field: 'title' | 'keywords', value: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
  };

  const handleRegenerate = (id: string) => {
    // Completely reset the item for a fresh start
    setItems(prev => prev.map(p => p.id === id ? {
      ...p,
      status: 'pending',
      title: '',
      keywords: '',
      errorMsg: undefined,
      attempts: 0,
      assignedKeyId: undefined,
      failedKeyIds: [], // Important: Reset failure history
      retryAfter: undefined
    } : p));
    setIsProcessing(true); // Auto-start
  };

  const handleRetryFailed = () => {
      // Find all error/failed items and reset them
      setItems(prev => prev.map(p => {
          if (p.status === 'error' || (p.status === 'pending' && p.attempts > 0)) {
              return {
                  ...p,
                  status: 'pending',
                  errorMsg: undefined,
                  assignedKeyId: undefined,
                  // We deliberately do NOT reset failedKeyIds completely here to encourage trying *new* keys,
                  // UNLESS the item had failed on "All keys", in which case we must reset to try again.
                  failedKeyIds: p.errorMsg?.includes('All API keys') ? [] : p.failedKeyIds,
                  attempts: 0,
                  retryAfter: undefined
              };
          }
          return p;
      }));
      setIsProcessing(true);
      setStatusMsg("Retrying failed items...");
  };

  const handleResetUsage = (id: string) => {
      if (window.confirm('Are you sure you want to manually reset usage counts and errors for this key?')) {
          const currentSession = getUsageSessionId();
          setKeys(prev => prev.map(k => {
              if (k.id === id) {
                  return { 
                      ...k, 
                      errorCount: 0, // Reset errors too
                      usage: { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0 } 
                  };
              }
              return k;
          }));
      }
  };

  const handleCopy = (item: ProcessingItem) => {
    const safeName = `"${item.name.replace(/"/g, '""')}"`;
    const safeTitle = `"${item.title.replace(/"/g, '""')}"`;
    const safeKeys = `"${item.keywords.replace(/"/g, '""')}"`;
    const row = `${safeName},${safeTitle},${safeKeys}`;
    navigator.clipboard.writeText(row);
  };

  // --- Processing Engine (Batch Enabled) ---

  const getModelDelay = (modelId: string) => {
    if (modelId === 'auto') return 12500;
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return 12000;
    return (60000 / model.rpm) + 500;
  };

  const startBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {
    // 1. Mark all as processing
    setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { 
      ...p, 
      status: 'processing', 
      assignedKeyId: keyObj.id 
    } : p));

    setStatusMsg(`Processing batch of ${batchItems.length} items (${keyObj.label})...`);

    const batchStartTime = Date.now();

    try {
      const payload = batchItems.map(item => {
          if (!item.thumb) throw new Error("Missing thumbnail");
          return { id: item.id, base64Image: item.thumb };
      });

      let results: any;
      let usedModel = config.model;

      if (config.model === 'auto') {
        const autoModels = [
          'gemini-3.5-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-3.1-flash-lite-preview',
          'gemini-2.5-flash-lite'
        ];

        // Sort by average latency + penalty for fails
        autoModels.sort((a, b) => {
            const statA = modelStats[a];
            const statB = modelStats[b];
            
            const scoreA = statA ? ((statA.totalTimeMs / Math.max(1, statA.count)) + (statA.fails * 5000)) : 10000;
            const scoreB = statB ? ((statB.totalTimeMs / Math.max(1, statB.count)) + (statB.fails * 5000)) : 10000;
            
            return scoreA - scoreB;
        });

        let success = false;
        let lastError = null;

        for (let i = 0; i < autoModels.length; i++) {
            usedModel = autoModels[i];
            const startTime = Date.now();
            try {
                results = await generateMetadataBatch(
                  keyObj.key,
                  payload,
                  { ...config, model: usedModel }
                );
                success = true;
                const elapsed = Date.now() - startTime;
                setModelStats(prev => {
                    const current = prev[usedModel!] || { totalTimeMs: 0, count: 0, fails: 0 };
                    return { ...prev, [usedModel!]: { ...current, totalTimeMs: current.totalTimeMs + elapsed, count: current.count + 1 } };
                });
                break;
            } catch (err) {
                console.warn(`Auto: ${usedModel} failed, retrying...`, err);
                lastError = err;
                setModelStats(prev => {
                    const current = prev[usedModel!] || { totalTimeMs: 0, count: 0, fails: 0 };
                    return { ...prev, [usedModel!]: { ...current, fails: current.fails + 1 } };
                });
            }
        }
        
        if (!success) {
            throw lastError;
        }
      } else {
        const startTime = Date.now();
        results = await generateMetadataBatch(keyObj.key, payload, config);
        const elapsed = Date.now() - startTime;
        setModelStats(prev => {
            const current = prev[usedModel!] || { totalTimeMs: 0, count: 0, fails: 0 };
            return { ...prev, [usedModel!]: { ...current, totalTimeMs: current.totalTimeMs + elapsed, count: current.count + 1 } };
        });
      }

      setItems(prev => prev.map(p => {
          if (results[p.id]) {
              return { 
                ...p, 
                status: 'done', 
                title: results[p.id].title, 
                keywords: results[p.id].keywords,
                assignedKeyId: undefined,
                retryAfter: undefined,
                failedKeyIds: [], // Success resets failures
                usedModel: usedModel
              };
          }
          return p;
      }));
      
      const cooldownMs = getModelDelay(config.model);
      
      setKeys(prev => prev.map(k => {
        if (k.id === keyObj.id) {
            const currentSession = getUsageSessionId();
            const newUsage = { ...(k.usage || { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0 }) };
            
            // Ensure usage date is current session before incrementing
            if (newUsage.date !== currentSession) {
                newUsage.date = currentSession;
                newUsage.flash = 0;
                newUsage.lite = 0;
                newUsage.flash_3 = 0;
                newUsage.flash_3_1_lite = 0;
            }

            if (usedModel.includes('gemini-3.5-flash')) newUsage.flash_3_5 = (newUsage.flash_3_5 || 0) + 1;
            else if (usedModel.includes('gemini-3.1-flash-lite-preview')) newUsage.flash_3_1_lite = (newUsage.flash_3_1_lite || 0) + 1;
            else if (usedModel.includes('gemini-2.5-flash-lite')) newUsage.lite = (newUsage.lite || 0) + 1;
            else if (usedModel.includes('gemini-2.5-flash')) newUsage.flash = (newUsage.flash || 0) + 1;
            else if (usedModel.includes('gemini-3-flash-preview')) newUsage.flash_3 = (newUsage.flash_3 || 0) + 1;

            return { 
                ...k, 
                errorCount: Math.max(0, k.errorCount - 1),
                cooldownUntil: Date.now() + cooldownMs,
                usage: newUsage
            };
        }
        return k;
      }));
      
      const batchDuration = Date.now() - batchStartTime;
      const totalTime = parseInt(localStorage.getItem('TOTAL_PROCESSING_TIME') || '0', 10) + batchDuration;
      const totalBatches = parseInt(localStorage.getItem('TOTAL_BATCHES_PROCESSED') || '0', 10) + 1;
      localStorage.setItem('TOTAL_PROCESSING_TIME', totalTime.toString());
      localStorage.setItem('TOTAL_BATCHES_PROCESSED', totalBatches.toString());
      
      const newAvg = totalTime / totalBatches;
      localStorage.setItem('AVG_PROCESSING_TIME', Math.round(newAvg).toString());

      const newLog: ProcessingLog = {
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        itemCount: batchItems.length,
        durationMs: batchDuration
      };
      setLogs(prev => [...prev, newLog]);

    } catch (error: any) {
      console.warn(`Key ${keyObj.label} failed for batch:`, error);
      
      const errMsg = error.message || "";
      let cooldownTime = 0;
      let errorPenalty = 1;

      if (errMsg.includes('QUOTA_EXCEEDED') || errMsg.includes('429')) {
        cooldownTime = 60 * 1000;
        errorPenalty = 0; // Do not penalize for rate limits
      } else if (errMsg.includes('INVALID_KEY')) {
        errorPenalty = 10; // Kill invalid keys immediately
      } else {
        errorPenalty = 1; // Standard penalty for other errors
      }

      setKeys(prevKeys => prevKeys.map(k => {
          if (k.id === keyObj.id) {
              return { 
                ...k, 
                errorCount: k.errorCount + errorPenalty,
                cooldownUntil: cooldownTime > 0 ? Date.now() + cooldownTime : undefined
              };
          }
          return k;
      }));

      // Revert items to pending or error
      setItems(prev => {
        // We consider keys active if they have < 20 errors (increased from 5)
        const activeKeys = keys.filter(k => k.errorCount < 20); 
        
        return prev.map(p => {
            if (batchItems.find(b => b.id === p.id)) {
                // Track this key as failed for this specific item
                const newFailedKeys = [...(p.failedKeyIds || []), keyObj.id];
                
                // CRITICAL: Check if we have exhausted all available keys for this item
                // Only fail the item if ALL keys (including this one) have failed it
                const allKeysExhausted = activeKeys.every(k => newFailedKeys.includes(k.id));

                if (allKeysExhausted && activeKeys.length > 0) {
                     return { 
                         ...p, 
                         status: 'error', 
                         errorMsg: `All API keys failed for this image.`, 
                         assignedKeyId: undefined,
                         failedKeyIds: newFailedKeys
                     };
                } else {
                     return { 
                         ...p, 
                         status: 'pending', 
                         assignedKeyId: undefined, 
                         failedKeyIds: newFailedKeys,
                         attempts: p.attempts + 1,
                         retryAfter: Date.now() + 2000 
                     };
                }
            }
            return p;
        });
      });
      setStatusMsg(cooldownTime > 0 ? `Rate limit hit. Cooling down...` : `Batch failed. Rotating keys...`);
    }
  };

  const handleExport = () => {
    const completedItems = items.filter(i => i.status === 'done');
    if (completedItems.length === 0) return;

    const headers = ['Filename', 'Title', 'Keywords'];
    const rows = completedItems.map(i => {
      let fileName = i.name;
      if (config.targetExtension) {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            fileName = fileName.substring(0, lastDotIndex) + config.targetExtension;
        } else {
            fileName = fileName + config.targetExtension;
        }
      }

      const safeName = `"${fileName.replace(/"/g, '""')}"`;
      const safeTitle = `"${i.title.replace(/"/g, '""')}"`;
      const safeKeys = `"${i.keywords.replace(/"/g, '""')}"`;
      return `${safeName},${safeTitle},${safeKeys}`;
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${items.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const newRecord: HistoryRecord = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      itemCount: completedItems.length,
      csv: csvContent
    };
    setHistory(prev => [newRecord, ...prev].slice(0, 20));
    
    const allDone = items.length > 0 && items.every(i => i.status === 'done');
    if (allDone) {
        setItems([]);
        localStorage.removeItem(STORAGE_ITEMS);
        setStatusMsg("Export complete! CSV file has been downloaded. All items cleared.");
        showNotification("Export Complete", `CSV file with ${completedItems.length} items has been downloaded.`);
    } else {
        setStatusMsg(`Exported partial CSV with ${completedItems.length} items.`);
        showNotification("Partial Export", `Downloaded CSV with ${completedItems.length} completed items.`);
    }
  };

  const playSuccessSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.5, audioContext.currentTime + 0.1); // C6
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    if (!isProcessing) return;

    // 1. Calculate slots (Unlimited concurrency - limited only by available keys)
    const activeKeyIds = new Set(items.filter(i => i.status === 'processing' && i.assignedKeyId).map(i => i.assignedKeyId));
    const activeRequests = activeKeyIds.size;
    // No concurrency limit check here

    // 2. Get pending items
    // Filter pending items that have thumbnail ready
    const pendingItems = items.filter(i => i.status === 'pending' && i.thumb);
    
    if (pendingItems.length === 0) {
        const hasActive = items.some(i => i.status === 'processing' || i.status === 'compressing');
        if (!hasActive) {
            setIsProcessing(false);
            const allDone = items.length > 0 && items.every(i => i.status === 'done');
            if (allDone) {
                setStatusMsg('Processing complete.');
                playSuccessSound();
                if (config.autoExport) {
                    handleExport();
                } else {
                    showNotification('Processing Complete', 'All items have been processed successfully.');
                }
            } else {
                const missingBlobs = items.some(i => i.status === 'pending' && !i.thumb);
                if (missingBlobs) {
                    setStatusMsg('Stopped. Some pending items are missing image data. Please re-upload them.');
                    showNotification('Processing Stopped', 'Some pending items are missing image data.');
                } else {
                    setStatusMsg('Processing stopped (some items failed or hit limits).');
                    showNotification('Processing Stopped', 'Some items failed or hit API limits.');
                }
            }
        } else {
            setStatusMsg('Waiting for current batches...');
        }
        return;
    }

    // 3. Find Key
    const now = Date.now();
    const currentSession = getUsageSessionId();

    // Check usage limits and validity
    const validKeys = keys.filter(k => {
        // REMOVED: if (k.errorCount >= 20) return false; 
        // We no longer permanently disable keys based on error count. 
        // We just prioritize better keys and rely on cooldowns.
        
        // We rely on API error responses (429) to handle rate limits rather than strict client-side counting.
        // However, we keep a very high ceiling just in case.
        const usage = (k.usage && k.usage.date === currentSession) ? k.usage : { flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0 };
        
        // Ensure properties are numbers (handle undefined/null from old storage)
        const u = {
            flash: Number(usage.flash || 0),
            lite: Number(usage.lite || 0),
            flash_3: Number(usage.flash_3 || 0),
            flash_3_1_lite: Number(usage.flash_3_1_lite || 0),
            flash_3_5: Number(usage.flash_3_5 || 0)
        };

        // Increased limits to 10,000 to effectively disable client-side blocking
        if (config.model === 'auto') {
            return (u.flash_3_5 < 10000) || (u.flash_3 < 10000) || (u.flash < 10000) || (u.flash_3_1_lite < 10000) || (u.lite < 10000);
        } else if (config.model.includes('gemini-3.5-flash')) {
            return u.flash_3_5 < 10000;
        } else if (config.model.includes('gemini-3.1-flash-lite-preview')) {
            return u.flash_3_1_lite < 10000;
        } else if (config.model.includes('gemini-2.5-flash-lite')) {
            return u.lite < 10000;
        } else if (config.model.includes('gemini-2.5-flash')) {
            return u.flash < 10000;
        } else if (config.model.includes('gemini-3-flash-preview')) {
            return u.flash_3 < 10000;
        }
        return true;
    });
    
    if (validKeys.length === 0) {
        const totalKeys = keys.length;
        if (totalKeys > 0) setStatusMsg("All keys have high error counts or hit safety limits.");
        else setStatusMsg("No API keys configured.");
        setIsProcessing(false);
        return;
    }

    const availableKeys = validKeys.filter(k => 
        !activeKeyIds.has(k.id) && 
        (!k.cooldownUntil || k.cooldownUntil < now)
    );

    if (availableKeys.length === 0) {
        const cooldownKeys = validKeys.filter(k => k.cooldownUntil && k.cooldownUntil > now);
        if (cooldownKeys.length > 0) {
             const minWait = Math.min(...cooldownKeys.map(k => k.cooldownUntil! - now));
             setStatusMsg(`Waiting for API keys cooldown (${Math.ceil(minWait/1000)}s)...`);
        } else if (activeRequests > 0) {
             setStatusMsg("All keys busy...");
        } else {
             setStatusMsg("Waiting for available keys...");
        }
        return;
    }

    // 4. Fill Slots
    const sortedQueue = [...pendingItems].sort((a, b) => a.attempts - b.attempts);
    const batchSize = config.batchSize || 1;

    // Sort keys: prioritize those with fewer errors (healthier)
    availableKeys.sort((a, b) => {
        const healthA = Math.max(0, 100 - (a.errorCount * 5));
        const healthB = Math.max(0, 100 - (b.errorCount * 5));
        return healthB - healthA;
    });

    let currentItemIndex = 0;
    
    // Iterate through available keys to find work
    for (const chosenKey of availableKeys) {
        const batch: ProcessingItem[] = [];
        // Scan queue for items that HAVEN'T failed with this specific key
        let scannedCount = 0;
        
        while (batch.length < batchSize && currentItemIndex < sortedQueue.length) {
            const candidate = sortedQueue[currentItemIndex];
            
            // Check retry timer
            if (candidate.retryAfter && candidate.retryAfter > now) {
                currentItemIndex++;
                continue;
            }

            // CRITICAL: Check if this item has already failed with this specific key
            if (!candidate.failedKeyIds.includes(chosenKey.id)) {
                batch.push(candidate);
                // Remove from local queue so other keys don't pick it in this tick
                sortedQueue.splice(currentItemIndex, 1);
            } else {
                currentItemIndex++;
            }
        }
        
        // Reset index for next key scan (scan from remaining sortedQueue)
        currentItemIndex = 0;

        if (batch.length > 0) {
            startBatchProcessing(batch, chosenKey);
        }
    }

  }, [items, keys, isProcessing, config.concurrency, config.batchSize, tick]);

  // --- SAVE PROJECT ---
  const handleSaveProject = async () => {
    if (items.length === 0) return;
    try {
        await saveProject(items);
        setStatusMsg("Project saved successfully.");
        const btn = document.getElementById('save-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = "Saved!";
            btn.classList.add('bg-emerald-600', 'text-white');
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('bg-emerald-600', 'text-white');
            }, 2000);
        }
    } catch (error) {
        console.error("Save failed", error);
        setStatusMsg("Failed to save project.");
        alert("Failed to save project. Storage might be full.");
    }
  };

  const handleClear = async () => {
      if (window.confirm('Are you sure you want to clear all items and delete the saved project?')) {
          setIsProcessing(false);
          setItems([]);
          localStorage.removeItem(STORAGE_ITEMS);
          setStatusMsg("Clearing project...");
          try {
              await clearProject();
              setStatusMsg("Project cleared.");
          } catch (e) {
              setStatusMsg("Items cleared, but storage cleanup had issues.");
          }
      }
  };
  
  const showNotification = (title: string, message: string) => {
    // 1. In-app toast
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, title, message, type: 'success' }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);

    // 2. OS Notification
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      new Notification(title, { body: message, icon: '/vite.svg' });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body: message, icon: '/vite.svg' });
        }
      });
    }
  };

  const handleStartStop = async () => {
      if (isProcessing) {
          setIsProcessing(false);
          setStatusMsg("Processing paused.");
          return;
      }
      
      if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
      }
      
      if (keys.length === 0) {
          setStatusMsg("No API keys configured. Please add keys first.");
          return;
      }

      setStatusMsg("Validating API keys...");
      let hasValidKey = false;
      const keysToTest = keys.filter(k => k.errorCount < 20);
      
      if (keysToTest.length === 0) {
          setStatusMsg("All configured keys have hit safety limits.");
          return;
      }

      for (const key of keysToTest) {
          try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key.key}`);
              if (res.ok) {
                  hasValidKey = true;
                  break; // Found at least one working key
              }
          } catch (e) {
              // Ignore network errors here and just try the next one
          }
      }

      if (!hasValidKey) {
          setStatusMsg("No valid API keys found. Please check your keys.");
          return;
      }

      setIsProcessing(true);
      if (!startTimeMs) setStartTimeMs(Date.now());
      setStatusMsg("Starting processing...");
  };
  
  const handleClearHistory = () => {
      if (window.confirm('Clear export history?')) {
          setHistory([]);
          localStorage.removeItem(STORAGE_HISTORY);
      }
  };

  const allDone = items.length > 0 && items.every(i => i.status === 'done');
  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error' || (i.status === 'pending' && i.attempts > 3)).length;
  const hasPartialData = doneCount > 0 && !allDone;

  let estimatedTimeNode: React.ReactNode = null;
  if (isProcessing && etaEndTime) {
      const msLeft = Math.max(0, etaEndTime - Date.now());
      const totalSeconds = Math.ceil(msLeft / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      estimatedTimeNode = (
          <span className="inline-flex items-center ml-2 text-purple-400">
             <Clock className="w-3.5 h-3.5 mr-1" />
             ETA: {m > 0 ? `${m}m ` : ''}{s}s
          </span>
      );
  }

  let elapsedTimeNode: React.ReactNode = null;
  if (startTimeMs) {
      const elapsedMs = Math.max(0, Date.now() - startTimeMs);
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      elapsedTimeNode = (
          <span className="inline-flex items-center ml-2 text-slate-400 border-l border-white/10 pl-2">
             Elapsed: {m > 0 ? `${m}m ` : ''}{s}s
          </span>
      );
  }

  // --- GLOBAL KEYBOARD SHORTCUTS ---
  const handlersRef = useRef({ handleSaveProject, handleExport, handleStartStop, handleClear, doneCount: items.filter(i => i.status === 'done').length });
  useEffect(() => {
    handlersRef.current = { handleSaveProject, handleExport, handleStartStop, handleClear, doneCount: items.filter(i => i.status === 'done').length };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlersRef.current.handleSaveProject();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (handlersRef.current.doneCount > 0) {
            handlersRef.current.handleExport();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlersRef.current.handleStartStop();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        handlersRef.current.handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 flex overflow-hidden selection:bg-purple-500/30 font-sans">
      
      {showStats && <StatisticsModal logs={logs} onClose={() => setShowStats(false)} />}

      <Sidebar 
         keys={keys}
         setKeys={setKeys}
         config={config}
         setConfig={setConfig}
         isProcessing={isProcessing}
         onStartStop={handleStartStop}
         hasItems={items.length > 0}
         models={MODELS}
         modelStats={modelStats}
         history={history}
         onViewStats={() => setShowStats(true)}
         onClearHistory={handleClearHistory}
         onResetUsage={handleResetUsage}
      />

      <main 
        className="flex-1 flex flex-col h-full overflow-hidden relative"
      >
        <div className="h-1 bg-slate-900 w-full shrink-0 z-50">
           <div 
               style={{ width: `${items.length ? (items.filter(i => i.status === 'done').length / items.length) * 100 : 0}%` }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
        </div>

        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-950/50 backdrop-blur-md z-30">
           <div>
             <h2 className="text-xl font-bold text-white">Queue</h2>
             <p className="flex items-center text-sm text-slate-500">
               {items.length} items ({doneCount} done)
               {estimatedTimeNode}
               {elapsedTimeNode}
               <span className="inline-flex items-center ml-2 border-l border-white/10 pl-2">
                 <Key className="w-3.5 h-3.5 mr-1" />
                 {activeKeysCount}/{keys.length} Healthy
               </span>
             </p>
           </div>
           <div className="flex gap-3">
              {errorCount > 0 && (
                  <button 
                    type="button"
                    onClick={handleRetryFailed}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all font-semibold border border-red-500/20 text-sm flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    Retry Failed ({errorCount})
                  </button>
              )}

              <button 
                id="save-btn"
                type="button"
                onClick={handleSaveProject}
                disabled={items.length === 0}
                title="Save Project (Ctrl+S / Cmd+S)"
                className="px-4 py-2 bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-400 rounded-lg transition-all font-semibold border border-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Project
              </button>
              
              <button
                onClick={() => setIsProcessing(!isProcessing)}
                disabled={items.length === 0}
                title={isProcessing ? 'Stop Processing (Ctrl+Enter / Cmd+Enter)' : 'Start Processing (Ctrl+Enter / Cmd+Enter)'}
                className={`px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                    isProcessing 
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-orange-900/30' 
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-blue-900/30 hover:shadow-blue-900/50'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isProcessing ? 'Stop' : 'Start'} Processing
              </button>
              <button 
                type="button"
                onClick={handleClear}
                title="Clear All Items (Ctrl+Backspace / Cmd+Backspace)"
                className="px-4 py-2 bg-slate-800/50 hover:bg-red-900/20 text-slate-300 hover:text-red-400 rounded-lg transition-colors font-semibold border border-white/5 text-sm"
              >
                Clear All
              </button>
              <button 
                type="button"
                onClick={handleExport}
                disabled={!hasPartialData && !allDone}
                title="Export CSV (Ctrl+E / Cmd+E)"
                className={`px-4 py-2 text-white rounded-lg transition-all font-bold text-sm flex items-center gap-2
                  ${allDone 
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transform hover:-translate-y-0.5' 
                      : hasPartialData
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] transform hover:-translate-y-0.5'
                      : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}
              >
                {allDone ? 'Export CSV' : hasPartialData ? `Export Partial (${doneCount})` : 'Waiting...'}
              </button>
           </div>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth space-y-8"
          id="main-scroll-area"
          onWheel={() => lastUserScrollRef.current = Date.now()}
          onTouchMove={() => lastUserScrollRef.current = Date.now()}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleAddFiles(e.dataTransfer.files);
          }}
        >
             <div 
                  className="group relative border-2 border-dashed border-slate-800 bg-slate-900/20 hover:bg-slate-900/40 hover:border-purple-500/30 transition-all duration-300 rounded-3xl p-8 text-center cursor-pointer overflow-hidden min-h-[200px] flex flex-col items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('fileInput')?.click();
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <input id="fileInput" type="file" multiple accept="image/*,.eps,.svg" className="hidden" onChange={(e) => handleAddFiles(e.target.files)} />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="p-4 bg-slate-800 rounded-full text-purple-400 shadow-xl group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/10">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-slate-200">Upload Images</p>
                      <p className="text-sm text-slate-500">JPG, PNG, WEBP, SVG, EPS</p>
                    </div>
                  </div>
                </div>

                <ProcessingQueue 
                  items={items} 
                  itemRefs={itemRefs}
                  onRemove={removeItem}
                  onUpdate={updateItem}
                  onRegenerate={handleRegenerate}
                  onCopy={handleCopy}
                  forceTransparency={config.forceTransparency || false}
                />
        </div>

        <div className="text-center py-4 text-xs text-slate-500 border-t border-white/5 bg-slate-950/50 backdrop-blur-md shrink-0">
           All rights reserved. Developed and maintained by Shahin Alam Emon.
        </div>

        <div className="absolute bottom-12 right-8 z-50 animate-in slide-in-from-bottom-5 fade-in pointer-events-none">
            <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 bg-slate-900/90 backdrop-blur-xl">
                <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-slate-500'}`}></div>
                <span className="text-base font-medium text-slate-100 font-mono tracking-tight shadow-black drop-shadow-sm">{statusMsg}</span>
            </div>
        </div>
      </main>

      {/* Global Toast Notifications Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className="pointer-events-auto bg-slate-800 border border-white/10 shadow-2xl rounded-xl p-4 min-w-[300px] flex items-start gap-3 transform transition-all animate-in slide-in-from-right-8 fade-in"
          >
            <div className="text-purple-400 mt-0.5 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-100">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
