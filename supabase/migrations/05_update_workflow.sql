-- NUME FISIER: 05_update_workflow.sql

-- =================================================================
-- PASUL 1: ACTUALIZĂM FUNCȚIA PRINCIPALĂ DE APROBARE
-- =================================================================

-- Întâi ștergem versiunea veche pentru a evita erorile de semnătură
DROP FUNCTION IF EXISTS public.process_document(uuid, text, text);

-- Creăm versiunea nouă care acceptă parametrul opțional "p_target_assignee"
CREATE OR REPLACE FUNCTION public.process_document(
  p_doc_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_target_assignee uuid DEFAULT NULL -- <--- PARAMETRUL NOU
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_stage workflow_stage;
  v_next_stage workflow_stage;
BEGIN
  SELECT workflow_stage INTO v_current_stage FROM public.documents WHERE id = p_doc_id;

  -- A. RESPINGERE (Rămâne neschimbată)
  IF p_action = 'reject' THEN
    UPDATE public.documents
    SET workflow_stage = 'rejected', rejection_reason = p_reason, current_assignee = NULL, updated_at = now()
    WHERE id = p_doc_id;
    
    INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
    VALUES (p_doc_id, v_current_stage, 'rejected', auth.uid(), 'rejection', p_reason);
    RETURN;
  END IF;

  -- B. APROBARE (Logică nouă)
  IF p_action = 'approve' THEN
    -- Calculăm stadiul următor
    CASE v_current_stage
      WHEN 'review_step1' THEN v_next_stage := 'review_step2';
      WHEN 'review_step2' THEN v_next_stage := 'review_step3';
      WHEN 'review_step3' THEN v_next_stage := 'completed';
      ELSE RAISE EXCEPTION 'Stadiul % nu permite aprobare.', v_current_stage;
    END CASE;

    -- Update document: Dacă avem target, îl punem pe el. Dacă nu, punem NULL (Queue).
    UPDATE public.documents
    SET 
      workflow_stage = v_next_stage,
      current_assignee = p_target_assignee, -- Aici se decide dacă merge la om sau la grămadă
      updated_at = now(),
      completed_at = (CASE WHEN v_next_stage = 'completed' THEN now() ELSE completed_at END)
    WHERE id = p_doc_id;

    -- Scriem în istoric ce s-a întâmplat
    INSERT INTO public.workflow_history (document_id, from_stage, to_stage, action_by, action_type, comment)
    VALUES (
      p_doc_id, 
      v_current_stage, 
      v_next_stage, 
      auth.uid(), 
      'stage_change', 
      CASE WHEN p_target_assignee IS NOT NULL 
           THEN 'Aprobat și asignat direct către coleg.'
           ELSE 'Aprobat și trimis în coada generală.'
      END
    );
  END IF;
END;
$$;


-- =================================================================
-- PASUL 2: FUNCȚII NOI PENTRU DROPDOWN INTELIGENT (Load Balancing)
-- =================================================================

-- A. LISTA CU ÎNCĂRCAREA (Returnează: Nume + Nr. Dosare Active)
-- Îi arată funcționarului X: "Ion Popescu (3 dosare)", "Maria Ionescu (0 dosare)"
CREATE OR REPLACE FUNCTION public.get_department_workload(p_dept department_type)
RETURNS TABLE (
  id uuid, 
  full_name text, 
  active_tasks bigint
) 
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT 
    p.id, 
    p.full_name,
    (
      SELECT COUNT(*) 
      FROM public.documents d 
      WHERE d.current_assignee = p.id 
      AND d.workflow_stage NOT IN ('completed', 'rejected') -- Numărăm doar ce e în lucru!
    ) as active_tasks
  FROM public.profiles p
  WHERE p.role = 'angajat' AND p.department = p_dept
  ORDER BY active_tasks ASC; -- Cei mai liberi apar primii
$$;

-- B. GĂSEȘTE CEL MAI LIBER FUNCȚIONAR (Algoritmul "Auto-Assign")
-- Returnează ID-ul celui cu cele mai puține dosare
CREATE OR REPLACE FUNCTION public.get_least_loaded_employee(p_dept department_type)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_target_id uuid;
BEGIN
  SELECT id INTO v_target_id
  FROM public.get_department_workload(p_dept) -- Refolosim logica de sus
  LIMIT 1; -- Îl luăm pe primul (care e cel mai liber)
  
  RETURN v_target_id;
END;
$$;