
-- Table for note archive metadata
CREATE TABLE public.note_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  note_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  file_url text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_archives_outlet_date ON public.note_archives(outlet_id, note_date DESC);
CREATE INDEX idx_note_archives_uploaded_by ON public.note_archives(uploaded_by);

ALTER TABLE public.note_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access note_archives"
  ON public.note_archives FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Management full access note_archives"
  ON public.note_archives FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "PIC view note_archives (own outlet)"
  ON public.note_archives FOR SELECT
  USING (has_role(auth.uid(), 'pic'::app_role) AND pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC insert note_archives (own outlet)"
  ON public.note_archives FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'pic'::app_role) AND pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC update note_archives (own outlet)"
  ON public.note_archives FOR UPDATE
  USING (has_role(auth.uid(), 'pic'::app_role) AND pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC delete note_archives (own outlet)"
  ON public.note_archives FOR DELETE
  USING (has_role(auth.uid(), 'pic'::app_role) AND pic_can_access_outlet(outlet_id));

CREATE POLICY "Authenticated view note_archives"
  ON public.note_archives FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert own note_archives"
  ON public.note_archives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Owner update own note_archives"
  ON public.note_archives FOR UPDATE
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Owner delete own note_archives"
  ON public.note_archives FOR DELETE
  USING (auth.uid() = uploaded_by);

CREATE TRIGGER trg_note_archives_updated_at
  BEFORE UPDATE ON public.note_archives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_note_archives_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.note_archives
  FOR EACH ROW EXECUTE FUNCTION public.log_table_activity('Galeri Arsip Nota');

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-archives', 'note-archives', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read note-archives"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'note-archives');

CREATE POLICY "Authenticated upload note-archives"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'note-archives');

CREATE POLICY "Authenticated update own note-archives"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'note-archives' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated delete own note-archives"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'note-archives' AND auth.uid()::text = (storage.foldername(name))[1]);
