import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import logoKop from '@/assets/logo-dua-legenda.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    setLoading(false);

    if (error) {
      toast({ title: 'Gagal mengirim', description: error.message, variant: 'destructive' });
      return;
    }
    setSent(true);
    toast({ title: 'Email terkirim', description: 'Silakan cek inbox / folder spam Anda.' });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-neutral-950">
      <Card className="relative w-full max-w-md shadow-2xl border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img src={logoKop} alt="Dua Legenda" className="max-h-20 w-auto object-contain dark:invert" />
          </div>
          <CardDescription className="text-muted-foreground">
            {sent ? 'Cek email Anda untuk link reset' : 'Masukkan email untuk reset password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Jika email <span className="font-semibold text-foreground">{email}</span> terdaftar,
                kami telah mengirim link reset password. Link berlaku selama 1 jam.
              </p>
              <p className="text-xs text-muted-foreground">
                Tidak menerima email? Periksa folder spam atau coba lagi.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setSent(false); setEmail(''); }}>
                Kirim ulang
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  maxLength={255}
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : 'Kirim Link Reset'}
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-3 h-3" /> Kembali ke Login
            </Link>
          </div>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Lupa email? Hubungi PIC atau atasan Anda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
