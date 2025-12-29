-- NUME FISIER: 02_functions.sql

-- 1. TRIGGER USER NOU
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'cetatean', NULL)
  ON CONFLICT (id) DO NOTHING; -- Am adăugat protecție
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreăm triggerul (îl ștergem întâi ca să nu dea eroare că există)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. ASSIGN TO ME (Preluare)
CREATE OR REPLACE FUNCTION public.assign_to_me(p_doc_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_stage workflow_stage;
BEGIN
  SELECT workflow_stage INTO v_stage FROM public.documents WHERE id = p_doc_id;

  IF v_stage = 'submitted' THEN
      UPDATE public.documents
      SET workflow_stage = 'review_step1', current_assignee = auth.uid(), updated_at = now()
      WHERE id = p_doc_id;
      
      INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
      VALUES (p_doc_id, 'submitted', 'review_step1', auth.uid(), 'stage_change', 'Preluat din coada initiala.');
      RETURN;
  END IF;

  UPDATE public.documents
  SET current_assignee = auth.uid(), updated_at = now()
  WHERE id = p_doc_id;
  
  INSERT INTO public.workflow_history (document_id, action_by, action_type, comment)
  VALUES (p_doc_id, auth.uid(), 'comment', 'A preluat dosarul în lucru.');
END;
$$;


-- 3. PROCESS DOCUMENT (Aprobare/Respingere)
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

  IF p_action = 'reject' THEN
    UPDATE public.documents
    SET workflow_stage = 'rejected', rejection_reason = p_reason, current_assignee = NULL, updated_at = now()
    WHERE id = p_doc_id;
    
    INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
    VALUES (p_doc_id, v_current_stage, 'rejected', auth.uid(), 'rejection', p_reason);
    RETURN;
  END IF;

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
      current_assignee = NULL,
      updated_at = now(),
      completed_at = (CASE WHEN v_next_stage = 'completed' THEN now() ELSE completed_at END)
    WHERE id = p_doc_id;

    INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
    VALUES (p_doc_id, v_current_stage, v_next_stage, auth.uid(), 'stage_change', 'Aprobat și trimis mai departe.');
  END IF;
END;
$$;

-- 4. SIGN DOCUMENT
CREATE OR REPLACE FUNCTION public.sign_document(p_doc_id uuid, p_signature_text text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.signatures (document_id, signed_by, signature_text, workflow_stage)
  VALUES (p_doc_id, auth.uid(), p_signature_text, (SELECT workflow_stage FROM public.documents WHERE id = p_doc_id));

  INSERT INTO public.workflow_history (document_id, action_by, action_type, comment)
  VALUES (p_doc_id, auth.uid(), 'signature', 'Document semnat digital.');
END;
$$;