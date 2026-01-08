import { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Assuming sonner is or will be installed for toasts

export default function Profile() {
  const { user, loading: userLoading } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          
          if (error && error.code !== 'PGRST116') {
             console.error('Error fetching profile:', error);
          }

          if (data) {
            setProfileName(data.full_name);
          }
        } catch (err) {
            console.error(err);
        }
      }
    };
    fetchProfile();
  }, [user]);

  const handlePasswordReset = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`, // Redirect back to login after password reset
      });
      if (error) throw error;
      toast.success("Email de resetare a parolei trimis! Verifică-ți inbox-ul.");
    } catch (error) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return <div>Se încarcă...</div>
  }

  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Profilul meu</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Gestionează detaliile contului și setările de securitate.</p>
      </div>

      {/* User Details Card */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="dark:text-slate-100">Detalii Cont</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name" className="dark:text-slate-300">Nume complet</Label>
              <Input id="full-name" value={profileName || user?.user_metadata?.full_name || 'N/A'} readOnly disabled className="dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-slate-300">Adresă de email</Label>
              <Input id="email" value={user?.email || ''} readOnly disabled className="dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
