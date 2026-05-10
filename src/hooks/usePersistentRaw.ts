import { useState } from 'react';

// usePersistentRaw — returns raw localStorage string (used for PIN, which must survive refreshes)
export const usePersistentRaw = (key: string, initial: string): [string, (v: string) => void] => {
  const [val, setVal] = useState(() => {
    try { return localStorage.getItem(key) || initial; } catch { return initial; }
  });
  const setStored = (v: string) => {
    setVal(v);
    try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key); } catch {}
  };
  return [val, setStored];
};
