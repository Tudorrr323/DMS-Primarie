-- 1. Index pentru filtrarea rapidă după CATEGORIE (Urbanism, Contracte, etc.)
CREATE INDEX IF NOT EXISTS idx_documents_category 
ON public.documents(category);

-- 2. Index pentru filtrarea după DATĂ (Cele mai recente sus)
CREATE INDEX IF NOT EXISTS idx_documents_created_at 
ON public.documents(created_at);

-- 3. Index pentru filtrarea "DOSARELE MELE" (Owner)
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by 
ON public.documents(uploaded_by);

-- 4. SEARCH BAR AVANSAT (Titlu + Descriere)
-- Activăm extensia pentru căutare text (Trigrams)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index special GIN pentru căutare rapidă în Titlu (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_documents_title_search 
ON public.documents 
USING GIN (title gin_trgm_ops);

-- Index special GIN pentru căutare rapidă în Descriere
CREATE INDEX IF NOT EXISTS idx_documents_description_search 
ON public.documents 
USING GIN (description gin_trgm_ops);