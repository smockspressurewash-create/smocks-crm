// Storage helpers — placeholder for any additional localStorage utilities
// usePersistent and usePersistentRaw are in src/hooks/

export const getStorageItem = (key: string, fallback: any = null) => {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

export const setStorageItem = (key: string, value: any) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export const removeStorageItem = (key: string) => {
  try { localStorage.removeItem(key); } catch {}
};
