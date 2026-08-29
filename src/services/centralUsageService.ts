/**
 * Central API Usage Service
 * Tracks and calculates authoritative daily Central API allowances and usage stats.
 *
 * RULES:
 * - 1 Local API Key = 100 Central API requests per day
 * - 1 Image = 2 API requests (1 metadata + 1 category)
 * - 1 Local API Key = 50 Images per day
 * - Formula:
 *     Daily Central Requests = Local API Key Count × 100
 *     Daily Central Images = Local API Key Count × 50
 * - Automatic reset at 2:00 PM Bangladesh Time (GMT+6)
 */

export interface CentralUsageStats {
  success: boolean;
  cycleId: string;
  usedRequests: number;
  totalRequests: number;
  remainingRequests: number;
  localKeyCount: number;
  totalImages: number;
  remainingImages: number;
  isLimitReached: boolean;
  resetTime: string;
  nextResetMs: number;
}

/**
 * Calculates local client estimates immediately while backend syncs
 */
export function calculateLocalCentralLimit(localKeyCount: number, isAdmin = false): {
  totalRequests: number;
  totalImages: number;
} {
  if (isAdmin) {
    const adminReqs = Math.max(50000, localKeyCount * 100);
    return {
      totalRequests: adminReqs,
      totalImages: Math.floor(adminReqs / 2)
    };
  }
  const totalRequests = localKeyCount * 100;
  const totalImages = localKeyCount * 50;
  return { totalRequests, totalImages };
}

/**
 * Fetches the authoritative daily usage and quota from the server
 */
export async function fetchServerCentralUsage(
  localKeys: string[] = [],
  idToken?: string,
  userMetadata?: { email?: string; uid?: string; role?: string; isAdmin?: boolean }
): Promise<CentralUsageStats | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/central-usage', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        localKeys,
        user: userMetadata,
        isAdmin: userMetadata?.isAdmin || userMetadata?.role === 'admin'
      })
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && data.success) {
      return data as CentralUsageStats;
    }
    return null;
  } catch (error) {
    console.warn('[CentralUsageService] Failed to fetch server usage:', error);
    return null;
  }
}

/**
 * Formats remaining time until next 2:00 PM BST reset
 */
export function formatTimeUntilReset(nextResetMs: number): string {
  const diff = Math.max(0, nextResetMs - Date.now());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
