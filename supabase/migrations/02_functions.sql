-- NUME FISIER: 02_functions.sql

-- =================================================================
-- 1. TRIGGER USER NOU (Creează profil automat)
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'cetatean', NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreăm triggerul
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =================================================================
-- 2. ASSIGN TO ME (Preluare Dosar)
-- =================================================================
CREATE OR REPLACE FUNCTION public.assign_to_me(p_doc_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_stage workflow_stage;
BEGIN
  SELECT workflow_stage INTO v_stage FROM public.documents WHERE id = p_doc_id;

  -- Dacă e prima preluare (din coadă), schimbăm stadiul
  IF v_stage = 'submitted' THEN
      UPDATE public.documents
      SET workflow_stage = 'review_step1', current_assignee = auth.uid(), updated_at = now()
      WHERE id = p_doc_id;
      
      INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
      VALUES (p_doc_id, 'submitted', 'review_step1', auth.uid(), 'stage_change', 'Preluat din coada initiala.');
      RETURN;
  END IF;

  -- Altfel doar asignăm
  UPDATE public.documents
  SET current_assignee = auth.uid(), updated_at = now()
  WHERE id = p_doc_id;
  
  INSERT INTO public.workflow_history (document_id, action_by, action_type, comment)
  VALUES (p_doc_id, auth.uid(), 'comment', 'A preluat dosarul în lucru.');
END;
$$;


-- =================================================================
-- 3. PROCESS DOCUMENT (Aprobare / Respingere)
-- =================================================================
CREATE OR REPLACE FUNCTION public.process_document(
  p_doc_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_stage workflow_stage;
  v_next_stage workflow_stage;
BEGIN
  SELECT workflow_stage INTO v_current_stage FROM public.documents WHERE id = p_doc_id;

  -- 1. RESPINGERE
  IF p_action = 'reject' THEN
    UPDATE public.documents
    SET workflow_stage = 'rejected', rejection_reason = p_reason, current_assignee = NULL, updated_at = now()
    WHERE id = p_doc_id;
    
    INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
    VALUES (p_doc_id, v_current_stage, 'rejected', auth.uid(), 'rejection', p_reason);
    RETURN;
  END IF;

  -- 2. APROBARE (Mutare la pasul următor)
  IF p_action = 'approve' THEN
    CASE v_current_stage
      WHEN 'review_step1' THEN v_next_stage := 'review_step2';
      WHEN 'review_step2' THEN v_next_stage := 'review_step3';
      WHEN 'review_step3' THEN v_next_stage := 'completed';
      ELSE RAISE EXCEPTION 'Stadiul % nu permite aprobare.', v_current_stage;
    END CASE;

    UPDATE public.documents
    SET 
      workflow_stage = v_next_stage,
      current_assignee = NULL, -- Eliberăm dosarul pentru următorul departament
      updated_at = now(),
      completed_at = (CASE WHEN v_next_stage = 'completed' THEN now() ELSE completed_at END)
    WHERE id = p_doc_id;

    INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
    VALUES (p_doc_id, v_current_stage, v_next_stage, auth.uid(), 'stage_change', 'Aprobat și trimis mai departe.');
  END IF;
END;
$$;


-- =================================================================
-- 4. SIGN DOCUMENT (Semnare Digitală + Fișier Specific)
-- =================================================================
-- Am adăugat parametrul p_file_id (opțional)
CREATE OR REPLACE FUNCTION public.sign_document(
    p_doc_id uuid, 
    p_signature_text text,
    p_file_id uuid DEFAULT NULL 
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_file_name text := '';
BEGIN
  -- Dacă semnăm un fișier specific, îi aflăm numele pentru istoric
  IF p_file_id IS NOT NULL THEN
      SELECT file_name INTO v_file_name FROM public.document_files WHERE id = p_file_id;
      
      -- Marcăm fișierul ca semnat vizual (bifa verde)
      UPDATE public.document_files SET is_signed = true WHERE id = p_file_id;
  END IF;

  -- Inserăm semnătura oficială
  INSERT INTO public.signatures (document_id, file_id, signed_by, signature_text, workflow_stage)
  VALUES (
      p_doc_id, 
      p_file_id, 
      auth.uid(), 
      p_signature_text, 
      (SELECT workflow_stage FROM public.documents WHERE id = p_doc_id)
  );

  -- Notăm în istoric
  INSERT INTO public.workflow_history (document_id, action_by, action_type, comment)
  VALUES (
      p_doc_id, 
      auth.uid(), 
      'signature', 
      CASE WHEN p_file_id IS NOT NULL 
           THEN 'A semnat documentul specific: ' || v_file_name
           ELSE 'A semnat/validat tot dosarul.' 
      END
  );
END;
$$;


-- =================================================================
-- 5. AUTO-LOG UPLOAD (Trigger pentru Audit Log)
-- =================================================================
-- Aceasta funcție se activează singură când Tudor uploadează ceva
CREATE OR REPLACE FUNCTION public.log_new_file()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.workflow_history (document_id, action_by, action_type, comment)
  VALUES (
    new.document_id, 
    new.uploaded_by, 
    'file_upload', 
    'A atașat documentul: ' || new.file_name
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggerul care activează funcția
DROP TRIGGER IF EXISTS on_file_uploaded ON public.document_files;
CREATE TRIGGER on_file_uploaded
  AFTER INSERT ON public.document_files
  FOR EACH ROW EXECUTE PROCEDURE public.log_new_file();


-- =================================================================
-- 6. DASHBOARD STATS (View pentru Grafice)
-- =================================================================
-- Adminul poate da doar "SELECT * FROM document_stats"
CREATE OR REPLACE VIEW document_stats AS
SELECT 
  workflow_stage,
  COUNT(*) as total_count
FROM public.documents
GROUP BY workflow_stage;