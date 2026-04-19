import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type ViewMode = 'auto' | 'desktop' | 'mobile';

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  toggleMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue | undefined>(undefined);
const STORAGE_KEY = 'dl-view-mode-v1';

function loadMode(): ViewMode {
  if (typeof window === 'undefined') return 'auto';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'desktop' || v === 'mobile' || v === 'auto') return v;
  return 'auto';
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(loadMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    const root = document.documentElement;
    root.classList.remove('force-desktop', 'force-mobile');
    if (mode === 'desktop') root.classList.add('force-desktop');
    if (mode === 'mobile') root.classList.add('force-mobile');
  }, [mode]);

  const setMode = useCallback((m: ViewMode) => setModeState(m), []);
  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'mobile' ? 'desktop' : 'mobile'));
  }, []);

  return (
    <ViewModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within ViewModeProvider');
  return ctx;
}
