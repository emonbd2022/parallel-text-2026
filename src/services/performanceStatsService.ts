import { ApiKey, ModelSpeedStat, ApiKeySpeedStat } from '../types';

const STORAGE_MODEL_SPEED_STATS = 'parrarel_model_stats_v2';
const STORAGE_API_SPEED_STATS = 'parrarel_api_stats_v2';
const STORAGE_SESSION_EXCLUDED = 'parrarel_session_excluded_v2';
const STORAGE_SESSION_ATTEMPTED = 'parrarel_session_attempted_v2';

export interface SessionExclusionInfo {
  reason: 'error_excluded';
  message: string;
  timestamp: number;
  durationMs?: number;
}

export interface DynamicApiSpeedProfile {
  keyId: string;
  avgTimeMs: number;
  lastLatencyMs: number;
  count: number;
  fails: number;
  speedRank: number;
  isFastest: boolean;
  speedTag: 'fastest' | 'fast' | 'normal' | 'slower' | 'untried';
  diffPercentVsAvg?: number; // e.g. -25 means 25% faster than peer average, +40 means 40% slower
  peerAvgLatencyMs: number;
  hasData: boolean;
}

class PerformanceStatsService {
  private modelStats: Record<string, ModelSpeedStat> = {};
  private apiStats: Record<string, ApiKeySpeedStat> = {};
  private sessionExcludedKeys: Map<string, SessionExclusionInfo> = new Map();
  private sessionAttemptedKeys: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    try {
      const rawModels = localStorage.getItem(STORAGE_MODEL_SPEED_STATS);
      if (rawModels) {
        this.modelStats = JSON.parse(rawModels);
      }
    } catch (e) {
      this.modelStats = {};
    }

    try {
      const rawApis = localStorage.getItem(STORAGE_API_SPEED_STATS);
      if (rawApis) {
        this.apiStats = JSON.parse(rawApis);
      }
    } catch (e) {
      this.apiStats = {};
    }

    try {
      // Clear legacy exclusions from v1 if present to immediately unban keys that were marked 'slow_excluded'
      sessionStorage.removeItem('parrarel_session_excluded_v1');
      
      const rawExcluded = sessionStorage.getItem(STORAGE_SESSION_EXCLUDED);
      if (rawExcluded) {
        const parsed = JSON.parse(rawExcluded);
        const map = new Map<string, SessionExclusionInfo>();
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          // ONLY keep error exclusions, discard any slow exclusions
          if (v && v.reason === 'error_excluded') {
            map.set(k, v);
          }
        });
        this.sessionExcludedKeys = map;
      }
    } catch (e) {
      this.sessionExcludedKeys = new Map();
    }

    try {
      const rawAttempted = sessionStorage.getItem(STORAGE_SESSION_ATTEMPTED);
      if (rawAttempted) {
        const parsed = JSON.parse(rawAttempted);
        this.sessionAttemptedKeys = new Set(parsed);
      }
    } catch (e) {
      this.sessionAttemptedKeys = new Set();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) {}
    });
  }

  private persistModels() {
    try {
      localStorage.setItem(STORAGE_MODEL_SPEED_STATS, JSON.stringify(this.modelStats));
    } catch (e) {}
  }

  private persistApis() {
    try {
      localStorage.setItem(STORAGE_API_SPEED_STATS, JSON.stringify(this.apiStats));
    } catch (e) {}
  }

  private persistSessionState() {
    try {
      const obj: Record<string, SessionExclusionInfo> = {};
      this.sessionExcludedKeys.forEach((val, key) => { 
        if (val.reason === 'error_excluded') {
          obj[key] = val; 
        }
      });
      sessionStorage.setItem(STORAGE_SESSION_EXCLUDED, JSON.stringify(obj));
      sessionStorage.setItem(STORAGE_SESSION_ATTEMPTED, JSON.stringify(Array.from(this.sessionAttemptedKeys)));
    } catch (e) {}
  }

  public getModelStats(): Record<string, ModelSpeedStat> {
    return { ...this.modelStats };
  }

  public getApiStats(): Record<string, ApiKeySpeedStat> {
    return { ...this.apiStats };
  }

  public getSessionExcludedKeys(): Map<string, SessionExclusionInfo> {
    return new Map(this.sessionExcludedKeys);
  }

  public getSessionAttemptedKeys(): Set<string> {
    return new Set(this.sessionAttemptedKeys);
  }

  public isKeyExcludedForSession(keyId: string): boolean {
    const excl = this.sessionExcludedKeys.get(keyId);
    return excl?.reason === 'error_excluded';
  }

  public getKeyExclusion(keyId: string): SessionExclusionInfo | undefined {
    return this.sessionExcludedKeys.get(keyId);
  }

  public hasAttemptedKeyInSession(keyId: string): boolean {
    return this.sessionAttemptedKeys.has(keyId);
  }

  public markKeyAttempted(keyId: string) {
    this.sessionAttemptedKeys.add(keyId);
    this.persistSessionState();
    this.notify();
  }

  /**
   * Exclude a local API key from the remainder of the session ONLY on encountering errors
   * User requirement: "Prioritize faster api over slow but don't exclude. Only exclude if encounters error"
   */
  public excludeLocalKeyForSession(
    keyId: string, 
    reason: 'error_excluded', 
    message: string, 
    durationMs?: number
  ) {
    this.sessionExcludedKeys.set(keyId, {
      reason: 'error_excluded',
      message,
      timestamp: Date.now(),
      durationMs
    });
    this.persistSessionState();
    this.notify();
  }

  /**
   * Record processing time for a model and API key
   */
  public recordExecution(params: {
    modelId: string;
    modelName?: string;
    keyId: string;
    keyLabel: string;
    apiType: 'local' | 'central';
    durationMs: number;
    itemCount: number;
    success: boolean;
    errorMsg?: string;
  }) {
    const { modelId, modelName, keyId, keyLabel, apiType, durationMs, success, errorMsg } = params;

    // 1. Update Model Stats
    const currentModel = this.modelStats[modelId] || {
      modelId,
      modelName: modelName || modelId,
      totalTimeMs: 0,
      count: 0,
      fails: 0,
      avgTimeMs: 0,
      lastLatencyMs: 0,
      lastUpdated: Date.now()
    };

    if (success) {
      currentModel.totalTimeMs += durationMs;
      currentModel.count += 1;
      currentModel.avgTimeMs = Math.round(currentModel.totalTimeMs / currentModel.count);
      currentModel.lastLatencyMs = durationMs;
    } else {
      currentModel.fails += 1;
    }
    currentModel.lastUpdated = Date.now();
    this.modelStats[modelId] = currentModel;
    this.persistModels();

    // 2. Update API Key Stats
    const currentApi = this.apiStats[keyId] || {
      keyId,
      keyLabel,
      apiType,
      totalTimeMs: 0,
      count: 0,
      fails: 0,
      avgTimeMs: 0,
      lastLatencyMs: 0,
      lastUpdated: Date.now()
    };

    if (success) {
      currentApi.totalTimeMs += durationMs;
      currentApi.count += 1;
      currentApi.avgTimeMs = Math.round(currentApi.totalTimeMs / currentApi.count);
      currentApi.lastLatencyMs = durationMs;
    } else {
      currentApi.fails += 1;
    }
    currentApi.lastUpdated = Date.now();
    this.apiStats[keyId] = currentApi;
    this.persistApis();

    // 3. Local Session Rules:
    // Mark key as attempted so subsequent dispatches know it has run at least once.
    // ONLY exclude if it encountered an error!
    if (apiType === 'local') {
      this.markKeyAttempted(keyId);

      if (!success) {
        this.excludeLocalKeyForSession(
          keyId, 
          'error_excluded', 
          errorMsg || 'Encountered error during processing'
        );
      }
    }

    this.notify();
  }

  /**
   * Computes dynamic statistical comparison across all active keys in real-time.
   * Compares each key's latency to its active peers to determine whether it is
   * dynamically Fastest, Fast, Normal, or Slower.
   */
  public getDynamicApiMetrics(keys: ApiKey[]): Record<string, DynamicApiSpeedProfile> {
    const profiles: Record<string, DynamicApiSpeedProfile> = {};
    const keysWithData: { keyId: string; avgTimeMs: number; count: number; fails: number; lastLatencyMs: number }[] = [];

    keys.forEach(k => {
      const stat = this.apiStats[k.id];
      if (stat && stat.count > 0) {
        keysWithData.push({
          keyId: k.id,
          avgTimeMs: stat.avgTimeMs,
          count: stat.count,
          fails: stat.fails,
          lastLatencyMs: stat.lastLatencyMs
        });
      }
    });

    // Calculate dynamic peer average latency
    const peerAvgLatencyMs = keysWithData.length > 0
      ? Math.round(keysWithData.reduce((acc, curr) => acc + curr.avgTimeMs, 0) / keysWithData.length)
      : 3000;

    // Sort by avgTimeMs ascending to determine dynamic ranks
    keysWithData.sort((a, b) => a.avgTimeMs - b.avgTimeMs);
    const fastestAvgTimeMs = keysWithData.length > 0 ? keysWithData[0].avgTimeMs : 3000;

    keys.forEach(k => {
      const isAttempted = this.sessionAttemptedKeys.has(k.id);
      const stat = this.apiStats[k.id];
      const hasData = Boolean(stat && stat.count > 0);

      if (!hasData) {
        profiles[k.id] = {
          keyId: k.id,
          avgTimeMs: 0,
          lastLatencyMs: 0,
          count: 0,
          fails: stat?.fails || k.errorCount || 0,
          speedRank: 99,
          isFastest: false,
          speedTag: isAttempted ? 'normal' : 'untried',
          peerAvgLatencyMs,
          hasData: false
        };
        return;
      }

      const rankIndex = keysWithData.findIndex(item => item.keyId === k.id);
      const speedRank = rankIndex >= 0 ? rankIndex + 1 : 99;
      const isFastest = rankIndex === 0;

      const diffPercentVsAvg = peerAvgLatencyMs > 0 
        ? Math.round(((stat!.avgTimeMs - peerAvgLatencyMs) / peerAvgLatencyMs) * 100)
        : 0;

      let speedTag: 'fastest' | 'fast' | 'normal' | 'slower' = 'normal';
      if (isFastest || stat!.avgTimeMs <= Math.max(fastestAvgTimeMs * 1.1, peerAvgLatencyMs * 0.88)) {
        speedTag = 'fastest';
      } else if (stat!.avgTimeMs <= peerAvgLatencyMs * 1.08) {
        speedTag = 'fast';
      } else {
        speedTag = 'slower';
      }

      profiles[k.id] = {
        keyId: k.id,
        avgTimeMs: stat!.avgTimeMs,
        lastLatencyMs: stat!.lastLatencyMs,
        count: stat!.count,
        fails: stat!.fails,
        speedRank,
        isFastest,
        speedTag,
        diffPercentVsAvg,
        peerAvgLatencyMs,
        hasData: true
      };
    });

    return profiles;
  }

  /**
   * Sort valid API keys according to speed and session fairness:
   * 1. Exclude error-banned keys (ONLY when encounters error)
   * 2. Prioritize untried local keys first ("Try to use all the local API at least once")
   * 3. Prioritize dynamically faster APIs (lowest avgTimeMs) over slower APIs (DO NOT exclude slow keys!)
   */
  public prioritizeApiKeys(keys: ApiKey[], apiType: 'local' | 'central'): ApiKey[] {
    // 1. Filter out only error-excluded keys (never exclude for speed)
    const available = keys.filter(k => {
      const excl = this.sessionExcludedKeys.get(k.id);
      if (excl && excl.reason === 'error_excluded') {
        return false;
      }
      return true;
    });

    if (apiType !== 'local') {
      // For Central keys: sort dynamically by measured speed & error count
      return available.sort((a, b) => {
        const statA = this.apiStats[a.id];
        const statB = this.apiStats[b.id];
        const timeA = (statA && statA.count > 0) ? statA.avgTimeMs : 3500;
        const timeB = (statB && statB.count > 0) ? statB.avgTimeMs : 3500;
        const scoreA = timeA + (a.errorCount * 2500);
        const scoreB = timeB + (b.errorCount * 2500);
        return scoreA - scoreB;
      });
    }

    // For Local keys:
    return available.sort((a, b) => {
      const aAttempted = this.sessionAttemptedKeys.has(a.id);
      const bAttempted = this.sessionAttemptedKeys.has(b.id);

      // Rule: Try to use all the local API at least once!
      // Untried keys come FIRST so every local key is tested.
      if (!aAttempted && bAttempted) return -1;
      if (aAttempted && !bAttempted) return 1;

      // Both untried or both tried: dynamically prioritize faster APIs over slower APIs
      const statA = this.apiStats[a.id];
      const statB = this.apiStats[b.id];
      const timeA = (statA && statA.count > 0) ? statA.avgTimeMs : 3000;
      const timeB = (statB && statB.count > 0) ? statB.avgTimeMs : 3000;
      const scoreA = timeA + (a.errorCount * 3000);
      const scoreB = timeB + (b.errorCount * 3000);
      return scoreA - scoreB;
    });
  }

  /**
   * Returns list of models sorted by verified speed (fastest first),
   * prioritizing Gemini 3.1 Flash Lite as the default fast engine.
   */
  public getAnalyzedFasterModels(models: { id: string; name: string }[]): (ModelSpeedStat & { rank: number; isFastest: boolean })[] {
    const list = models
      .filter(m => m.id !== 'turbo')
      .map(m => {
        const stat = this.modelStats[m.id];
        const avgTimeMs = stat && stat.count > 0 ? stat.avgTimeMs : (
          m.id.includes('3.1-flash-lite') ? 2200 :
          m.id.includes('2.5-flash-lite') ? 2400 :
          m.id.includes('2.5-flash') ? 2700 :
          m.id.includes('3.8-flash') ? 3100 : 3500
        );
        const count = stat?.count || 0;
        const fails = stat?.fails || 0;
        const totalTimeMs = stat?.totalTimeMs || 0;
        const lastLatencyMs = stat?.lastLatencyMs || 0;

        return {
          modelId: m.id,
          modelName: m.name.split(' (')[0],
          totalTimeMs,
          count,
          fails,
          avgTimeMs,
          lastLatencyMs,
          lastUpdated: stat?.lastUpdated,
          rank: 0,
          isFastest: false
        };
      });

    // Sort by avgTimeMs ascending (lowest latency first)
    list.sort((a, b) => a.avgTimeMs - b.avgTimeMs);

    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      isFastest: idx === 0
    }));
  }

  /**
   * Reset the session pool exclusions (allows user to re-enable all keys)
   */
  public resetSessionPool() {
    this.sessionExcludedKeys.clear();
    this.sessionAttemptedKeys.clear();
    sessionStorage.removeItem(STORAGE_SESSION_EXCLUDED);
    sessionStorage.removeItem(STORAGE_SESSION_ATTEMPTED);
    this.notify();
  }

  /**
   * Clear all stored historical performance stats
   */
  public clearAllStats() {
    this.modelStats = {};
    this.apiStats = {};
    localStorage.removeItem(STORAGE_MODEL_SPEED_STATS);
    localStorage.removeItem(STORAGE_API_SPEED_STATS);
    this.resetSessionPool();
  }
}

export const performanceStats = new PerformanceStatsService();
