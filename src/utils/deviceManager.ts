/**
 * Device Identification & Multi-Device Protection Service
 * Enforces the rule: 1 Gmail Account = Max 2 Devices
 */

export interface DeviceMetadata {
  id: string;
  name: string;
  browser: string;
  os: string;
  platform: string;
  registeredAt?: string;
  lastActiveAt?: string;
}

export const MAX_DEVICES_PER_ACCOUNT = 2;

const DEVICE_STORAGE_KEY = 'parrarel_device_id_v2';
const LEGACY_STORAGE_KEY = 'deviceId';

/**
 * Parses current user agent to produce a friendly device label
 */
export function detectDeviceMetadata(existingId?: string): DeviceMetadata {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? (navigator.platform || '') : '';
  
  let browser = 'Web Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';

  let os = 'Unknown OS';
  if (/iPhone/i.test(ua)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(ua)) os = 'iPad (iPadOS)';
  else if (/Android/i.test(ua)) os = 'Android Device';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows NT 10.0|Windows NT 11.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows PC';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  const name = `${browser} on ${os}`;
  const id = existingId || getOrCreateDeviceId();

  return {
    id,
    name,
    browser,
    os,
    platform: platform || os,
    lastActiveAt: new Date().toISOString()
  };
}

/**
 * Returns or generates a stable, persistent Device ID for this browser instance.
 */
export function getOrCreateDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      let storedId = localStorage.getItem(DEVICE_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (storedId && storedId.trim().length >= 8) {
        // Sync both keys
        localStorage.setItem(DEVICE_STORAGE_KEY, storedId);
        return storedId;
      }

      // Generate a new high-entropy device ID with platform prefix
      const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID().replace(/-/g, '').substring(0, 16) 
        : (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10));
      
      const newId = `dev_${randomPart}`;
      localStorage.setItem(DEVICE_STORAGE_KEY, newId);
      localStorage.setItem(LEGACY_STORAGE_KEY, newId);
      return newId;
    }
  } catch (e) {
    console.warn('[DeviceManager] localStorage access failed:', e);
  }

  return 'dev_' + Math.random().toString(36).substring(2, 12);
}

/**
 * Formats a device ID for clean display (e.g. dev_a8f9...3b21)
 */
export function formatDeviceId(id: string): string {
  if (!id) return 'Unknown Device';
  if (id.length <= 12) return id;
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
}

/**
 * Checks if the current device is authorized in the user's registered list
 */
export function checkDeviceAuthorization(
  currentDeviceId: string,
  registeredDeviceIds: string[] = [],
  isAdmin = false
): {
  isAuthorized: boolean;
  canRegister: boolean;
  registeredCount: number;
  maxDevices: number;
} {
  const maxDevices = MAX_DEVICES_PER_ACCOUNT;
  if (isAdmin) {
    return {
      isAuthorized: true,
      canRegister: true,
      registeredCount: registeredDeviceIds.length,
      maxDevices: 999
    };
  }

  const isAlreadyRegistered = registeredDeviceIds.includes(currentDeviceId);
  const registeredCount = registeredDeviceIds.length;
  const canRegister = registeredCount < maxDevices;
  const isAuthorized = isAlreadyRegistered || canRegister;

  return {
    isAuthorized,
    canRegister,
    registeredCount,
    maxDevices
  };
}
