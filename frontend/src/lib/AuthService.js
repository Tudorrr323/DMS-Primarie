import { supabase } from '../lib/supabase';

export const AuthService = {

  // Funcția completă de Login
  async login(email, password) {
    // PASUL 1: Autentificarea standard (Email + Pass)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;

    // PASUL 2: Imediat vedem CINE este acest user (Rol + Departament)
    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')       // Luăm tot: role, department, full_name
      .eq('id', userId)  // Căutăm exact ID-ul celui care s-a logat
      .single();         // Ne așteptăm la un singur rezultat

    if (profileError) throw profileError;

    // RETURNĂM TOT PACHETUL (User Auth + Profilul din Bază)
    return {
      user: authData.user, // Date tehnice (id, email, last_sign_in)
      profile: profile     // Date de business (role, department, full_name)
    };
  },

  // Funcție de Logout
  async logout() {
    await supabase.auth.signOut();
  }
};