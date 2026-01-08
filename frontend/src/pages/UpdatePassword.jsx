import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const UpdatePassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Opțional: Verificăm sesiunea la încărcare
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log("Utilizatorul este în modul de recuperare.");
      }
    });
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Actualizăm parola utilizatorului logat temporar
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      alert("Eroare la schimbarea parolei: " + error.message);
      setLoading(false);
    } else {
      alert("Parola a fost schimbată cu succes!");
      // Îl trimitem la pagina principală sau Dashboard
      navigate('/'); 
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 shadow-lg rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Setează Parola Nouă</h2>
        
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parola Nouă</label>
            <input
              type="password"
              placeholder="Minim 6 caractere"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Se salvează...' : 'Salvează Parola'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;