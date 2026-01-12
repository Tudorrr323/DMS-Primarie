import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../lib/AuthService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Building } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const { profile } = await AuthService.login(email, password);

      // Redirection Logic
      if (profile.role === 'admin') {
        navigate('/admin');
      } else if (profile.role === 'angajat') {
        switch (profile.department) {
          case 'verificare_initiala':
            navigate('/verificare-initiala');
            break;
          case 'verificare_tehnica':
            navigate('/verificare-tehnica');
            break;
          case 'verificare_finala':
            navigate('/verificare-finala');
            break;
          default:
            navigate('/'); // Fallback
        }
      } else {
        // Cetatean or unknown
        navigate('/');
      }

    } catch (error) {
      console.error('Login Error:', error);
      setError(error.message);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="hidden bg-slate-900 lg:flex lg:items-center lg:justify-center">
        <div className="text-center text-white p-10">
          <Building className="mx-auto h-16 w-16 mb-4" />
          <h1 className="text-4xl font-bold">Portal DMS</h1>
          <p className="text-lg mt-2 text-slate-300">Managementul Documentelor pentru o Administrație Eficientă</p>
        </div>
      </div>
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Autentificare</h1>
            <p className="text-balance text-slate-500 dark:text-slate-400">
              Introdu datele pentru a accesa platforma.
            </p>
          </div>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Parolă</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs underline-offset-4 hover:underline text-slate-500 dark:text-slate-400"
                >
                  Ai uitat parola?
                </Link>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full">
              Intră în cont
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
            Nu ai cont?{" "}
            <Link to="/register" className="underline hover:text-slate-900 dark:hover:text-slate-200">
              Înregistrează-te
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}