/**
 * Device ID Management for Customer Order Isolation
 * Generates a unique, persistent device ID for each customer's mobile browser/device
 * ensuring each customer only sees their own orders in "طلباتي" (My Orders).
 */

const STORAGE_KEY = 'almallah_device_id';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server_environment';
  }

  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId || !deviceId.startsWith('almallah_dev_')) {
      const randomPart = Math.random().toString(36).substring(2, 10);
      const timestampPart = Date.now().toString(36);
      deviceId = `almallah_dev_${timestampPart}_${randomPart}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    console.warn('LocalStorage not accessible for deviceId:', e);
    return `almallah_dev_session_${Date.now()}`;
  }
}

export function getStoredDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
