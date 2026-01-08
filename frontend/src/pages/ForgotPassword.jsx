import { useState } from 'react';
import { supabase } from '../lib/supabase'; // <--- Verifică să fie calea corectă către clientul tău
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 1. Detectăm automat URL-ul (localhost sau vercel)
      // Va rezulta ceva de genul: "http://localhost:5173/update-password"
      const redirectUrl = window.location.origin + '/update-password';

      // 2. Trimitem cererea la Supabase (care o trimite la Resend)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Ți-am trimis un email! Verifică și folderul Spam.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'A apărut o eroare.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 shadow-lg rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Ți-ai uitat parola?</h2>
        <p className="text-gray-500 text-center mb-6">
          Introdu adresa de email și îți vom trimite un link de resetare.
        </p>

        {message && (
          <div
            className={`p-3 mb-4 text-sm rounded border ${
              message.type === 'success'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-red-100 text-red-700 border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="nume@exemplu.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Se trimite...' : 'Trimite Link Resetare'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            Înapoi la Autentificare
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;