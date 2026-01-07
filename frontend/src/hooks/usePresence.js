import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const CHANNEL_NAME = 'system-presence';

export function usePresence() {
  const { user } = useAuthContext();
  const location = useLocation();
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    if (!user) return;

    // 1. Definim canalul
    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // 2. Ascultăm evenimentele de Sync (Când se schimbă lista)
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        setOnlineUsers(newState);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 3. Ne anunțăm prezența inițială
          await channel.track({
            user_id: user.id,
            email: user.email,
            online_at: new Date().toISOString(),
            current_path: location.pathname,
            is_admin: false // Putem lua din profil dacă avem
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user]); // Re-connect only on user change (Login/Logout)

  // 4. Actualizăm starea când ne mutăm pe altă pagină
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase.channel(CHANNEL_NAME);
    // Nu putem face track direct pe un canal existent fără referință?
    // Supabase client gestionează canalele singleton.
    
    // De fapt, trebuie să actualizăm starea pe canalul DEJA deschis.
    // Dar hook-ul de sus creează un canal nou la fiecare mount dacă nu e singleton.
    // Soluția corectă: usePresence trebuie să fie apelat într-un context global sau să gestioneze canalul global.
    
    // Pentru simplitate, vom face re-track pe un canal nou efemer doar pentru update? Nu.
    // Trebuie ca acest hook să fie folosit DOAR în Layout principal.
    
    // Dar logica de update trebuie să fie aici.
    
    // Hack: Luăm canalul din cache-ul clientului supabase
    const existingChannel = supabase.getChannels().find(c => c.topic === CHANNEL_NAME);
    
    if (existingChannel && existingChannel.state === 'joined') {
        // Luăm informațiile din profil (ar trebui să le avem în context, dar momentan luăm basic)
        existingChannel.track({
            user_id: user.id,
            email: user.email,
            online_at: new Date().toISOString(),
            current_path: location.pathname,
        });
    }

  }, [location, user]);

  return onlineUsers;
}
