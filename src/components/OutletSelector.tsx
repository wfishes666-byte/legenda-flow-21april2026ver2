import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Store } from 'lucide-react';

interface Outlet {
  id: string;
  name: string;
}

interface OutletSelectorProps {
  outlets: Outlet[];
  selectedOutlet: string;
  onSelect: (id: string) => void;
}

export default function OutletSelector({ outlets, selectedOutlet, onSelect }: OutletSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <Store className="w-4 h-4 text-muted-foreground" />
      <Label className="text-sm text-muted-foreground whitespace-nowrap">Cabang:</Label>
      <Select value={selectedOutlet} onValueChange={onSelect}>
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="Pilih cabang" />
        </SelectTrigger>
        <SelectContent>
          {outlets.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
