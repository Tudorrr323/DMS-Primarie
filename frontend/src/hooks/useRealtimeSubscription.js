import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook pentru ascultarea modificărilor în timp real pe o tabelă Supabase.
 * Când apare o modificare (INSERT, UPDATE, DELETE), apelează funcția de callback (ex: reîncarcă datele).
 * 
 * @param {string} tableName - Numele tabelei (ex: 'documents')
 * @param {Function} onDataChanged - Funcția de apelat când se detectează schimbări
 * @param {Array} filter - (Opțional) Filtru adițional, ex: 'id=eq.123' (Momentan ascultăm tot tabelul pentru simplitate)
 */
export const useRealtimeSubscription = (tableName, onDataChanged) => {
  useEffect(() => {
    // Creăm un canal unic bazat pe numele tabelei și timestamp (pentru a evita coliziuni la remount)
    const channelName = `realtime:${tableName}:${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', // Ascultă toate evenimentele: INSERT, UPDATE, DELETE
          schema: 'public', 
          table: tableName 
        },
        (payload) => {
          console.log(`[Realtime] Change detected in ${tableName}:`, payload);
          // Aici am putea verifica payload.new sau payload.old pentru a vedea dacă ne afectează
          // Dar pentru simplitate și siguranță (RLS), reîncărcăm datele.
          if (onDataChanged) {
            onDataChanged();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to ${tableName}`);
        }
      });

    // Cleanup la unmount
    return () => {
      console.log(`[Realtime] Unsubscribing from ${tableName}`);
      supabase.removeChannel(channel);
    };
  }, [tableName, onDataChanged]); 
};
