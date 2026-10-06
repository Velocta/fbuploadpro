-- Set in-app schedule post token cost to 1 token per post for all media types (text, image, video/reel)

UPDATE public.token_cost_rules
SET token_cost = 1,
    updated_at = now()
WHERE feature = 'inapp_schedule'
  AND platform = 'facebook'
  AND media_type = '*';

-- Ensure the row exists if not already present
INSERT INTO public.token_cost_rules (feature, platform, media_type, source_platform, token_cost)
SELECT 'inapp_schedule', 'facebook', '*', null, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.token_cost_rules
  WHERE feature = 'inapp_schedule'
    AND platform = 'facebook'
    AND media_type = '*'
    AND source_platform IS NULL
);
