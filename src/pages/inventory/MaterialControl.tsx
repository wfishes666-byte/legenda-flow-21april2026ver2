import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Beaker, Plus, Trash2 } from 'lucide-react';

interface IngredientRow {
  name: string;
  qty: string;
  unit: string;
}

export default function MaterialControlPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const canEdit = role === 'management' || role === 'pic' || role === 'stockman';
  const [recipes, setRecipes] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  // Recipe form
  const [menuItem, setMenuItem] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ name: '', qty: '', unit: 'gram' }]);
  const [portions, setPortions] = useState('1');

  // Sales form
  const [saleItem, setSaleItem] = useState('');
  const [qtySold, setQtySold] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data: r } = await supabase.from('recipes').select('*').order('menu_item_name');
    if (r) setRecipes(r);
    const { data: s } = await supabase.from('daily_sales').select('*').order('sale_date', { ascending: false }).limit(200);
    if (s) setSales(s);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const ingredientsData = ingredients.filter(i => i.name.trim()).map(i => ({ name: i.name, qty: parseFloat(i.qty) || 0, unit: i.unit }));
    const { error } = await supabase.from('recipes').insert({
      menu_item_name: menuItem,
      outlet_id: selectedOutlet,
      ingredients: ingredientsData,
      portions: parseInt(portions) || 1,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Resep tersimpan.' });
      setMenuItem(''); setIngredients([{ name: '', qty: '', unit: 'gram' }]); setPortions('1');
      fetchData();
    }
    setSubmitting(false);
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('daily_sales').insert({
      menu_item_name: saleItem,
      qty_sold: parseInt(qtySold) || 0,
      sale_date: saleDate,
      outlet_id: selectedOutlet,
      recorded_by: user.id,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Penjualan tercatat.' });
      setSaleItem(''); setQtySold('');
      fetchData();
    }
    setSubmitting(false);
  };

  const addIngredient = () => setIngredients([...ingredients, { name: '', qty: '', unit: 'gram' }]);
  const removeIngredient = (idx: number) => setIngredients(ingredients.filter((_, i) => i !== idx));
  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) => {
    const updated = [...ingredients]; updated[idx][field] = value; setIngredients(updated);
  };

  // Calculate material usage vs actual
  const calcUsage = () => {
    const recipeMap = new Map(recipes.map(r => [r.menu_item_name, r]));
    const materialUsage: Record<string, { expected: number; unit: string }> = {};

    sales.forEach(sale => {
      const recipe = recipeMap.get(sale.menu_item_name);
      if (!recipe) return;
      const ings = recipe.ingredients as { name: string; qty: number; unit: string }[];
      ings?.forEach(ing => {
        if (!materialUsage[ing.name]) materialUsage[ing.name] = { expected: 0, unit: ing.unit };
        materialUsage[ing.name].expected += (ing.qty / (recipe.portions || 1)) * sale.qty_sold;
      });
    });

    return materialUsage;
  };

  const usage = calcUsage();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <Beaker className="w-7 h-7" /> Kontrol Bahan Baku
          </h1>
          <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
        </div>

        <Tabs defaultValue="usage">
          <TabsList>
            <TabsTrigger value="usage">Kontrol Penggunaan</TabsTrigger>
            <TabsTrigger value="recipes">Resep</TabsTrigger>
            <TabsTrigger value="sales">Penjualan Harian</TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">Estimasi Penggunaan Bahan</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(usage).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada data. Input resep dan penjualan terlebih dahulu.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-3 font-medium">Bahan</th>
                          <th className="p-3 font-medium">Estimasi Penggunaan</th>
                          <th className="p-3 font-medium">Satuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(usage).map(([name, data]) => (
                          <tr key={name} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-3 font-medium">{name}</td>
                            <td className="p-3">{data.expected.toFixed(1)}</td>
                            <td className="p-3">{data.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipes">
            {canEdit && (
              <Card className="glass-card mb-4">
                <CardHeader><CardTitle className="text-lg">Input Resep</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleRecipeSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nama Menu</Label>
                        <Input value={menuItem} onChange={(e) => setMenuItem(e.target.value)} placeholder="Contoh: Es Kopi Susu" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Porsi per Resep</Label>
                        <Input type="number" value={portions} onChange={(e) => setPortions(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Bahan-bahan</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addIngredient}><Plus className="w-3 h-3 mr-1" /> Bahan</Button>
                      </div>
                      {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <Input className="flex-1" placeholder="Nama bahan" value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} />
                          <Input className="w-20" type="number" placeholder="Qty" value={ing.qty} onChange={(e) => updateIngredient(idx, 'qty', e.target.value)} />
                          <Input className="w-20" placeholder="Satuan" value={ing.unit} onChange={(e) => updateIngredient(idx, 'unit', e.target.value)} />
                          {ingredients.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(idx)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full">Simpan Resep</Button>
                  </form>
                </CardContent>
              </Card>
            )}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">Daftar Resep</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {recipes.map((r) => (
                  <div key={r.id} className="p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium">{r.menu_item_name} <span className="text-xs text-muted-foreground">({r.portions} porsi)</span></p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(r.ingredients as any[])?.map((ing: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{ing.name}: {ing.qty} {ing.unit}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {recipes.length === 0 && <p className="text-sm text-muted-foreground">Belum ada resep.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            {canEdit && (
              <Card className="glass-card mb-4">
                <CardHeader><CardTitle className="text-lg">Input Penjualan Harian</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleSaleSubmit} className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Menu Item</Label>
                      <Input value={saleItem} onChange={(e) => setSaleItem(e.target.value)} placeholder="Nama menu" required />
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>Jumlah</Label>
                      <Input type="number" value={qtySold} onChange={(e) => setQtySold(e.target.value)} required />
                    </div>
                    <div className="w-36 space-y-2">
                      <Label>Tanggal</Label>
                      <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" disabled={submitting}>Simpan</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">Riwayat Penjualan</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">Tanggal</th>
                        <th className="p-3 font-medium">Menu</th>
                        <th className="p-3 font-medium">Terjual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3">{s.sale_date}</td>
                          <td className="p-3">{s.menu_item_name}</td>
                          <td className="p-3 font-bold">{s.qty_sold}</td>
                        </tr>
                      ))}
                      {sales.length === 0 && (
                        <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Belum ada data penjualan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
