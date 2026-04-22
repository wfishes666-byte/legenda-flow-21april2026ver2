import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

interface PersistentDraftState<T> {
  hasStoredValue: boolean;
  value: T;
}

function loadDraft<T>(storageKey: string, initialValue: T): PersistentDraftState<T> {
  if (typeof window === 'undefined') {
    return { hasStoredValue: false, value: initialValue };
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { hasStoredValue: false, value: initialValue };
    }

    return {
      hasStoredValue: true,
      value: JSON.parse(raw) as T,
    };
  } catch {
    return { hasStoredValue: false, value: initialValue };
  }
}

export function usePersistentDraft<T>(storageKey: string, initialValue: T) {
  const initialRef = useRef(initialValue);
  const [loaded] = useState(() => loadDraft(storageKey, initialValue));
  const [value, setValue] = useState<T>(loaded.value);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);

  const clear = useCallback((nextValue?: T) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    setValue(nextValue ?? initialRef.current);
  }, [storageKey]);

  return {
    value,
    setValue: setValue as Dispatch<SetStateAction<T>>,
    clear,
    hasStoredValue: loaded.hasStoredValue,
  };
}