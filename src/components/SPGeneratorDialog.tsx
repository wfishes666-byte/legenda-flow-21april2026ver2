import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, RotateCcw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SPGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultPosition?: string;
  defaultPoints?: number;
  defaultReason?: string;
  defaultSpStatus?: string; // 'SP-1' | 'SP-2' | 'SP-3' | 'Non-SP'
  userId?: string; // employee user_id for history logging
  onPrinted?: () => void;
}

const DEFAULT_TEXT = {
  sanksi1: 'Saudara tidak berhak mendapatkan bonus apapun dan tidak berhak mengajukan cuti.',
  sanksi2: 'Saudara tidak berhak mendapatkan bonus, tidak berhak mengajukan cuti, dan mendapatkan pemotongan gaji sebesar 10%.',
  sanksi3: 'Pemutusan hubungan kerja (PHK) dikarenakan poin pelanggaran tata tertib telah mencapai batas maksimal 10 poin.',
  harapan: 'Dengan ini kami dari pihak manajemen berharap saudara tidak mengulangi kesalahan tersebut dan lebih baik dalam performance pekerjaan terutama di kedisplinan jam kedatangan dan kepatuhan terhadap SOP yang berlaku.',
};

const DEFAULT_PAPER = { width: 210, height: 297, mt: 25.4, mb: 25.4, ml: 30, mr: 25.4 };

export default function SPGeneratorDialog({
  open, onOpenChange,
  defaultName = '', defaultPosition = '', defaultPoints = 0, defaultReason = '', defaultSpStatus,
}: SPGeneratorDialogProps) {
  const [nama, setNama] = useState(defaultName);
  const [jabatan, setJabatan] = useState(defaultPosition);
  const [poin, setPoin] = useState<number>(defaultPoints);
  const [penjabaran, setPenjabaran] = useState(defaultReason);

  const [text, setText] = useState(DEFAULT_TEXT);
  const [paper, setPaper] = useState(DEFAULT_PAPER);
  const [nomor] = useState(() => Math.floor(10000 + Math.random() * 90000));

  useEffect(() => {
    if (open) {
      setNama(defaultName);
      setJabatan(defaultPosition);
      setPoin(defaultPoints);
      setPenjabaran(defaultReason);
    }
  }, [open, defaultName, defaultPosition, defaultPoints, defaultReason]);

  // Determine SP level from points (or from explicit defaultSpStatus override)
  const spLevel = useMemo(() => {
    if (defaultSpStatus === 'SP-1') return 1;
    if (defaultSpStatus === 'SP-2') return 2;
    if (defaultSpStatus === 'SP-3') return 3;
    if (poin >= 10) return 3;
    if (poin >= 7) return 2;
    if (poin >= 1) return 1;
    return 1;
  }, [poin, defaultSpStatus]);

  const sanksiText = spLevel === 3 ? text.sanksi3 : spLevel === 2 ? text.sanksi2 : text.sanksi1;
  const judul = `SURAT PERINGATAN KE-${spLevel}`;
  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateNo = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;

  const handlePrint = () => {
    const css = `
      @page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }
      html, body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; color: #000; }
      .sheet {
        width: ${paper.width}mm; min-height: ${paper.height}mm;
        padding: ${paper.mt}mm ${paper.mr}mm ${paper.mb}mm ${paper.ml}mm;
        box-sizing: border-box; display: flex; flex-direction: column; line-height: 1.4;
      }
      .center { text-align: center; }
      .right { text-align: right; }
      .justify { text-align: justify; }
      .uppercase { text-transform: uppercase; }
      .bold { font-weight: 700; }
      .title { font-size: 24px; letter-spacing: 0.4em; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 24px; }
      .judul { display: inline-block; border-bottom: 1px solid #000; font-size: 18px; padding: 0 16px; }
      .nomor { margin-top: 4px; font-size: 13px; letter-spacing: 0.05em; }
      table.info { width: 100%; font-size: 13px; margin-left: 8px; border-collapse: collapse; }
      table.info td { padding: 4px 0; vertical-align: top; }
      table.info td:first-child { width: 120px; color: #334155; }
      .box-sanksi { padding: 14px; background: #f8fafc; border-left: 6px solid #0f172a; font-size: 13px; margin-bottom: 16px; }
      .box-sanksi .head { font-weight: 700; text-decoration: underline; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
      .box-sanksi p { font-style: italic; font-weight: 600; margin: 0; }
      p { font-size: 13px; margin: 0 0 14px; }
      .ttd { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; gap: 8px; margin-top: auto; padding-top: 16px; }
      .ttd .col { padding: 0 4px; }
      .ttd .label { font-size: 12px; text-transform: uppercase; color: #334155; margin-bottom: 64px; }
      .ttd .name { border-top: 1px solid #000; padding-top: 4px; font-weight: 700; text-transform: uppercase; font-size: 9px; }
    `;

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>${judul} - ${nama || 'Karyawan'}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap">
      <style>${css}</style></head>
      <body>
        <div class="sheet">
          <div class="center bold title uppercase">DUA LEGENDA</div>
          <div class="center" style="margin-bottom:24px">
            <div class="bold judul uppercase">${judul}</div>
            <div class="nomor">Nomor: SP-${nomor}/I/HRD-HQDL/${dateNo}</div>
          </div>
          <div class="right" style="margin-bottom:20px;font-size:13px">Malang, ${dateStr}</div>
          <p class="justify">Bahwa untuk penegakan disiplin dan kinerja karyawan, nama yang tercantum di bawah ini:</p>
          <table class="info" style="margin-bottom:14px">
            <tr><td>Nama</td><td style="width:12px">:</td><td class="bold uppercase">${nama || '......................'}</td></tr>
            <tr><td>Bagian</td><td>:</td><td class="uppercase">${jabatan || '......................'}</td></tr>
          </table>
          <p class="justify">Dengan kesalahan indispliner presensi hingga mencapai ${poin} poin tata tertib dengan ${penjabaran || '(penjabaran kesalahan)'}.</p>
          <div class="box-sanksi">
            <div class="head">Sanksi Pelanggaran:</div>
            <p>${sanksiText}</p>
          </div>
          <p class="justify">Surat ini dibuat agar dapat dipahami dan menjadi dokumen resmi dalam pelaksanaan proses administrasi. Surat peringatan ini akan hangus bila dalam jangka waktu 1 bulan saudara merubah sikap dan tidak membuat kesalahan maupun menambah poin dan bila mengulangi dan menambah poin hingga 7 maka otomatis akan lanjut ke SP2.</p>
          <p class="justify">${text.harapan}</p>
          <p class="justify">Demikian surat ini kami sampaikan atas perhatian dan pengertiannya kami sampaikan terima kasih.</p>
          <div class="ttd">
            <div class="col"><div class="label">Diberikan Oleh,</div><div class="name">QC People Dua Legenda</div></div>
            <div class="col"><div class="label">Mengetahui,</div><div class="name">GA Dua Legenda</div></div>
            <div class="col"><div class="label">Penerima,</div><div class="name">${nama || '......................'}</div></div>
          </div>
        </div>
        <script>window.onload = () => { setTimeout(() => { window.print(); }, 250); };</script>
      </body></html>
    `;

    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const resetA4 = () => setPaper(DEFAULT_PAPER);
  const resetText = () => setText(DEFAULT_TEXT);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Generator Surat Peringatan
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 overflow-hidden flex-1">
          {/* Left: tabs */}
          <div className="overflow-y-auto pr-2">
            <Tabs defaultValue="input">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="input">Input</TabsTrigger>
                <TabsTrigger value="teks">Teks</TabsTrigger>
                <TabsTrigger value="cetak">Cetak</TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="space-y-3 mt-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Nama Lengkap</Label>
                  <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Aditya Putri Wijaya" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Jabatan / Bagian</Label>
                  <Input value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Crew Warkop Tarkam" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Jumlah Poin Pelanggaran</Label>
                  <Input type="number" min={0} value={poin} onChange={(e) => setPoin(parseInt(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Otomatis: SP-{spLevel} {spLevel === 3 ? '(PHK)' : spLevel === 2 ? '(7-9 poin)' : '(<7 poin)'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Penjabaran Poin</Label>
                  <Textarea rows={3} value={penjabaran} onChange={(e) => setPenjabaran(e.target.value)} placeholder="contoh: poin keterlambatan & izin tanpa keterangan" />
                </div>
                <Button onClick={handlePrint} className="w-full mt-2">
                  <Printer className="w-4 h-4 mr-2" /> Cetak Surat (PDF)
                </Button>
              </TabsContent>

              <TabsContent value="teks" className="space-y-3 mt-4 text-sm">
                <div className="space-y-1">
                  <Label className="text-xs">Sanksi SP-1 (&lt;7 Poin)</Label>
                  <Textarea rows={2} value={text.sanksi1} onChange={(e) => setText({ ...text, sanksi1: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sanksi SP-2 (7-9 Poin)</Label>
                  <Textarea rows={2} value={text.sanksi2} onChange={(e) => setText({ ...text, sanksi2: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-destructive">Sanksi SP-3 (≥10 Poin)</Label>
                  <Textarea rows={2} value={text.sanksi3} onChange={(e) => setText({ ...text, sanksi3: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Harapan Manajemen</Label>
                  <Textarea rows={4} value={text.harapan} onChange={(e) => setText({ ...text, harapan: e.target.value })} />
                </div>
                <Button variant="outline" className="w-full" onClick={resetText}><RotateCcw className="w-4 h-4 mr-2" /> Reset Teks Default</Button>
              </TabsContent>

              <TabsContent value="cetak" className="space-y-3 mt-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Lebar (mm)</Label>
                    <Input type="number" value={paper.width} onChange={(e) => setPaper({ ...paper, width: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tinggi (mm)</Label>
                    <Input type="number" value={paper.height} onChange={(e) => setPaper({ ...paper, height: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Margin Atas</Label><Input type="number" step="0.1" value={paper.mt} onChange={(e) => setPaper({ ...paper, mt: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Margin Bawah</Label><Input type="number" step="0.1" value={paper.mb} onChange={(e) => setPaper({ ...paper, mb: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Margin Kiri</Label><Input type="number" step="0.1" value={paper.ml} onChange={(e) => setPaper({ ...paper, ml: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Margin Kanan</Label><Input type="number" step="0.1" value={paper.mr} onChange={(e) => setPaper({ ...paper, mr: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <Button variant="outline" className="w-full" onClick={resetA4}><RotateCcw className="w-4 h-4 mr-2" /> Reset Standar A4</Button>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: live preview */}
          <div className="overflow-auto bg-slate-200 rounded-lg p-4">
            <div
              className="bg-white shadow-2xl mx-auto text-black flex flex-col"
              style={{
                width: `${paper.width}mm`,
                minHeight: `${paper.height}mm`,
                padding: `${paper.mt}mm ${paper.mr}mm ${paper.mb}mm ${paper.ml}mm`,
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.4,
                transform: 'scale(0.78)',
                transformOrigin: 'top center',
              }}
            >
              <div className="text-center font-bold text-2xl mb-6 tracking-[0.4em] uppercase border-b-2 border-black pb-1">DUA LEGENDA</div>
              <div className="text-center mb-6">
                <div className="font-bold border-b border-black inline-block text-lg uppercase px-4">{judul}</div>
                <div className="mt-1 text-sm tracking-wider font-medium">Nomor: SP-{nomor}/I/HRD-HQDL/{dateNo}</div>
              </div>
              <div className="text-right mb-6 text-sm">Malang, {dateStr}</div>
              <p className="mb-3 text-sm text-justify">Bahwa untuk penegakan disiplin dan kinerja karyawan, nama yang tercantum di bawah ini:</p>
              <table className="w-full text-sm ml-2 mb-4">
                <tbody>
                  <tr><td className="w-32 py-1 align-top text-slate-700">Nama</td><td className="py-1 w-4">:</td><td className="py-1 font-bold uppercase">{nama || '......................'}</td></tr>
                  <tr><td className="py-1 text-slate-700">Bagian</td><td className="py-1 w-4">:</td><td className="py-1 uppercase">{jabatan || '......................'}</td></tr>
                </tbody>
              </table>
              <p className="mb-4 text-sm text-justify">Dengan kesalahan indispliner presensi hingga mencapai {poin} poin tata tertib dengan {penjabaran || '(penjabaran kesalahan)'}.</p>
              <div className="mb-4 p-4 bg-slate-50 border-l-[6px] border-slate-900 text-sm">
                <div className="font-bold mb-1 underline text-xs uppercase tracking-wider">Sanksi Pelanggaran:</div>
                <p className="text-justify text-slate-800 font-semibold italic">{sanksiText}</p>
              </div>
              <p className="mb-4 text-sm text-justify">Surat ini dibuat agar dapat dipahami dan menjadi dokumen resmi dalam pelaksanaan proses administrasi. Surat peringatan ini akan hangus bila dalam jangka waktu 1 bulan saudara merubah sikap dan tidak membuat kesalahan maupun menambah poin dan bila mengulangi dan menambah poin hingga 7 maka otomatis akan lanjut ke SP2.</p>
              <p className="mb-4 text-sm text-justify">{text.harapan}</p>
              <p className="mb-8 text-sm text-justify">Demikian surat ini kami sampaikan atas perhatian dan pengertiannya kami sampaikan terima kasih.</p>
              <div className="grid grid-cols-3 text-center mt-auto items-end pt-4 gap-2">
                <div className="px-1"><p className="mb-16 text-slate-700 text-xs uppercase font-medium">Diberikan Oleh,</p><div className="border-t border-black pt-1"><p className="font-bold uppercase text-[9px]">QC People Dua Legenda</p></div></div>
                <div className="px-1"><p className="mb-16 text-slate-700 text-xs uppercase font-medium">Mengetahui,</p><div className="border-t border-black pt-1"><p className="font-bold uppercase text-[9px]">GA Dua Legenda</p></div></div>
                <div className="px-1"><p className="mb-16 text-slate-700 text-xs uppercase font-medium">Penerima,</p><div className="border-t border-black pt-1"><p className="font-bold uppercase text-[9px]">{nama || '......................'}</p></div></div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
