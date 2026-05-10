import { useState, useEffect } from 'react';

// usePersistent — stores JSON in window.storage (artifact storage API), falls back to in-memory
export const usePersistent = <T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] => {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (typeof window !== "undefined") {
          if ((window as any).storage) {
            const r = await (window as any).storage.get(key);
            if (!cancelled && r && r.value !== undefined) {
              const parsed = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
              setValue(parsed);
              setHydrated(true);
              return;
            }
          }
          const local = localStorage.getItem(key);
          if (!cancelled && local) {
            setValue(JSON.parse(local));
          }
        }
      } catch (e) {
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      if ((window as any).storage) {
        (window as any).storage.set(key, serialized).catch(() => {});
      }
    } catch (e) {
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated];
};
