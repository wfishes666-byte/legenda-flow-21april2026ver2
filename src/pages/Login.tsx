import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const months = [
'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 20 }, (_, i) => currentYear - i);

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [nik, setNik] = useState('');
  const [joinMonth, setJoinMonth] = useState('');
  const [joinYear, setJoinYear] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      if (nik && (nik.length !== 16 || !/^\d+$/.test(nik))) {
        toast({ title: 'NIK tidak valid', description: 'NIK harus 16 digit angka', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (phone && !/^08\d{8,13}$/.test(phone)) {
        toast({ title: 'No. HP tidak valid', description: 'No. HP harus diawali 08 dan 10-15 digit', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({ title: 'Gagal mendaftar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil!', description: 'Silakan cek email untuk konfirmasi.' });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: 'Gagal masuk', description: error.message, variant: 'destructive' });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-950">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary font-sans">Dua Legenda Hub </h1>
          <CardDescription className="text-muted-foreground">
            {isSignUp ? 'Buat akun baru' : 'Masuk ke akun Anda'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp &&
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nama Lengkap</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Panggilan</Label>
                    <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nama panggilan" maxLength={50} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap" rows={2} maxLength={500} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">No. HP</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="08xxxxxxxxxx" maxLength={15} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nik">NIK</Label>
                    <Input id="nik" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="16 digit NIK" maxLength={16} />
                    <p className="text-xs text-muted-foreground">{nik.length}/16 digit</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bulan Bergabung</Label>
                    <Select value={joinMonth} onValueChange={setJoinMonth}>
                      <SelectTrigger><SelectValue placeholder="Bulan" /></SelectTrigger>
                      <SelectContent>
                        {months.map((m, i) =>
                      <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tahun Bergabung</Label>
                    <Select value={joinYear} onValueChange={setJoinYear}>
                      <SelectTrigger><SelectValue placeholder="Tahun" /></SelectTrigger>
                      <SelectContent>
                        {years.map((y) =>
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            }
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={1} />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : isSignUp ? 'Daftar' : 'Masuk'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>);

}