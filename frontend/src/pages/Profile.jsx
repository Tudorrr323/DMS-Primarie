import { useState } from 'react';
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
  const [newEmail, setNewEmail] = useState('');

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

  const handleEmailChange = async (e) => {
    e.preventDefault();
    if (!user || !newEmail) return;
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Email de confirmare trimis! Verifică-ți noul inbox pentru a confirma schimbarea.");
      setNewEmail(''); // Clear input
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
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Profilul meu</h2>
        <p className="text-slate-500 mt-1">Gestionează detaliile contului și setările de securitate.</p>
      </div>

      {/* User Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Detalii Cont</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Nume complet</Label>
              <Input id="full-name" value={user?.user_metadata?.full_name || 'N/A'} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresă de email</Label>
              <Input id="email" value={user?.email || ''} readOnly disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Email Card */}
      <Card>
        <CardHeader>
          <CardTitle>Schimbă Adresa de Email</CardTitle>
          <CardDescription>
            Vom trimite un link de confirmare pe noua adresă de email pentru a finaliza schimbarea.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleEmailChange}>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="new-email">Adresă de email nouă</Label>
              <Input 
                id="new-email" 
                type="email" 
                placeholder="nume.nou@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Se salvează...' : 'Salvează email nou'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>Schimbă Parola</CardTitle>
          <CardDescription>
            Vei primi un email cu instrucțiuni pentru a-ți reseta parola.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handlePasswordReset} disabled={loading}>
            {loading ? 'Se trimite...' : 'Trimite email de resetare'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
