import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] useEffect running');
    
    const getSession = async () => {
      console.log('[AuthContext] getSession() called');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[AuthContext] Error in getSession:', error);
      }
      console.log('[AuthContext] getSession() result:', session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] onAuthStateChange triggered. Event:', _event);
      console.log('[AuthContext] onAuthStateChange session:', session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('[AuthContext] useEffect cleanup. Unsubscribing.');
      subscription.unsubscribe();
    };
  }, []);
  
  console.log('[AuthContext] Rendering provider. Loading:', loading, 'User:', user?.id);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  return useContext(AuthContext);
};