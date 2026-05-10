import { supabase } from '../lib/supabase';

export const useSupabaseMutation = <T>(
  tableName: string, 
  localStorageKey: string, 
  currentData: T[], 
  setData: (data: T[]) => void,
  orgId?: string
) => {
  const insert = async (item: any) => {
    const itemWithOrg = orgId ? { ...item, org_id: orgId } : item;
    
    // Optimistically update local state and localStorage
    const tempId = item.id || Math.random().toString(36).substr(2, 9);
    const optimisticItem = { ...itemWithOrg, id: tempId };
    const newData = [...currentData, optimisticItem];
    setData(newData);
    localStorage.setItem(localStorageKey, JSON.stringify(newData));

    // Write to Supabase
    const { data: sbData, error } = await supabase
      .from(tableName)
      .insert(itemWithOrg)
      .select()
      .single();

    if (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      // Optional: rollback on error? User said "simultaneously", so we keep local data.
    } else if (sbData) {
      // Replace optimistic item with real data from DB (includes DB-generated ID if applicable)
      const finalData = currentData.map((it: any) => it.id === tempId ? sbData : it);
      // Wait, if we just appended, we should replace the last one or match by tempId
      setData([...currentData, sbData]); 
      localStorage.setItem(localStorageKey, JSON.stringify([...currentData, sbData]));
    }

    return { data: sbData, error };
  };

  const update = async (id: string | number, patch: any) => {
    // Update local state and localStorage
    const newData = currentData.map((item: any) => item.id === id ? { ...item, ...patch } : item);
    setData(newData);
    localStorage.setItem(localStorageKey, JSON.stringify(newData));

    // Write to Supabase
    const { data: sbData, error } = await supabase
      .from(tableName)
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${tableName}:`, error);
    }

    return { data: sbData, error };
  };

  const remove = async (id: string | number) => {
    // Update local state and localStorage
    const newData = currentData.filter((item: any) => item.id !== id);
    setData(newData);
    localStorage.setItem(localStorageKey, JSON.stringify(newData));

    // Write to Supabase
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting from ${tableName}:`, error);
    }

    return { error };
  };

  return { insert, update, remove };
};
