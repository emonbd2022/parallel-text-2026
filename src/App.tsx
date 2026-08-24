import React, { useState, useEffect, useRef } from 'react';
import { ApiKey, ProcessingItem, ProcessingConfig, HistoryRecord, ProcessingLog } from './types';
import { ProcessingQueue } from './components/ProcessingQueue';
import { Sidebar } from './components/Sidebar';
import { StatisticsModal } from './components/StatisticsModal';
import { compressImage } from './services/imageUtils';
import { generateMetadataBatch } from './services/geminiService';
import { generateCategoriesBatch } from './services/geminiCategoryService';
import { saveProject, loadProject, clearProject } from './services/projectStorage';
import { Clock, Key, Hourglass, Cat, Layers, Upload, Maximize, Minimize, ArrowUp, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './contexts/AuthContext';
import { db } from './lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { syncLocalKeysToServer } from './utils/keySync';
import { fetchCentralKeysFromFirestore } from './services/centralKeyService';


// Persistence Keys
const STORAGE_KEYS = 'parrarel_keys_v5'; 
const STORAGE_HISTORY = 'parrarel_history_v3';
const STORAGE_LOGS = 'parrarel_logs_v1';
const STORAGE_CONFIG = 'parrarel_config_v3';

// Models
const MODELS = [
  { id: 'turbo', name: 'Turbo', rpm: 5 },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (20 RPD)', rpm: 5 },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (20 RPD)', rpm: 5 },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (20 RPD)', rpm: 5 },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (500 RPD)', rpm: 15 },
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


const getCategoryId = (categoryName?: string) => {
    if (!categoryName) return '';
    const map: Record<string, string> = {
        "animals": "1",
        "buildings and architecture": "2",
        "business": "3",
        "drinks": "4",
        "the environment": "5",
        "states of mind": "6",
        "food": "7",
        "graphic resources": "8",
        "hobbies and leisure": "9",
        "industry": "10",
        "landscapes": "11",
        "lifestyle": "12",
        "people": "13",
        "plants and flowers": "14",
        "culture and religion": "15",
        "science": "16",
        "social issues": "17",
        "sports": "18",
        "technology": "19",
        "transport": "20",
        "travel": "21"
    };
    return map[categoryName.trim().toLowerCase()] || categoryName;
};

import { useNavigate } from 'react-router-dom';

export default function App() {
  const { userData, setUserData } = useAuth();
  const navigate = useNavigate();
  // --- State ---
  const [toasts, setToasts] = useState<Toast[]>([]);

    const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed' | 'uncompleted' | 'failed'>('all');
    const [localKeys, setLocalKeys] = useState<ApiKey[]>(() => {
    try {
      const loaded = JSON.parse(localStorage.getItem(STORAGE_KEYS) || '[]');
      const currentSession = getUsageSessionId();
      
      // Migration: Add usage if missing or reset if new session
      return loaded.map((k: any) => {
        let usage = k.usage || { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 };
        if (usage.date !== currentSession) {
            usage = { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 };
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

  const [centralKeys, setCentralKeys] = useState<ApiKey[]>([]);

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

  // Items are loaded from localStorage / IndexedDB
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStats, setExportStats] = useState({ count: 0, path: '', elapsedTime: '0s', requestCount: 0, timeSaved: '0s' });
  const sessionRequestCountRef = useRef(parseInt(localStorage.getItem('sessionReqCount') || '0'));
  const schedulerRunningRef = useRef(false);
  const scheduleAgainRef = useRef(false);
  const taskClaimLockRef = useRef<Set<string>>(new Set());
  const keyClaimLockRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const idx = setInterval(() => localStorage.setItem('sessionReqCount', sessionRequestCountRef.current.toString()), 5000);
    return () => clearInterval(idx);
  }, []);

  const [items, setItems] = useState<ProcessingItem[]>([]);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);



  const turboTitleStatsRef = useRef<Record<string, { latencies: number[], fails: number, lastFailTime: number }>>({});
  const turboCategoryStatsRef = useRef<Record<string, { latencies: number[], fails: number, lastFailTime: number }>>({});

  const getBestTurboModel = (statsRef: React.MutableRefObject<Record<string, { latencies: number[], fails: number, lastFailTime: number }>>) => {
      const models = [
          'gemini-3.5-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite'
      ];
      let bestModel = models[0];
      let bestScore = Infinity;
      const now = Date.now();

      for (const m of models) {
          const stat = statsRef.current[m];
          let score = 10000;
          if (stat) {
              const lats = stat.latencies;
              const recent = lats.slice(-5);
              const avgLat = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 10000;
              
              let failPenalty = 0;
              if (stat.fails > 0) {
                  const timeSinceFail = now - stat.lastFailTime;
                  if (timeSinceFail < 60000) failPenalty = 50000;
                  else if (timeSinceFail < 300000) failPenalty = 10000;
                  else stat.fails = 0;
              }
              score = avgLat + failPenalty;
          } else {
              if (m.includes('lite')) score = 5000;
              else score = 8000;
          }
          if (score < bestScore) {
              bestScore = score;
              bestModel = m;
          }
      }
      return bestModel;
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('Ready');
  const [tick, setTick] = useState(0); 
  const [etaEndTime, setEtaEndTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [showToTop, setShowToTop] = useState(false);
  const [isFullscreenBatchView, setIsFullscreenBatchView] = useState(false);
  
  const fullScreenScrollRef = useRef<HTMLDivElement>(null);
  
  const scrollToTop = () => {
    if (isFullscreenBatchView && fullScreenScrollRef.current) {
      fullScreenScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 300) {
      setShowToTop(true);
    } else {
      setShowToTop(false);
    }
  };

  useEffect(() => {
    setShowToTop(false);
  }, [isFullscreenBatchView]);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isProcessing) {
      interval = setInterval(() => {
        setElapsedMs(prev => prev + 1000);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);
  const [showStats, setShowStats] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle batch fullscreen with Shift + F, but ignore if typing in an input
      if (e.shiftKey && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          setIsFullscreenBatchView(prev => !prev);
        }
      }
      
      // Close with Escape
      if (isFullscreenBatchView && e.key === 'Escape') {
        setIsFullscreenBatchView(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    if (isFullscreenBatchView) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreenBatchView]);
  
  const [config, setConfig] = useState<ProcessingConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG);
      if (saved) {
          const parsed = JSON.parse(saved);
          if (!parsed.migratedTo31LiteDefaultV4) {
            parsed.model = 'gemini-3.1-flash-lite-preview';
            parsed.titleMaxLen = 180;
            parsed.autoExport = true;
            parsed.autoScroll = true;
            parsed.prioritizeFastest = true;
            parsed.migratedTo31LiteDefaultV4 = true;
          }
          return { 
            ...parsed, 
            batchSize: parsed.batchSize || 1, 
            model: parsed.model || 'gemini-3.1-flash-lite-preview',
            titleMaxLen: parsed.titleMaxLen ?? 180,
            autoExport: parsed.autoExport ?? true,
            autoScroll: parsed.autoScroll ?? true,
            prioritizeFastest: parsed.prioritizeFastest ?? true,
          };
      }
    } catch (e) { /* ignore */ }
    
    return {
      apiMode: 'local',
      concurrency: 1, 
      batchSize: 1, 
      maxRetries: 3,
      titleMaxLen: 180,
      keywordsCount: 40,
      model: 'gemini-3.1-flash-lite-preview', 
      titlePrefix: '',
      titleSuffix: '',
      negativeTitleWords: '',
      negativeKeywords: '',
      targetExtension: '',
      forceTransparency: false,
      autoExport: true,
      autoScroll: true,
      prioritizeFastest: true,
      migratedTo31LiteDefaultV4: true
    };
  });

  const keys = config.apiMode === 'central' ? centralKeys : localKeys;

  const setKeys = (action: React.SetStateAction<ApiKey[]>) => {
      if (config.apiMode === 'central') {
          setCentralKeys(action);
      } else {
          setLocalKeys(action);
      }
  };

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
  const lastPhaseRef = useRef<'metadata' | 'category' | null>(null);
  // Persist State locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS, JSON.stringify(localKeys));
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
  }, [localKeys, config]);

  // Sync on login / user session change - writes ONLY new differing keys (0 writes if already synced)
  useEffect(() => {
    if (userData?.uid && localKeys.length > 0) {
      syncLocalKeysToServer(localKeys, false, userData.uid, userData.email).catch(() => {});
    }
  }, [userData?.uid, userData?.email]);

  // 1-Read Central API Keys Pool Fetch (In-memory ONLY, never persisted to localStorage)
  const fetchCentralKeysPool = async (): Promise<ApiKey[]> => {
    // 1. Fetch from Firestore (Direct 1-read connection that works on Vercel, Netlify, and production domains)
    try {
      const fsKeys = await fetchCentralKeysFromFirestore();
      const validFsKeys = fsKeys.filter(
        k => k.enabled !== false && k.key && !k.key.startsWith('central-') && k.key.trim().length > 5
      );

      if (validFsKeys.length > 0) {
        const currentSession = getUsageSessionId();
        const pool: ApiKey[] = validFsKeys.map((k, idx) => ({
          id: k.id || `central-${idx}`,
          label: k.label || `Central Pool Node ${idx + 1}`,
          key: k.key.trim(), // Stored ONLY in React memory state, NEVER in localStorage
          errorCount: 0,
          usage: { date: currentSession, flash: 0, lite: 0, pro: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_6: 0, flash_3_7: 0 }
        }));
        setCentralKeys(pool);
        return pool;
      }
    } catch (e) {
      console.warn("Firestore central keys pool fetch notice:", e);
    }

    // 2. Server endpoint fallback (when running with backend API / dev environment)
    try {
      const res = await fetch('/api/central-keys-pool');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && Array.isArray(data.keys) && data.keys.length > 0) {
            const currentSession = getUsageSessionId();
            const pool: ApiKey[] = data.keys.map((k: any, idx: number) => ({
              id: k.id || `central-${idx}`,
              label: k.label || `Central Pool Node ${idx + 1}`,
              key: k.key, // Strictly kept in RAM state - NEVER saved to localStorage
              errorCount: 0,
              usage: { date: currentSession, flash: 0, lite: 0, pro: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_6: 0, flash_3_7: 0 }
            }));
            setCentralKeys(pool);
            return pool;
          }
        }
      }
    } catch (e) {
      console.warn("Central keys pool server fetch notice:", e);
    }
    return [];
  };

  // Fetch central keys pool whenever Central API mode is active
  useEffect(() => {
    if (config.apiMode === 'central') {
      fetchCentralKeysPool();
    }
  }, [config.apiMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
  }, [logs]);

            
  // Auto-save items safely via IndexedDB and localStorage
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!isProjectLoaded) return;
    
    // Clear project if explicitly emptied
    if (items.length === 0) {
        clearProject().catch(() => {});
        return;
    }

    const timer = setTimeout(() => {
        saveProject(items).then(() => {
            setLastAutoSave(new Date());
        }).catch(e => {
            console.warn("Auto-save failed", e);
        });
    }, 1000); // 1-second responsive debounce to ensure immediate metadata persistence
    
    return () => clearTimeout(timer);
  }, [items, isProjectLoaded]);

  // Ensure items are immediately flushed to cache on page close or reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (itemsRef.current.length > 0) {
        saveProject(itemsRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);
  
  // Session Reset Check Timer
  useEffect(() => {
    const checkDate = setInterval(() => {
        const currentSession = getUsageSessionId();
        setKeys(prev => prev.map(k => {
            // Check if usage exists, if not or date mismatch, reset
            if (!k.usage || k.usage.date !== currentSession) {
                return { ...k, usage: { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 } };
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
      } finally {
        setIsProjectLoaded(true);
      }
    };
    initProject();
  }, []);

  const lastUserScrollRef = useRef(0);

  // Auto-scroll to processing item
  useEffect(() => {
    if (!isProcessing || config.autoScroll === false) return;
    if (Date.now() - lastUserScrollRef.current < 2000) return;

    const activeItem = items.find(i => i.status === 'processing');
    if (activeItem && itemRefs.current[activeItem.id]) {
      setTimeout(() => {
        if (Date.now() - lastUserScrollRef.current < 2000) return;
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
    
    const newItems: ProcessingItem[] = [];
    for (const f of Array.from(files)) {
      if ((f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.eps') || f.name.toLowerCase().endsWith('.svg')) && !existingNames.has(f.name)) {
        existingNames.add(f.name);
        newItems.push({
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
      });
      }
    }

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

  const updateItem = (id: string, field: 'title' | 'keywords' | 'category', value: string) => {
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
                      usage: { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 } 
                  };
              }
              return k;
          }));
      }
  };

  const handleResetAllUsage = () => {
      if (window.confirm('Are you sure you want to manually reset usage counts, errors, and cooldowns for ALL keys?')) {
          const currentSession = getUsageSessionId();
          setKeys(prev => prev.map(k => ({
              ...k,
              errorCount: 0,
              cooldownUntil: undefined,
              usage: { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 }
          })));
      }
  };

  const handleCopy = (item: ProcessingItem) => {
    const safeName = `"${item.name.replace(/"/g, '""')}"`;
    const safeTitle = `"${item.title.replace(/"/g, '""')}"`;
    const safeKeys = `"${item.keywords.replace(/"/g, '""')}"`;
    const safeCategory = `"${getCategoryId(item.category).replace(/"/g, '""')}"`;
    const row = `${safeName},${safeTitle},${safeKeys},${safeCategory}`;
    navigator.clipboard.writeText(row);
  };

  // --- Processing Engine (Batch Enabled) ---

  const getModelDelay = (modelId: string) => {
    if (modelId === 'turbo') return 12500;
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return 12000;
    return (60000 / model.rpm) + 500;
  };

  
  const startCategoryBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {
    // 0. ATOMIC CLAIM CHECK
    const validBatch: ProcessingItem[] = [];
    for (const item of batchItems) {
        if (!taskClaimLockRef.current.has(item.id)) {
            taskClaimLockRef.current.add(item.id);
            validBatch.push(item);
        }
    }
    if (validBatch.length === 0) return;
    if (keyClaimLockRef.current.has(keyObj.id)) return;
    keyClaimLockRef.current.add(keyObj.id);

    // 1. Mark all as processing
    setItems(prev => prev.map(p => validBatch.find(b => b.id === p.id) ? { 
      ...p, 
      status: 'processing', 
      assignedKeyId: keyObj.id 
    } : p));

    setStatusMsg(`Fetching categories for ${batchItems.length} items (${keyObj.label})...`);
    const batchStartTime = Date.now();

    try {
      const payload = batchItems.map(item => ({ id: item.id, title: item.title }));
      let results: any;
      let usedModel = config.model;

      if (config.model === 'turbo') {
        usedModel = getBestTurboModel(turboCategoryStatsRef);
        const startTime = Date.now();
        try {
            sessionRequestCountRef.current += 1;
            results = await generateCategoriesBatch(
              keyObj.key,
              payload,
              usedModel,
              (msg) => {
                setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { ...p, progressMsg: msg } : p));
              }
            );
            const elapsed = Date.now() - startTime;
            if (!turboCategoryStatsRef.current[usedModel]) {
                turboCategoryStatsRef.current[usedModel] = { latencies: [], fails: 0, lastFailTime: 0 };
            }
            turboCategoryStatsRef.current[usedModel].latencies.push(elapsed);
        } catch (err) {
            if (!turboCategoryStatsRef.current[usedModel]) {
                turboCategoryStatsRef.current[usedModel] = { latencies: [], fails: 0, lastFailTime: 0 };
            }
            turboCategoryStatsRef.current[usedModel].fails += 1;
            turboCategoryStatsRef.current[usedModel].lastFailTime = Date.now();
            throw err;
        }
      } else {
        sessionRequestCountRef.current += 1;
        results = await generateCategoriesBatch(
            keyObj.key, 
            payload, 
            config.model,
            (msg) => {
              setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { ...p, progressMsg: msg } : p));
            }
        );
      }

      setItems(prev => prev.map(p => {
          if (results && results[p.id]) {
              return { 
                 ...p, 
                 status: 'done', 
                 category: results[p.id].category,
                 assignedKeyId: undefined,
                 retryAfter: undefined,
                 failedKeyIds: []
              };
          }
          return p;
      }));
      
      const cooldownMs = getModelDelay(config.model);
      
      setKeys(prev => prev.map(k => {
        if (k.id === keyObj.id) {
            const currentSession = getUsageSessionId();
            const newUsage = { ...(k.usage || { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 }) };
            
            if (newUsage.date !== currentSession) {
                newUsage.date = currentSession;
                newUsage.flash = 0;
                newUsage.lite = 0;
                newUsage.flash_3 = 0;
                newUsage.flash_3_1_lite = 0;
                newUsage.flash_3_5 = 0;
                newUsage.flash_3_5_lite = 0;
                newUsage.flash_3_7 = 0;
                newUsage.flash_3_6 = 0;
            }

            if (usedModel === 'gemini-3.7-flash') newUsage.flash_3_7 = (newUsage.flash_3_7 || 0) + 1;
            else if (usedModel === 'gemini-3.6-flash') newUsage.flash_3_6 = (newUsage.flash_3_6 || 0) + 1;
            else if (usedModel === 'gemini-3.5-flash-lite') newUsage.flash_3_5_lite = (newUsage.flash_3_5_lite || 0) + 1;
            else if (usedModel.includes('gemini-3.5-flash')) newUsage.flash_3_5 = (newUsage.flash_3_5 || 0) + 1;
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
      setStatusMsg("Pipeline active...");

    } catch (error: any) {
      console.error("Batch processing error:", error);
      
      // Error handling similar to startBatchProcessing
      const errorMessage = error.message || "Unknown error";
      const isQuota = errorMessage.includes('QUOTA_EXCEEDED');
      const isInvalid = errorMessage.includes('INVALID_KEY');
      
      const cooldownMs = isQuota ? 3600000 : (isInvalid ? 86400000 : 30000); 

      setKeys(prev => prev.map(k => {
          if (k.id === keyObj.id) {
              return { 
                  ...k, 
                  errorCount: k.errorCount + 1,
                  cooldownUntil: Date.now() + cooldownMs
              };
          }
          return k;
      }));

      setItems(prev => {
        const activeKeys = keys.filter(k => k.errorCount < 20);
        return prev.map(p => {
            if (batchItems.find(b => b.id === p.id)) {
                const newFailedKeys = [...(p.failedKeyIds || []), keyObj.id];
                const allKeysExhausted = activeKeys.every(k => newFailedKeys.includes(k.id));
                const backoffDelay = Math.min(2000 * Math.pow(2, p.attempts), 120000);
                
                if (allKeysExhausted && activeKeys.length > 0) {
                     return {
                          ...p,
                          status: 'pending',
                          errorMsg: errorMessage,
                          progressMsg: undefined,
                          assignedKeyId: undefined,
                          failedKeyIds: [],
                          attempts: p.attempts + 1,
                          retryAfter: Date.now() + Math.max(backoffDelay, 30000)
                     };
                } else {
                     return {
                          ...p,
                          status: 'pending',
                          errorMsg: errorMessage,
                          progressMsg: undefined,
                          assignedKeyId: undefined,
                          failedKeyIds: newFailedKeys,
                          attempts: p.attempts + 1,
                          retryAfter: Date.now() + backoffDelay
                     };
                }
            }
            return p;
        });
      });
      
      setStatusMsg(`Error: ${errorMessage.substring(0, 40)}`);
    } finally {
        keyClaimLockRef.current.delete(keyObj.id);
        for (const item of validBatch) taskClaimLockRef.current.delete(item.id);
    }
  };
const startBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {
    // 0. ATOMIC CLAIM CHECK
    const validBatch: ProcessingItem[] = [];
    for (const item of batchItems) {
        if (!taskClaimLockRef.current.has(item.id)) {
            taskClaimLockRef.current.add(item.id);
            validBatch.push(item);
        }
    }
    if (validBatch.length === 0) return;
    if (keyClaimLockRef.current.has(keyObj.id)) return;
    keyClaimLockRef.current.add(keyObj.id);

    // 1. Mark all as processing
    setItems(prev => prev.map(p => validBatch.find(b => b.id === p.id) ? { 
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

      if (config.model === 'turbo') {
        usedModel = getBestTurboModel(turboTitleStatsRef);
        const startTime = Date.now();
        try {
            sessionRequestCountRef.current += 2;
            results = await generateMetadataBatch(
              keyObj.key,
              payload,
              { ...config, model: usedModel },
              (msg) => {
                setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { ...p, progressMsg: msg } : p));
              }
            );
            const elapsed = Date.now() - startTime;
            if (!turboTitleStatsRef.current[usedModel]) {
                turboTitleStatsRef.current[usedModel] = { latencies: [], fails: 0, lastFailTime: 0 };
            }
            turboTitleStatsRef.current[usedModel].latencies.push(elapsed);
        } catch (err) {
            if (!turboTitleStatsRef.current[usedModel]) {
                turboTitleStatsRef.current[usedModel] = { latencies: [], fails: 0, lastFailTime: 0 };
            }
            turboTitleStatsRef.current[usedModel].fails += 1;
            turboTitleStatsRef.current[usedModel].lastFailTime = Date.now();
            throw err;
        }
      } else {
        const startTime = Date.now();
        sessionRequestCountRef.current += 2;
        results = await generateMetadataBatch(
            keyObj.key, 
            payload, 
            config,
            (msg) => {
              setItems(prev => prev.map(p => batchItems.find(b => b.id === p.id) ? { ...p, progressMsg: msg } : p));
            }
        );
        
      }



            setItems(prev => prev.map(p => {
          if (results[p.id]) {
              return { 
                 ...p, 
                 status: 'pending', // Pending for category phase
                 title: results[p.id].title, 
                 keywords: results[p.id].keywords,
                 category: '',
                 assignedKeyId: undefined,
                 metadataKeyId: keyObj.id,
                 retryAfter: undefined,
                 failedKeyIds: [],
                 usedModel: usedModel,
                 attempts: 0
              };
          }
          return p;
      }));
      
      const cooldownMs = getModelDelay(config.model);
      
      setKeys(prev => prev.map(k => {
        if (k.id === keyObj.id) {
            const currentSession = getUsageSessionId();
            const newUsage = { ...(k.usage || { date: currentSession, flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 }) };
            
            // Ensure usage date is current session before incrementing
            if (newUsage.date !== currentSession) {
                newUsage.date = currentSession;
                newUsage.flash = 0;
                newUsage.lite = 0;
                newUsage.flash_3 = 0;
                newUsage.flash_3_1_lite = 0;
                newUsage.flash_3_5 = 0;
                newUsage.flash_3_5_lite = 0;
                newUsage.flash_3_7 = 0;
                newUsage.flash_3_6 = 0;
            }

            if (usedModel === 'gemini-3.7-flash') newUsage.flash_3_7 = (newUsage.flash_3_7 || 0) + 1;
            else if (usedModel === 'gemini-3.6-flash') newUsage.flash_3_6 = (newUsage.flash_3_6 || 0) + 1;
            else if (usedModel === 'gemini-3.5-flash-lite') newUsage.flash_3_5_lite = (newUsage.flash_3_5_lite || 0) + 1;
            else if (usedModel.includes('gemini-3.5-flash')) newUsage.flash_3_5 = (newUsage.flash_3_5 || 0) + 1;
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
      setLogs(prev => [newLog, ...prev].slice(0, 5000));

    } catch (error: any) {
      console.warn(`Key ${keyObj.label} failed for batch:`, error);
      
      const errMsg = error.message || "";
      let cooldownTime = 0;
      let errorPenalty = 1;
      const errorMsgText = (typeof error !== 'undefined' ? error.message : "") || "";

      if (errorMsgText.includes('INVALID_KEY')) {
        errorPenalty = 20; // Kill invalid keys immediately
      } else if (errorMsgText.includes('QUOTA_EXCEEDED') || errorMsgText.includes('429')) {
        if (errorMsgText.toLowerCase().includes('billing') || errorMsgText.toLowerCase().includes('plan')) {
            // Daily or hard quota
            cooldownTime = 24 * 60 * 60 * 1000; // 24 hours
            errorPenalty = 10;
        } else {
            // RPM or TPM limit
            cooldownTime = 60 * 1000; // 1 minute
            errorPenalty = 0; // Do not penalize for temporary rate limits
        }
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
                const backoffDelay = Math.min(2000 * Math.pow(2, p.attempts), 120000); // Exponential backoff up to 2 mins
                if (allKeysExhausted && activeKeys.length > 0) {
                     return {
                          ...p,
                          status: 'pending',
                          assignedKeyId: undefined,
                          failedKeyIds: [], // Auto retry by resetting failed keys
                          attempts: p.attempts + 1,
                          retryAfter: Date.now() + Math.max(backoffDelay, 30000) // At least 30s backoff if all keys failed
                     };
                } else {
                     return {
                          ...p,
                          status: 'pending',
                          assignedKeyId: undefined,
                          failedKeyIds: newFailedKeys,
                         attempts: p.attempts + 1,
                         retryAfter: Date.now() + backoffDelay 
                     };
                }
            }
            return p;
        });
      });
      setStatusMsg(cooldownTime > 0 ? `Rate limit hit. Cooling down...` : `Batch failed. Rotating keys...`);
    } finally {
        keyClaimLockRef.current.delete(keyObj.id);
        for (const item of validBatch) taskClaimLockRef.current.delete(item.id);
    }
  };

  const handleExport = () => {
    const completedItems = items.filter(i => i.status === 'done');
    if (completedItems.length === 0) return;

    const headers = ['Filename', 'Title', 'Keywords', 'Category'];
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
      const safeCategory = `"${getCategoryId(i.category).replace(/"/g, '""')}"`;
      return `${safeName},${safeTitle},${safeKeys},${safeCategory}`;
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStrFormat = dateObj.toTimeString().split(' ')[0].replace(/:/g, '-');
    let exportFileName = `${items.length}.csv`;
    if (config.exportFilenameTemplate) {
        exportFileName = config.exportFilenameTemplate
            .replace('{count}', items.length.toString())
            .replace('{date}', dateStr)
            .replace('{time}', timeStrFormat);
        if (!exportFileName.toLowerCase().endsWith('.csv')) exportFileName += '.csv';
    }
    
    link.setAttribute('download', exportFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Local-First: Persist only minimal credits & totalProcessedImages on CSV export
    if (userData) {
      const newlyExportedItems = completedItems.filter(i => !(i as any).exported);
      const numExported = newlyExportedItems.length;
      
      if (numExported > 0) {
          const updates: any = {
              totalProcessedImages: increment(numExported)
          };
          if (!userData.unlimited) {
              updates.credits = increment(-numExported);
          }
          
          // Single atomic updateDoc on users document only
          const userRef = doc(db, 'users', userData.uid);
          updateDoc(userRef, updates).catch(e => console.error("Failed to update user credits/totals:", e));
          
          // Local Activity Summary saved exclusively in localStorage
          const dateObj = new Date();
          const pad = (n: number) => n < 10 ? '0' + n : n;
          const dateStr = dateObj.getFullYear() + '-' + pad(dateObj.getMonth() + 1) + '-' + pad(dateObj.getDate());
          
          let summary = JSON.parse(localStorage.getItem('userActivitySummary') || '{"totalProcessed":0,"daily":{}}');
          summary.totalProcessed += numExported;
          summary.daily[dateStr] = (summary.daily[dateStr] || 0) + numExported;
          localStorage.setItem('userActivitySummary', JSON.stringify(summary));
          
          setUserData(prev => prev ? {
              ...prev,
              totalProcessedImages: prev.totalProcessedImages + numExported,
              credits: prev.unlimited ? prev.credits : (prev.credits - numExported)
          } : null);
          
          // Mark items as exported locally to prevent duplicate writes
          setItems(prev => prev.map(i => i.status === 'done' ? { ...i, exported: true } : i));
      }
    }

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
        
        setStatusMsg("Export complete! CSV file has been downloaded. All items cleared.");
    } else {
        setStatusMsg(`Exported partial CSV with ${completedItems.length} items.`);
    }
    const totalRequests = completedItems.length * 2;
    sessionRequestCountRef.current = 0; // Reset for next session
    localStorage.setItem('sessionReqCount', '0');
    
    let timeStr = '0s';
    
    {
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
    
    setExportStats({ count: completedItems.length, path: exportFileName, elapsedTime: timeStr, requestCount: totalRequests, timeSaved: '' });
    setShowExportModal(true);
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

    if (schedulerRunningRef.current) {
        scheduleAgainRef.current = true;
        return;
    }
    schedulerRunningRef.current = true;
    scheduleAgainRef.current = false;
    
    try {
    if (userData && !userData.unlimited && userData.credits <= 0) {
        setIsProcessing(false);
        setStatusMsg('Processing stopped. Insufficient credits.');
        showNotification('Insufficient Credits', 'Please purchase more credits to continue processing.');
        return;
    }

    const now = Date.now();
    const currentSession = getUsageSessionId();

    // 1. Calculate active key assignments across all items
    const activeKeyIds = new Set<string>(
        items.filter(i => (i.status === 'processing' || i.status === 'compressing') && !!i.assignedKeyId).map(i => i.assignedKeyId!)
    );
    // Track keys that are busy or dispatched during this tick
    const busyKeyIds = new Set<string>(Array.from(activeKeyIds));

    // 2. Identify Pending Items for both stages concurrently
    // Stage 1 (Title/Keywords): items pending with thumbnail that have no title yet
    const pendingTitleItems = items.filter(i => i.status === 'pending' && !i.title && i.thumb);
    // Stage 2 (Category): items pending that HAVE title/keywords but NO category yet
    const pendingCategoryItems = items.filter(i => i.status === 'pending' && i.title && !i.category);

    const isProcessingTitle = items.some(i => (i.status === 'processing' || i.status === 'compressing') && !i.title);
    const isProcessingCategory = items.some(i => i.status === 'processing' && i.title && !i.category);

    // If both queues are empty
    if (pendingTitleItems.length === 0 && pendingCategoryItems.length === 0) {
        if (!isProcessingTitle && !isProcessingCategory) {
            setIsProcessing(false);
            const allDone = items.length > 0 && items.every(i => i.status === 'done');
            if (allDone) {
                setStatusMsg('Processing complete.');
                playSuccessSound();
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#a855f7', '#d946ef', '#10b981', '#3b82f6', '#f59e0b']
                });
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
            const titleCount = items.filter(i => (i.status === 'processing' || i.status === 'compressing') && !i.title).length;
            const catCount = items.filter(i => i.status === 'processing' && i.title && !i.category).length;
            if (titleCount > 0 && catCount > 0) {
                setStatusMsg(`Pipeline active: ${titleCount} generating Title/Keywords, ${catCount} generating Category...`);
            } else if (titleCount > 0) {
                setStatusMsg(`Generating Title/Keywords for ${titleCount} items...`);
            } else if (catCount > 0) {
                setStatusMsg(`Generating Categories for ${catCount} items...`);
            }
        }
        return;
    }

    // 3. Validate API keys and session limits
    const validKeys = keys.filter(k => {
        const usage = (k.usage && k.usage.date === currentSession) ? k.usage : { flash: 0, lite: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_7: 0, flash_3_6: 0 };
        
        const u = {
            flash: Number(usage.flash || 0),
            lite: Number(usage.lite || 0),
            flash_3: Number(usage.flash_3 || 0),
            flash_3_1_lite: Number(usage.flash_3_1_lite || 0),
            flash_3_5: Number(usage.flash_3_5 || 0),
            flash_3_5_lite: Number(usage.flash_3_5_lite || 0),
            flash_3_6: Number(usage.flash_3_6 || 0),
            flash_3_7: Number(usage.flash_3_7 || 0)
        };

        if (config.model === 'turbo') {
            return (u.flash_3_7 < 10000) || (u.flash_3_6 < 10000) || (u.flash_3_5_lite < 10000) || (u.flash_3_5 < 10000) || (u.flash_3 < 10000) || (u.flash < 10000) || (u.flash_3_1_lite < 10000) || (u.lite < 20);
        } else if (config.model === 'gemini-3.7-flash') {
            return u.flash_3_7 < 10000;
        } else if (config.model === 'gemini-3.6-flash') {
            return u.flash_3_6 < 10000;
        } else if (config.model === 'gemini-3.5-flash-lite') {
            return u.flash_3_5_lite < 10000;
        } else if (config.model.includes('gemini-3.5-flash')) {
            return u.flash_3_5 < 10000;
        } else if (config.model.includes('gemini-3.1-flash-lite-preview')) {
            return u.flash_3_1_lite < 10000;
        } else if (config.model.includes('gemini-2.5-flash-lite')) {
            return u.lite < 20;
        } else if (config.model.includes('gemini-2.5-flash')) {
            return u.flash < 10000;
        } else if (config.model.includes('gemini-3-flash-preview')) {
            return u.flash_3 < 10000;
        }
        return true;
    });
    
    if (validKeys.length === 0) {
        const totalKeys = keys.length;
        if (totalKeys > 0) {
            setStatusMsg("All keys have high error counts or hit safety limits.");
            setIsProcessing(false);
        } else if (config.apiMode === 'central') {
            setStatusMsg("Connecting to Central API pool...");
            fetchCentralKeysPool().then(pool => {
                if (!pool || pool.length === 0) {
                    setStatusMsg("No Central API keys available in the central pool. Please add an API key.");
                    setIsProcessing(false);
                }
            }).catch(() => {
                setStatusMsg("Could not connect to Central API pool. Please check your internet connection.");
                setIsProcessing(false);
            });
        } else {
            setStatusMsg("No API keys configured.");
            setIsProcessing(false);
        }
        return;
    }

    // Sort queue items if prioritizeFastest is on
    if (config.prioritizeFastest) {
        let totalMs = 0;
        logs.forEach(l => totalMs += l.durationMs);
        let totalDoneBytes = 0;
        items.forEach(i => {
            if (i.status === 'done') totalDoneBytes += i.size;
        });
        const msPerByte = (totalDoneBytes > 0 && totalMs > 0) ? (totalMs / totalDoneBytes) : 1;
        pendingTitleItems.sort((a, b) => (a.size * msPerByte) - (b.size * msPerByte));
        pendingCategoryItems.sort((a, b) => (a.size * msPerByte) - (b.size * msPerByte));
    }

    // 4. GLOBAL WORK QUEUE & BIDIRECTIONAL FALLBACK
    const batchSize = config.batchSize || 1;
    const titleQueue = [...pendingTitleItems].sort((a, b) => a.attempts - b.attempts);
    const categoryQueue = [...pendingCategoryItems].sort((a, b) => a.attempts - b.attempts);

    const titlePoolSize = keys.length > 1 ? Math.ceil(keys.length / 2) : keys.length;
    const titleKeyIds = new Set(keys.slice(0, titlePoolSize).map(k => k.id));

    // Sort valid keys by health (least errors first)
    validKeys.sort((a, b) => Math.max(0, 100 - (b.errorCount * 5)) - Math.max(0, 100 - (a.errorCount * 5)));

    const getBatch = (queue: ProcessingItem[], keyObj: ApiKey): ProcessingItem[] => {
        const batch: ProcessingItem[] = [];
        let itemIndex = 0;
        while (batch.length < batchSize && itemIndex < queue.length) {
            const candidate = queue[itemIndex];
            if (candidate.retryAfter && candidate.retryAfter > now) {
                itemIndex++;
                continue;
            }
            if (!candidate.failedKeyIds.includes(keyObj.id)) {
                batch.push(candidate);
                queue.splice(itemIndex, 1);
            } else {
                itemIndex++;
            }
        }
        return batch;
    };

    // 5. DISPATCH LOOP (MAXIMUM UTILIZATION)
    for (const keyObj of validKeys) {
        if (busyKeyIds.has(keyObj.id)) continue;
        if (keyObj.cooldownUntil && keyObj.cooldownUntil > now) continue;

        const isTitlePrimary = titleKeyIds.has(keyObj.id);

        // Try Primary Queue first
        if (isTitlePrimary && titleQueue.length > 0) {
            const batch = getBatch(titleQueue, keyObj);
            if (batch.length > 0) {
                busyKeyIds.add(keyObj.id);
                startBatchProcessing(batch, keyObj);
                continue;
            }
        } else if (!isTitlePrimary && categoryQueue.length > 0) {
            const batch = getBatch(categoryQueue, keyObj);
            if (batch.length > 0) {
                busyKeyIds.add(keyObj.id);
                startCategoryBatchProcessing(batch, keyObj);
                continue;
            }
        }

        // Try Secondary (Fallback) Queue if Primary was empty or exhausted
        if (isTitlePrimary && categoryQueue.length > 0) {
            const batch = getBatch(categoryQueue, keyObj);
            if (batch.length > 0) {
                busyKeyIds.add(keyObj.id);
                startCategoryBatchProcessing(batch, keyObj);
                continue;
            }
        } else if (!isTitlePrimary && titleQueue.length > 0) {
            const batch = getBatch(titleQueue, keyObj);
            if (batch.length > 0) {
                busyKeyIds.add(keyObj.id);
                startBatchProcessing(batch, keyObj);
                continue;
            }
        }
    }

    // 6. Status Message if no requests active and waiting on cooldowns
    const totalActive = items.filter(i => (i.status === 'processing' || i.status === 'compressing')).length;
    if (totalActive === 0 && busyKeyIds.size === 0) {
        const cooldownKeys = validKeys.filter(k => k.cooldownUntil && k.cooldownUntil > now);
        if (cooldownKeys.length > 0) {
            const minWait = Math.min(...cooldownKeys.map(k => k.cooldownUntil! - now));
            setStatusMsg(`Waiting for API keys cooldown (${Math.ceil(minWait/1000)}s)...`);
        } else {
            setStatusMsg("Waiting for available keys...");
        }
    } else {
        const activeTitle = items.filter(i => (i.status === 'processing' || i.status === 'compressing') && !i.title).length;
        const activeCat = items.filter(i => i.status === 'processing' && i.title && !i.category).length;
        if (activeTitle > 0 && activeCat > 0) {
            setStatusMsg(`Pipeline active: ${activeTitle} in Title/Keywords, ${activeCat} in Category...`);
        } else if (activeTitle > 0) {
            setStatusMsg(`Generating Title/Keywords for ${activeTitle} items...`);
        } else if (activeCat > 0) {
            setStatusMsg(`Generating Categories for ${activeCat} items...`);
        }
    }
    } finally {
        schedulerRunningRef.current = false;
        if (scheduleAgainRef.current) {
            scheduleAgainRef.current = false;
            setTimeout(() => setTick(t => t + 1), 0);
        }
    }
  }, [items, keys, isProcessing, config.concurrency, config.batchSize, tick]);

  // Auto retry failed items every 20 seconds while batch is running
  useEffect(() => {
      if (!isProcessing) return;
      const interval = setInterval(() => {
          setItems(prev => {
              let changed = false;
              const newItems = prev.map(p => {
                  if (p.status === 'error' || (p.status === 'pending' && p.attempts > 3)) {
                      changed = true;
                      return {
                          ...p,
                          status: 'pending',
                          errorMsg: undefined,
                          assignedKeyId: undefined,
                          failedKeyIds: p.errorMsg?.includes('All API keys') ? [] : p.failedKeyIds,
                          attempts: 0,
                          retryAfter: undefined
                      };
                  }
                  return p;
              });
              return changed ? newItems : prev;
          });
      }, 20000);
      return () => clearInterval(interval);
  }, [isProcessing]);

  // --- SAVE PROJECT ---
  const handleSaveProject = async () => {
    if (items.length === 0) return;
    try {
        await saveProject(items);
        setLastAutoSave(new Date());
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
          setElapsedMs(0);
          sessionRequestCountRef.current = 0;
          localStorage.setItem('sessionReqCount', '0');
          setItems([]);
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
      if (!userData) {
          navigate('/login');
          return;
      }

      if (isProcessing) {
          setIsProcessing(false);
          setStatusMsg("Processing paused.");
          return;
      }
      
      if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
      }
      
      let activeKeys = keys;
      if (config.apiMode === 'central') {
          if (activeKeys.length === 0) {
              setStatusMsg("Connecting to Central API Pool...");
              activeKeys = await fetchCentralKeysPool();
          }
          if (activeKeys.length === 0) {
              setStatusMsg("No Central API keys available in server pool. Please add a key or try again.");
              return;
          }
      } else {
          if (activeKeys.length === 0) {
              setStatusMsg("No API keys configured. Please add keys first.");
              return;
          }
      }

      setStatusMsg("Validating API keys...");
      let hasValidKey = false;
      const keysToTest = activeKeys.filter(k => k.errorCount < 20);
      
      if (keysToTest.length === 0) {
          setStatusMsg("All configured keys have hit safety limits.");
          return;
      }

      for (const key of keysToTest.slice(0, 5)) {
          if (key.key.startsWith('central-')) {
              hasValidKey = true;
              break;
          }
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
          if (config.apiMode === 'central' && activeKeys.length > 0) {
              hasValidKey = true;
          } else {
              setStatusMsg("No valid API keys found. Please check your keys.");
              return;
          }
      }

      setIsProcessing(true);
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
  const progressScore = items.reduce((acc, item) => {
      let score = 0;
      if (item.title || item.status === 'done' || item.category) score += 0.5;
      if (item.status === 'done' || item.category) score += 0.5;
      return acc + score;
  }, 0);
  const queueProgressPercent = items.length > 0 ? Math.round((progressScore / items.length) * 100) : 0;
  const errorCount = items.filter(i => i.status === 'error' || (i.status === 'pending' && i.attempts > 3)).length;
  const hasPartialData = doneCount > 0 && !allDone;

  let estimatedTimeNode: React.ReactNode = null;
  if (isProcessing && etaEndTime) {
      const msLeft = Math.max(0, etaEndTime - Date.now());
      const totalSeconds = Math.ceil(msLeft / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      estimatedTimeNode = (
          <span className="inline-flex items-center text-purple-400">
             <svg className="w-3.5 h-3.5 mr-1 hourglass-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
             Estimated Time: {m > 0 ? `${m}m ` : ''}{s}s
          </span>
      );
  }

  let elapsedTimeNode: React.ReactNode = null;
  if (elapsedMs > 0) {
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      elapsedTimeNode = (
          <span className="inline-flex items-center text-slate-400">
             <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
             Elapsed Time: {m > 0 ? `${m}m ` : ''}{s}s
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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        document.getElementById('fileInput')?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
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


  let fastestTitleModel = '';
  let fastestCategoryModel = '';
  let titleLatency = 0;
  let categoryLatency = 0;
  let titleSamples = 0;
  let categorySamples = 0;

  if (config.model === 'turbo') {
     const tModel = getBestTurboModel(turboTitleStatsRef);
     const cModel = getBestTurboModel(turboCategoryStatsRef);
     fastestTitleModel = MODELS.find(m => m.id === tModel)?.name || tModel;
     fastestCategoryModel = MODELS.find(m => m.id === cModel)?.name || cModel;
     
     const tStat = turboTitleStatsRef.current[tModel];
     if (tStat && tStat.latencies.length > 0) {
        const recent = tStat.latencies.slice(-5);
        titleLatency = recent.reduce((a,b)=>a+b,0)/recent.length;
        titleSamples = tStat.latencies.length;
     }
     
     const cStat = turboCategoryStatsRef.current[cModel];
     if (cStat && cStat.latencies.length > 0) {
        const recent = cStat.latencies.slice(-5);
        categoryLatency = recent.reduce((a,b)=>a+b,0)/recent.length;
        categorySamples = cStat.latencies.length;
     }
  }

  return (
    <>
      <style>{`
        @keyframes hourglass-flip {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(180deg); }
          100% { transform: rotate(180deg); }
        }
        .hourglass-anim {
          animation: hourglass-flip 2s ease-in-out infinite;
        }
      `}</style>
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="h-full w-full flex overflow-hidden"
    >
      
      <Sidebar 
         keys={keys}
         setKeys={setKeys}
         config={config}
         setConfig={setConfig}
         isProcessing={isProcessing}
         onStartStop={handleStartStop}
         hasItems={items.length > 0}
         models={MODELS}
         modelStats={{}}
         history={history}
         onViewStats={() => setShowStats(true)}
         onClearHistory={handleClearHistory}
         onResetUsage={handleResetUsage}
         onResetAll={handleResetAllUsage}
         onShowToast={showNotification}
      />

      <main 
        className="flex-1 flex flex-col h-full overflow-hidden relative pt-4"
      >
        <div className="h-1.5 bg-slate-900 w-full shrink-0 z-50 relative flex items-center">
           <div 
               style={{ 
                  width: `${items.length ? (
                      ((items.filter(i => i.title && i.keywords).length * 0.5) + 
                       (items.filter(i => i.category && i.status === 'done').length * 0.5)) / items.length
                  ) * 100 : 0}%` 
               }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
           {items.length > 0 && (
             <div 
               className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2"
               style={{ 
                  left: `${items.length ? (
                      ((items.filter(i => i.title && i.keywords).length * 0.5) + 
                       (items.filter(i => i.category && i.status === 'done').length * 0.5)) / items.length
                  ) * 100 : 0}%` 
               }}
             >
               <div className="bg-slate-950 rounded-full p-0.5">
                 <Cat 
                   className={`w-6 h-6 ${isProcessing ? 'animate-bounce' : ''}`} 
                   style={{ 
                     color: `hsl(${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%)`,
                     filter: `drop-shadow(0 0 8px hsl(${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%))`,
                     fill: '#020617' // Extra mask for internal transparency
                   }}
                 />
               </div>
             </div>
           )}
        </div>

        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-950/50 backdrop-blur-md z-30">
           <div>
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               Queue
               <div className="relative group flex items-center">
                 <svg className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                 <div className="absolute hidden group-hover:block top-full mt-2 left-0 md:left-0 w-64 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 z-50 pointer-events-none">
                   <p className="font-bold text-white mb-2 pb-1 border-b border-slate-700">Keyboard Shortcuts</p>
                   <div className="flex justify-between mb-1"><span>Upload</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+O</kbd></div>
                   <div className="flex justify-between mb-1"><span>Save Project</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+S</kbd></div>
                   <div className="flex justify-between mb-1"><span>Export CSV</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+E</kbd></div>
                   <div className="flex justify-between mb-1"><span>Start / Stop</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+Enter</kbd></div>
                   <div className="flex justify-between"><span>Clear All</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+Bksp</kbd></div>
                 </div>
               </div>
             </h2>
             <div className="flex flex-col text-sm text-slate-500 mt-1 gap-1">
               <div className="flex items-center gap-2">
                 <span>Queue Progress: {queueProgressPercent}%</span>
               </div>
               
               
               
               <div className="flex flex-col text-[11px] font-mono mt-1 w-fit bg-slate-900/50 p-2 rounded border border-white/5 gap-1.5 min-h-[30px] justify-center">
                   {estimatedTimeNode && <div className="flex items-center gap-2">{estimatedTimeNode}</div>}
                   {elapsedTimeNode ? <div className="flex items-center gap-2">{elapsedTimeNode}</div> : <div className="flex items-center gap-2"><span className="inline-flex items-center text-slate-500"><svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Elapsed Time: 0s</span></div>}
               </div>
             </div>
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

              <div className="relative flex flex-col justify-center items-center group">
                <button 
                  id="save-btn"
                  type="button"
                  onClick={handleSaveProject}
                  disabled={items.length === 0}
                  title="Save Project (Ctrl+S / Cmd+S)"
                  className="px-4 py-2 bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-400 rounded-lg transition-all font-semibold border border-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  Save Project
                </button>
                {lastAutoSave && (
                  <span className="text-[10px] text-slate-500 absolute -bottom-5 whitespace-nowrap pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    Last saved: {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              
              <button
                onClick={handleStartStop}
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
                {allDone ? 'Export CSV' : hasPartialData ? 'Export Partial' : 'Waiting...'}
              </button>
           </div>
        </div>

        
        {config.model === 'turbo' && (titleSamples > 0 || categorySamples > 0) && (
          <div className="bg-slate-900/50 p-4 border-b border-slate-800">
             <div className="flex items-center gap-6 max-w-7xl mx-auto flex-wrap">
                 <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="font-bold text-slate-200">Turbo Active</span>
                 </div>
                 {titleSamples > 0 && (
                     <div className="flex items-center gap-2 text-xs">
                         <span className="text-slate-500">Title Pool:</span>
                         <span className="text-purple-400 font-bold">{fastestTitleModel}</span>
                         <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{(titleLatency / 1000).toFixed(1)}s</span>
                         <span className="text-slate-600">({titleSamples} runs)</span>
                     </div>
                 )}
                 {categorySamples > 0 && (
                     <div className="flex items-center gap-2 text-xs">
                         <span className="text-slate-500">Category Pool:</span>
                         <span className="text-purple-400 font-bold">{fastestCategoryModel}</span>
                         <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{(categoryLatency / 1000).toFixed(1)}s</span>
                         <span className="text-slate-600">({categorySamples} runs)</span>
                     </div>
                 )}
             </div>
          </div>
        )}
        
        <AnimatePresence>
          {showToTop && !isFullscreenBatchView && (
            <motion.button
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              onClick={scrollToTop}
              className="absolute top-28 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 shadow-2xl rounded-full text-xs font-semibold flex items-center gap-2 transition-colors backdrop-blur-md cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              To Top
            </motion.button>
          )}
        </AnimatePresence>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth space-y-8 relative"
          onScroll={handleScroll}
          id="main-scroll-area"
          onWheel={() => lastUserScrollRef.current = Date.now()}
          onTouchMove={() => lastUserScrollRef.current = Date.now()}
          onMouseDown={handleMouseDown}
          onMouseLeave={(e) => {
             handleMouseUp();
             setIsDragging(false);
          }}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragEnter={(e) => {
             e.preventDefault();
             setIsDragging(true);
          }}
          onDragOver={(e) => {
             e.preventDefault();
             setIsDragging(true);
          }}
          onDragLeave={(e) => {
             e.preventDefault();
             setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleAddFiles(e.dataTransfer.files);
          }}
        >
             <input id="fileInput" type="file" multiple accept="image/*,.eps,.svg" className="hidden" onChange={(e) => handleAddFiles(e.target.files)} />

             {items.length === 0 ? (
                 <div 
                   className={`group relative border-2 border-dashed transition-all duration-300 rounded-2xl p-6 text-center cursor-pointer overflow-hidden min-h-[160px] flex flex-col items-center justify-center ${isDragging ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.3)] scale-[1.01] z-10' : 'border-slate-800 hover:border-purple-500/50 bg-slate-900/30 hover:bg-slate-900/60 scale-100'}`}
                   onClick={(e) => {
                     e.stopPropagation();
                     document.getElementById('fileInput')?.click();
                   }}
                 >
                   <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                   
                   <div className="relative z-10 flex items-center gap-4 text-left">
                     <div className="p-3.5 bg-slate-800/80 rounded-2xl text-purple-400 border border-white/5 shadow-lg group-hover:scale-105 transition-transform shrink-0">
                       <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 13v8"/>
                          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                          <path d="m8 17 4-4 4 4"/>
                       </svg>
                     </div>
                     <div>
                       <h3 className="text-base font-bold text-slate-100 mb-0.5">Drop your creativity here</h3>
                       <p className="text-xs text-slate-400">
                         Drag & drop or click to upload images for title, keyword, & category generation.
                         <span className="text-slate-500 block text-[11px] mt-0.5 font-medium">Supports JPG, PNG, WEBP, SVG, EPS</span>
                       </p>
                     </div>
                   </div>
                 </div>
             ) : (
                 isDragging && (
                   <div className="border-2 border-dashed border-purple-500 bg-purple-500/10 rounded-xl p-4 text-center text-purple-300 font-semibold text-xs animate-pulse">
                     Drop images here to add to queue...
                   </div>
                 )
             )}

                {items.length > 0 && (
                  <div 
                    className={isFullscreenBatchView ? "fixed inset-0 z-[100] bg-slate-950 overflow-y-auto custom-scrollbar p-6 sm:p-10 space-y-6 flex flex-col animate-in fade-in duration-200" : "space-y-8"}
                    ref={isFullscreenBatchView ? fullScreenScrollRef : undefined}
                    onScroll={isFullscreenBatchView ? handleScroll : undefined}
                  >
                    {isFullscreenBatchView && (
                      <>
                        <div className="fixed top-0 left-0 right-0 h-1.5 bg-slate-900 w-full shrink-0 z-[110] flex items-center">
                           <div 
                               style={{ 
                                   width: `${items.length ? (
                                      ((items.filter(i => i.title && i.keywords).length * 0.5) + 
                                        (items.filter(i => i.category && i.status === 'done').length * 0.5)) / items.length
                                  ) * 100 : 0}%` 
                                }}
                               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                           />
                           {items.length > 0 && (
                             <div 
                               className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2"
                               style={{ 
                                   left: `${items.length ? (
                                      ((items.filter(i => i.title && i.keywords).length * 0.5) + 
                                        (items.filter(i => i.category && i.status === 'done').length * 0.5)) / items.length
                                  ) * 100 : 0}%` 
                                }}
                             >
                               <div className="bg-slate-950 rounded-full p-0.5">
                                 <Cat 
                                   className={`w-6 h-6 ${isProcessing ? 'animate-bounce' : ''}`} 
                                   style={{ 
                                     color: `hsl(${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%)`,
                                     filter: `drop-shadow(0 0 8px hsl(${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%))`,
                                     fill: '#020617' // Extra mask for internal transparency
                                   }}
                                 />
                               </div>
                             </div>
                           )}
                        </div>

                        <AnimatePresence>
                          {showToTop && (
                            <motion.button
                              initial={{ opacity: 0, y: -20, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -20, scale: 0.9 }}
                              onClick={scrollToTop}
                              className="fixed top-8 left-1/2 -translate-x-1/2 z-[130] px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/50 shadow-2xl rounded-full text-xs font-semibold flex items-center gap-2 transition-colors backdrop-blur-md cursor-pointer pointer-events-auto"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                              To Top
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/50 p-3 rounded-2xl border border-slate-800 shrink-0">
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>All</button>
                            <button onClick={() => setFilter('ongoing')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'ongoing' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>On going</button>
                            <button onClick={() => setFilter('uncompleted')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'uncompleted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>Uncompleted</button>
                            <button onClick={() => setFilter('completed')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>Completed</button>
                            <button onClick={() => setFilter('failed')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'failed' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>Failed</button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                              onClick={() => setIsFullscreenBatchView(!isFullscreenBatchView)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 border border-slate-700"
                              title={isFullscreenBatchView ? "Exit Fullscreen (Esc)" : "Fullscreen Batch View (Esc to exit)"}
                            >
                              {isFullscreenBatchView ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">{isFullscreenBatchView ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                            </button>
                            <button
                              onClick={() => document.getElementById('fileInput')?.click()}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Add Images</span>
                            </button>
                            <div className="flex items-center gap-2 text-xs text-slate-300 px-2 font-semibold border-l border-slate-800 pl-3">
                                <span>Total Images in Queue: <strong className="text-purple-400 font-bold text-sm">{items.length}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className={isFullscreenBatchView ? "flex-1" : ""}>
                      <ProcessingQueue 
                        items={
                          filter === 'failed' 
                            ? items.filter(i => i.status === 'error') 
                            : filter === 'uncompleted' 
                            ? items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()) 
                            : filter === 'completed'
                            ? items.filter(i => i.status === 'done' || (i.status !== 'error' && i.status !== 'processing' && i.status !== 'compressing' && Boolean(i.title?.trim()) && Boolean(i.keywords?.trim()) && Boolean(i.category?.trim())))
                            : filter === 'ongoing' 
                            ? items.filter(i => i.status === 'processing' || i.status === 'compressing') 
                            : items
                        } 
                        itemRefs={itemRefs}
                        onRemove={removeItem}
                        onUpdate={updateItem}
                        onRegenerate={handleRegenerate}
                        onCopy={handleCopy}
                        forceTransparency={config.forceTransparency || false}
                      />
                    </div>
                  </div>
                )}
        </div>

        <div className="text-center py-4 text-xs text-slate-500 border-t border-white/5 bg-slate-950/50 backdrop-blur-md shrink-0">
           All rights reserved. Developed and maintained by Shahin Alam Emon.
        </div>
        {showExportModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 relative mx-4">
            <div className="text-emerald-400 mb-4 flex justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3 className="text-2xl font-bold text-center text-white mb-2">Export Complete</h3>
            <div className="flex flex-col gap-3 mb-6 bg-slate-950/50 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Images:</span>
                <span className="text-white font-bold">{exportStats.count}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total API Requests:</span>
                <span className="text-emerald-400 font-bold">{exportStats.requestCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Elapsed Time:</span>
                <span className="text-purple-400 font-bold">{exportStats.elapsedTime || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">File Downloaded:</span>
                <span className="text-slate-200">{exportStats.path}</span>
              </div>
              <div className="mt-4 flex justify-center">
                <button 
                  onClick={() => {
                    alert('Check your Downloads folder for the CSV file. Depending on your browser, it has been saved to your default download location.');
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold text-slate-300 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Where is my file?
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <button onClick={() => setShowExportModal(false)} className="px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-bold shadow-lg border border-white/5 hover:scale-105 active:scale-95">Close</button>
            </div>
          </div>
        </div>
      )}

        <div className="absolute bottom-12 right-8 z-50 animate-in slide-in-from-bottom-5 fade-in pointer-events-none">
            <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 bg-slate-900/90 backdrop-blur-xl">
                {isProcessing ? (
                   <div className="relative w-6 h-6 flex items-center justify-center">
                     <svg className="w-5 h-5 text-emerald-400 animate-bounce drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                     </svg>
                   </div>
                ) : (
                   <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                )}
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

    </motion.div>
  </>
  );
}
