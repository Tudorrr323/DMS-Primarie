import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2, Mail } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const redirectUrl = window.location.origin + '/update-password';

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
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <Card className="max-w-md w-full dark:bg-slate-900 dark:border-slate-800 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold dark:text-white">Ți-ai uitat parola?</CardTitle>
          <CardDescription className="dark:text-slate-400 text-balance">
            Introdu adresa de email și îți vom trimite un link de resetare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div
              className={`p-3 mb-6 text-sm rounded-md border animate-in fade-in zoom-in-95 duration-300 ${
                message.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="dark:text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nume@exemplu.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se trimite...
                </>
              ) : (
                'Trimite Link Resetare'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Înapoi la Autentificare
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
