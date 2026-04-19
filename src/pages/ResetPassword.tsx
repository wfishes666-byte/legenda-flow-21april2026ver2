import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import logoKop from '@/assets/logo-dua-legenda.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Wait for Supabase to process the recovery token from the URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    // Also check existing session in case event already fired
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password terlalu pendek', description: 'Minimal 6 karakter', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Password tidak cocok', description: 'Konfirmasi password berbeda', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: 'Gagal reset password', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil!', description: 'Password baru telah disimpan. Silakan login.' });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-neutral-950">
      <Card className="relative w-full max-w-md shadow-2xl border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img src={logoKop} alt="Dua Legenda" className="max-h-20 w-auto object-contain dark:invert" />
          </div>
          <CardDescription className="text-muted-foreground">
            Buat password baru Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Memverifikasi link reset...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password Baru</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Konfirmasi Password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password baru" required minLength={6} />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : 'Simpan Password Baru'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
