import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sinkronkan tab aktif dengan URL search param (default key: "tab").
 *
 * Manfaat:
 * - Pindah tab tidak memicu reload halaman (hanya update query string).
 * - Refresh / share link tetap di tab yang sama.
 * - Browser back/forward berfungsi natural.
 *
 * Pakai bersama komponen <Tabs value={tab} onValueChange={setTab} />.
 */
export function useTabParam(defaultValue: string, key = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = useMemo(() => {
    const v = searchParams.get(key);
    return v && v.length > 0 ? v : defaultValue;
  }, [searchParams, key, defaultValue]);

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (!next || next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, key, defaultValue],
  );

  return [tab, setTab] as const;
}
