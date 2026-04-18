import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * ResponsiveTable: Wrapper that turns wide tables into card stacks on small screens.
 *
 * Usage:
 *   <ResponsiveTable>
 *     <table>...</table>
 *   </ResponsiveTable>
 *
 * For best results in mobile card view, build cards with <MobileCardList> directly,
 * or just wrap your existing <table> here and rely on horizontal scroll on small screens.
 */
export function ResponsiveTable({
  children,
  className,
  minWidth = 720,
}: {
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <div className={cn('w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0', className)}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/**
 * MobileCardList + MobileCard: drop-in pattern for showing list data as
 * stacked cards on mobile (use alongside a hidden md:block table).
 */
export function MobileCardList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-2 md:hidden', className)}>{children}</div>;
}

export function MobileCard({
  title,
  subtitle,
  badge,
  rows,
  actions,
  onClick,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  rows?: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border bg-card p-3 shadow-sm',
        onClick && 'active:scale-[0.99] transition cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</div>}
        </div>
        {badge}
      </div>
      {rows && rows.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {rows.map((r, i) => (
            <div key={i} className="min-w-0">
              <div className="text-muted-foreground">{r.label}</div>
              <div className="font-medium truncate">{r.value}</div>
            </div>
          ))}
        </div>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
