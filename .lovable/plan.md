
## Tujuan
Mengganti tampilan tab outlet di **Penilaian Kinerja** agar persis sama dengan tab outlet di **Rekap Absensi** (Attendance).

## Perbandingan

**Sekarang (Penilaian Kinerja)** — pill-style:
- Card terpisah dengan ikon Store + tombol bulat (rounded-full) berwarna primary saat aktif

**Target (Rekap Absensi)** — underline-style:
- Komponen `Tabs` dari shadcn dengan `TabsList` transparan, garis bawah border, dan tab aktif ditandai garis bawah primary (tanpa background)

## Perubahan

**File:** `src/pages/personalia/PerformanceReview.tsx`

1. **Hapus blok pill** (Card + tombol rounded-full di baris 267–291).
2. **Tambah import** `Tabs, TabsList, TabsTrigger` dari `@/components/ui/tabs`.
3. **Ganti dengan underline tabs** persis style Attendance:
   ```tsx
   <Tabs value={outletId} onValueChange={setOutletId}>
     <TabsList className="flex-wrap h-auto bg-transparent border-b border-border w-full justify-start rounded-none p-0">
       <TabsTrigger value={ALL} className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none">
         Semua
       </TabsTrigger>
       {outlets.map((o) => (
         <TabsTrigger key={o.id} value={o.id} className="...same classes...">
           {o.name}
         </TabsTrigger>
       ))}
     </TabsList>
   </Tabs>
   ```
4. **Pertahankan opsi "Semua"** sebagai tab pertama agar fungsi filter saat ini tetap jalan (Attendance tidak punya "Semua" karena memang per-outlet, tapi di Penilaian Kinerja "Semua" perlu dipertahankan agar tidak mengubah behavior).
5. Hapus variabel `outletPills` dan import `Store` jika tidak dipakai lagi.

## Hasil
Tab outlet di Penilaian Kinerja akan tampil sebagai deretan teks dengan garis bawah primary pada tab aktif — identik dengan tab outlet di Rekap Absensi.
