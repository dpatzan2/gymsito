-- 1. Agregamos la columna 'is_comodin' a la tabla 'check_ins' (si no existe)
ALTER TABLE public.check_ins ADD COLUMN IF NOT EXISTS is_comodin BOOLEAN DEFAULT false;
