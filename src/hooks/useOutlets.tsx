import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Outlet {
  id: string;
  name: string;
}

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('outlets')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setOutlets(data);
          if (data.length > 0) setSelectedOutlet(data[0].id);
        }
        setLoading(false);
      });
  }, []);

  return { outlets, selectedOutlet, setSelectedOutlet, loading };
}
