import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useSupabaseQuery = <T>(tableName: string, localStorageKey: string) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sbData, error: sbError } = await supabase
        .from(tableName)
        .select('*');

      if (sbError) throw sbError;

      if (sbData) {
        setData(sbData);
        // Sync to local storage
        localStorage.setItem(localStorageKey, JSON.stringify(sbData));
      }
    } catch (err: any) {
      console.error(`Error fetching ${tableName}:`, err);
      setError(err);
      // Fallback to local storage
      const local = localStorage.getItem(localStorageKey);
      if (local) {
        try {
          setData(JSON.parse(local));
        } catch (parseErr) {
          console.error(`Error parsing local storage for ${localStorageKey}:`, parseErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tableName, localStorageKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, setData, loading, error, refetch: fetchData };
};
