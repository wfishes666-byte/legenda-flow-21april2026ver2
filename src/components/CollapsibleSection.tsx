import { useState, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface CollapsibleSectionProps {
  title: ReactNode;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
  /** default open on desktop, default closed on mobile (overrides if provided) */
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Card section that auto-collapses on mobile, expands on desktop.
 * Use to break long forms into digestible chunks.
 */
export function CollapsibleSection({
  title,
  icon,
  rightSlot,
  children,
  defaultOpen,
  className,
  contentClassName,
}: CollapsibleSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen ?? !isMobile);

  // Sync default with viewport on first measurement
  useEffect(() => {
    if (defaultOpen === undefined) setOpen(!isMobile);
  }, [isMobile, defaultOpen]);

  return (
    <Card className={cn('glass-card overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span className="font-semibold text-base break-words min-w-0">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot && (
            <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
              {rightSlot}
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-5 h-5 text-muted-foreground transition-transform duration-200 pointer-events-none',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>
      {open && (
        <div className={cn('px-4 sm:px-6 pb-4 sm:pb-6', contentClassName)}>{children}</div>
      )}
    </Card>
  );
}
