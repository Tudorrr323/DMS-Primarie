import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Building } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="hidden bg-slate-900 lg:flex lg:items-center lg:justify-center">
        <div className="text-center text-white p-10">
          <Building className="mx-auto h-16 w-16 mb-4" />
          <h1 className="text-4xl font-bold">Portal DMS</h1>
          <p className="text-lg mt-2 text-slate-300">Creează un cont pentru a gestiona documentele eficient.</p>
        </div>
      </div>
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-screen bg-slate-50">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Înregistrare</h1>
            <p className="text-balance text-slate-500">
              Completează formularul pentru a-ți crea un cont.
            </p>
          </div>
          {success ? (
            <div className="text-center p-4 bg-green-100 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-green-700">Înregistrare reușită!</h3>
              <p className="text-sm text-slate-600 mt-2">Te rugăm să verifici adresa de email pentru a confirma contul.</p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="full-name">Nume complet</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Nume Prenume"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@primarie.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2 relative">
                <Label htmlFor="password">Parolă</Label>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-1 right-1 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="grid gap-2 relative">
                <Label htmlFor="confirm-password">Confirmă Parola</Label>
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-1 right-1 h-7 w-7"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full">
                Creează cont
              </Button>
            </form>
          )}
          <div className="mt-4 text-center text-sm">
            Ai deja un cont?{" "}
            <Link to="/login" className="underline">
              Autentifică-te
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
