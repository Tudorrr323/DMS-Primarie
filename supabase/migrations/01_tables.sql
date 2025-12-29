-- NUME FISIER: 01_tables.sql

-- A. CURĂȚENIE (Doar dacă vrei reset total, altfel comentează liniile cu DROP TABLE)
DROP TABLE IF EXISTS public.signatures CASCADE;
DROP TABLE IF EXISTS public.workflow_history CASCADE;
DROP TABLE IF EXISTS public.document_files CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS workflow_stage CASCADE;
DROP TYPE IF EXISTS department_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- B. CREARE TIPURI
CREATE TYPE user_role AS ENUM ('admin', 'angajat', 'cetatean');
CREATE TYPE department_type AS ENUM ('verificare_initiala', 'verificare_tehnica', 'verificare_finala');
CREATE TYPE workflow_stage AS ENUM ('submitted', 'review_step1', 'review_step2', 'review_step3', 'completed', 'rejected');

-- C. CREARE TABELE
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  role user_role DEFAULT 'cetatean',
  department department_type,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text, 
  workflow_stage workflow_stage DEFAULT 'submitted',
  current_assignee uuid REFERENCES public.profiles(id),
  uploaded_by uuid REFERENCES auth.users NOT NULL,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.document_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  is_signed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.workflow_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  from_stage workflow_stage,
  to_stage workflow_stage,
  action_by uuid REFERENCES public.profiles(id),
  action_type text CHECK (action_type IN ('stage_change', 'rejection', 'comment', 'signature')),
  comment text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.signatures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  signed_by uuid REFERENCES public.profiles(id),
  signature_text text,
  workflow_stage workflow_stage,
  created_at timestamp with time zone DEFAULT now()
);

-- D. ACTIVARE RLS (Important să fie aici)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- E. INDEXURI
CREATE INDEX IF NOT EXISTS idx_documents_stage ON public.documents(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_documents_assignee ON public.documents(current_assignee);