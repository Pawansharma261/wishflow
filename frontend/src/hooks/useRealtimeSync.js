import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useRealtimeSync
 * Listens for postgres_changes on key tables for the current user.
 * 
 * @param {string} userId - Current user ID
 * @param {function} onUserChange - Callback for 'users' table changes
 * @param {function} onContactsChange - Callback for 'contacts' table changes
 * @param {function} onWishesChange - Callback for 'wishes' table changes
 */
export const useRealtimeSync = ({ userId, onUserChange, onContactsChange, onWishesChange }) => {
  useEffect(() => {
    if (!userId) return undefined;

    // Create a unique channel for this user's sync
    const channel = supabase
      .channel(`sync-${userId}`)
      // Listen to profile changes
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, 
        (payload) => {
           console.log('[Realtime] User change:', payload.eventType);
           onUserChange?.(payload);
        }
      )
      // Listen to contact changes
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'contacts', filter: `user_id=eq.${userId}` }, 
        (payload) => {
           console.log('[Realtime] Contacts change:', payload.eventType);
           onContactsChange?.(payload);
        }
      )
      // Listen to wishes changes
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'wishes', filter: `user_id=eq.${userId}` }, 
        (payload) => {
           console.log('[Realtime] Wishes change:', payload.eventType);
           onWishesChange?.(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onUserChange, onContactsChange, onWishesChange]);
};
