export interface ApiKeyUsage {
  date: string; // YYYY-MM-DD in Bangladesh time (session based)
  flash: number;
  lite: number;
  pro: number;
  flash_3: number;
  flash_3_1_lite: number;
}

export interface ApiKey {
  id: string;
  label: string;
  key: string;
  errorCount: number;
  cooldownUntil?: number; // Timestamp when this key can be used again
  usage: ApiKeyUsage;
}

export interface ProcessingItem {
  id: string;
  file: File | null; // Nullable for restored items from localStorage
  name: string;
  size: number;
  thumb: string | null;
  blob: Blob | null;
  status: 'pending' | 'compressing' | 'processing' | 'done' | 'error';
  errorMsg?: string;
  attempts: number;
  retryAfter?: number; // Timestamp for delayed retries
  title: string;
  keywords: string;
  assignedKeyId?: string; // Tracks which key is currently processing this item
  failedKeyIds: string[]; // Tracks which keys have already failed for this item
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  itemCount: number;
  csv: string;
}

export interface ProcessingConfig {
  concurrency: number; // Max simultaneous API requests
  batchSize: number; // Images per single API request (1-5)
  maxRetries: number;
  titleMaxLen: number;
  keywordsCount: number;
  model: string;
  titlePrefix?: string;
  titleSuffix?: string;
  negativeTitleWords?: string;
  negativeKeywords?: string;
  targetExtension?: string; // .jpg, .png, etc.
  forceTransparency?: boolean; // Forces "isolated on transparent background" tag
  autoExport?: boolean;
  migratedTo31Lite?: boolean;
}

export interface GeminiResponse {
  title: string;
  keywords: string; // Comma separated string for the UI
}
