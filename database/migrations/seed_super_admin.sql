-- Replace 'YOUR_EMAIL_HERE' with the exact email you used in Supabase Auth
INSERT INTO public.users (
  id, 
  email, 
  name, 
  role, 
  is_active_override
)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Super Admin'), -- Fallback name if metadata is empty
  'super_admin',
  true
FROM auth.users
WHERE email = 'shahzebpy@gmail.com' -- <--- PUT YOUR EMAIL HERE
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin',
  is_active_override = true;
