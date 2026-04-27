-- 2. Agregamos la columna 'replaced_day' a la tabla 'check_ins' (si no existe) para guardar que dia de la semana reponen
ALTER TABLE public.check_ins ADD COLUMN IF NOT EXISTS replaced_day INT;
