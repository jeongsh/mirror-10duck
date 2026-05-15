-- A2 experiment: oshi_type 확장 + CP 멤버 테이블
-- 적용: Supabase MCP `apply_migration` (이름 experiment_a2_oshi_types_extend)
-- Down(폐기 시 참고):
--   DROP TABLE IF EXISTS public.oshi_pair_members;
--   ALTER TABLE public.oshi_registrations DROP COLUMN IF EXISTS affiliation, DROP COLUMN IF EXISTS reference_work;
--   ALTER TABLE public.oshi_registrations DROP CONSTRAINT IF EXISTS oshi_registrations_oshi_type_check;
--   ALTER TABLE public.oshi_registrations ADD CONSTRAINT oshi_registrations_oshi_type_check
--     CHECK (oshi_type = ANY (ARRAY['anime','manga','game','character','other']::text[]));

ALTER TABLE public.oshi_registrations DROP CONSTRAINT IF EXISTS oshi_registrations_oshi_type_check;

ALTER TABLE public.oshi_registrations
  ADD CONSTRAINT oshi_registrations_oshi_type_check
  CHECK (oshi_type = ANY (ARRAY[
    'anime'::text, 'manga'::text, 'game'::text, 'character'::text, 'other'::text,
    'voice_actor'::text, 'creator'::text, 'pair'::text, 'idol_group'::text
  ]));

ALTER TABLE public.oshi_registrations
  ADD COLUMN IF NOT EXISTS affiliation text,
  ADD COLUMN IF NOT EXISTS reference_work text;

CREATE TABLE IF NOT EXISTS public.oshi_pair_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oshi_id uuid NOT NULL REFERENCES public.oshi_registrations(id) ON DELETE CASCADE,
  member_index smallint NOT NULL CHECK (member_index IN (1, 2)),
  character_title text NOT NULL,
  direction text CHECK (
    direction IS NULL OR direction = ANY (ARRAY[
      'a_to_b'::text, 'b_to_a'::text, 'reversible'::text, 'unknown'::text
    ])
  ),
  UNIQUE (oshi_id, member_index)
);

CREATE INDEX IF NOT EXISTS idx_oshi_pair_members_oshi_id ON public.oshi_pair_members(oshi_id);

ALTER TABLE public.oshi_pair_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oshi_pair_members_select ON public.oshi_pair_members;
DROP POLICY IF EXISTS oshi_pair_members_insert ON public.oshi_pair_members;
DROP POLICY IF EXISTS oshi_pair_members_update ON public.oshi_pair_members;
DROP POLICY IF EXISTS oshi_pair_members_delete ON public.oshi_pair_members;

CREATE POLICY oshi_pair_members_select ON public.oshi_pair_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.oshi_registrations r
      WHERE r.id = oshi_pair_members.oshi_id
      AND (r.is_public OR r.user_id = auth.uid())
    )
  );

CREATE POLICY oshi_pair_members_insert ON public.oshi_pair_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.oshi_registrations r
      WHERE r.id = oshi_pair_members.oshi_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY oshi_pair_members_update ON public.oshi_pair_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.oshi_registrations r
      WHERE r.id = oshi_pair_members.oshi_id
      AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.oshi_registrations r
      WHERE r.id = oshi_pair_members.oshi_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY oshi_pair_members_delete ON public.oshi_pair_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.oshi_registrations r
      WHERE r.id = oshi_pair_members.oshi_id
      AND r.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.oshi_pair_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.oshi_pair_members TO authenticated;
