import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const UpdatePassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast.error("Eroare la schimbarea parolei: " + error.message);
      setLoading(false);
    } else {
      toast.success("Parola a fost schimbată cu succes!");
      navigate('/login'); 
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <Card className="max-w-md w-full dark:bg-slate-900 dark:border-slate-800 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <KeyRound className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold dark:text-white">Setează Parola Nouă</CardTitle>
          <CardDescription className="dark:text-slate-400">
            Alege o parolă sigură pentru a-ți proteja contul.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="password" name="Parolă Nouă" className="dark:text-slate-200">Parolă Nouă</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minim 6 caractere"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                'Salvează Parola'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;
