import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import logoKop from '@/assets/logo-dua-legenda.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('password_reset_requests').insert({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      message: message.trim(),
    });
    setLoading(false);

    if (error) {
      toast({ title: 'Gagal mengirim permintaan', description: error.message, variant: 'destructive' });
      return;
    }
    setSent(true);
    toast({ title: 'Permintaan terkirim', description: 'Silakan hubungi admin untuk menerima link reset.' });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-neutral-950">
      <Card className="relative w-full max-w-md shadow-2xl border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img src={logoKop} alt="Dua Legenda" className="max-h-20 w-auto object-contain dark:invert" />
          </div>
          <CardDescription className="text-muted-foreground">
            {sent ? 'Permintaan terkirim ke admin' : 'Hubungi Admin untuk reset password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-foreground font-medium">Hubungi Admin</p>
              <p className="text-sm text-muted-foreground">
                Permintaan reset password untuk <span className="font-semibold text-foreground">{email}</span> telah
                dikirim. <strong>Silakan hubungi Admin</strong> — admin akan memberikan link reset password kepada Anda.
              </p>
              <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-left text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Langkah selanjutnya:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Hubungi Admin / atasan Anda secara langsung</li>
                  <li>Admin akan mengirim link reset password</li>
                  <li>Klik link tersebut → buat password baru</li>
                </ol>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setSent(false); setEmail(''); setFullName(''); setMessage(''); }}>
                Kirim permintaan lain
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex gap-2 text-xs text-foreground">
                <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>
                  Reset password tidak otomatis. Permintaan Anda akan dikirim ke admin, lalu admin akan memberikan
                  link reset secara manual.
                </span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap Anda" required maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Pesan ke Admin (opsional)</Label>
                <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mis. lupa password sejak kemarin" rows={2} maxLength={300} />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : 'Kirim Permintaan ke Admin'}
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-3 h-3" /> Kembali ke Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
