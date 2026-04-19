import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useViewMode } from '@/hooks/useViewMode';

interface ViewModeToggleProps {
  variant?: 'sidebar' | 'default';
}

export default function ViewModeToggle({ variant = 'default' }: ViewModeToggleProps) {
  const { mode, toggleMode } = useViewMode();
  const isMobile = mode === 'mobile';

  if (variant === 'sidebar') {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent/50"
        onClick={toggleMode}
        title={isMobile ? 'Beralih ke tampilan desktop' : 'Beralih ke tampilan mobile'}
      >
        {isMobile ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        {isMobile ? 'Mode Desktop' : 'Mode Mobile'}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="icon" onClick={toggleMode} aria-label="Toggle view mode">
      {isMobile ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
    </Button>
  );
}
