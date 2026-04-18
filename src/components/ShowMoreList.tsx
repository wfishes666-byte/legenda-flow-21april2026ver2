import { useState, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ShowMoreListProps<T> {
  items: T[];
  initial?: number;
  step?: number;
  renderItem: (item: T, index: number) => ReactNode;
  emptyMessage?: string;
  /** When provided, wraps the visible slice (e.g. <table><tbody>...) */
  wrapper?: (children: ReactNode) => ReactNode;
}

/**
 * Renders a paginated/expandable list. Shows `initial` items by default,
 * with a "Lihat semua / Sembunyikan" toggle when there are more.
 */
export function ShowMoreList<T>({
  items,
  initial = 5,
  step,
  renderItem,
  emptyMessage = 'Belum ada data.',
  wrapper,
}: ShowMoreListProps<T>) {
  const [shown, setShown] = useState(initial);

  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-6">{emptyMessage}</p>
    );
  }

  const visible = items.slice(0, shown);
  const hasMore = items.length > shown;
  const isExpanded = shown >= items.length;
  const rendered = visible.map(renderItem);

  return (
    <>
      {wrapper ? wrapper(rendered) : rendered}
      {(hasMore || isExpanded) && items.length > initial && (
        <div className="flex justify-center pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isExpanded) setShown(initial);
              else if (step) setShown((s) => Math.min(s + step, items.length));
              else setShown(items.length);
            }}
            className="gap-1 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> Sembunyikan
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> Lihat semua ({items.length - shown} lagi)
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );
}
