-- Optional outfit customisation per shoot (suit/shirt colour, tie).
-- NULL means "use the style's default clothing". Safe to re-run.
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS outfit jsonb;
