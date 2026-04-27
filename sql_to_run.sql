-- 1. Permitir que los usuarios inserten su propio perfil (Upsert)
CREATE POLICY "Permitir insert a usuarios autenticados" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Asegurarnos que la política de UPDATE exista
CREATE POLICY "Permitir update a usuarios autenticados" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. (Opcional pero recomendado) Insertar los perfiles que faltan de los usuarios de Auth que ya se registraron
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
  id, 
  raw_user_meta_data->>'full_name', 
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
