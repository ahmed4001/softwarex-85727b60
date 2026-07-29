DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'cryptoman3020@gmail.com';
  IF uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'superadmin')
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;
  END IF;
END $$;