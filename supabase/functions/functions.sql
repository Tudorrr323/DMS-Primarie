CREATE OR REPLACE FUNCTION public.assign_to_me(p_doc_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.get_department_workload(p_dept department_type)
 RETURNS TABLE(id uuid, full_name text, active_tasks bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.get_least_loaded_employee(p_dept department_type)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_target_id uuid;
BEGIN
  SELECT id INTO v_target_id
  FROM public.get_department_workload(p_dept) -- Refolosim logica de sus
  LIMIT 1; -- Îl luăm pe primul (care e cel mai liber)
  
  RETURN v_target_id;
END;
$function$

CREATE OR REPLACE FUNCTION public.get_my_processed_documents()
 RETURNS TABLE(id uuid, title text, description text, category document_category_type, current_stage workflow_stage, my_action text, action_date timestamp with time zone, submitter_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.description,
    d.category,
    d.workflow_stage as current_stage,
    h.action_type as my_action,
    h.created_at as action_date,
    p.full_name as submitter_name
  FROM public.workflow_history h
  JOIN public.documents d ON h.document_id = d.id
  LEFT JOIN public.profiles p ON d.uploaded_by = p.id
  WHERE 
    h.action_by = auth.uid() -- Doar acțiunile MELE
    AND h.action_type IN ('stage_change', 'rejection') -- Doar Aprobări sau Respingeri (ignorăm comentarii/semnături simple)
  ORDER BY h.created_at DESC;
END;
$function$

CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$

CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$

CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$

CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$

CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$

CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$

CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$

CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$

CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$

CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$

CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$

CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$

CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$

CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$

CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$

CREATE OR REPLACE FUNCTION public.handle_file_delete_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Verificăm dacă documentul părinte încă există. 
  -- Dacă a fost șters și el (prin CASCADE), nu mai are sens să scriem în istoric 
  -- (pentru că și istoricul va fi șters).
  IF EXISTS (SELECT 1 FROM public.documents WHERE id = OLD.document_id) THEN
      INSERT INTO public.workflow_history (
        document_id,
        action_by,
        action_type,
        comment,
        created_at
      )
      VALUES (
        OLD.document_id,
        auth.uid(),
        'file_delete',
        'A șters fișierul: ' || OLD.file_name,
        NOW()
      );
  END IF;
  
  RETURN OLD;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'cetatean');
  RETURN new;
END;
$function$

CREATE OR REPLACE FUNCTION public.log_new_file()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.process_document(p_doc_id uuid, p_action text, p_reason text DEFAULT NULL::text, p_target_assignee uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.remove_my_signature(doc_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Ștergem din tabela SIGNATURES
  -- Caută rândul unde documentul corespunde ȘI semnatarul este utilizatorul curent
  DELETE FROM public.signatures
  WHERE document_id = doc_id 
  AND signed_by = auth.uid();

  -- 2. Ștergem din WORKFLOW_HISTORY
  -- Șterge doar intrările de tip 'signature' făcute de MINE
  DELETE FROM public.workflow_history
  WHERE document_id = doc_id
  AND action_by = auth.uid()
  AND (
      action_type = 'signature' 
      OR comment ILIKE '%semnat digital%'
      OR comment ILIKE '%semnat%'
  );

  -- Am scos partea cu UPDATE documents, care cauza eroarea.
END;
$function$

CREATE OR REPLACE FUNCTION public.revoke_approval(doc_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Resetăm Documentul (îl aducem la stadiul de lucru)
  UPDATE public.documents
  SET 
    workflow_stage = 'review_step1', -- Sau pasul la care vrei să revină
    signed_by = NULL,
    signed_at = NULL,
    signature_hash = NULL,
    current_assignee = auth.uid()
  WHERE id = doc_id;

  -- 2. Ștergem din Istoric linia cu comentariul specific
  DELETE FROM public.workflow_history
  WHERE document_id = doc_id 
  AND (
      -- Condiții generale
      to_stage = 'completed'
      OR action_type = 'signature'
      
      -- Condiții de text (Aici e cheia)
      OR comment ILIKE '%semnat%'
      OR comment ILIKE '%certificat%'       -- Va prinde cuvântul "Certificat_Aprobare..."
      OR comment ILIKE '%generat și semnat%' -- Fix fraza ta
  );

END;
$function$

CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$

CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$

CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$

CREATE OR REPLACE FUNCTION public.sign_document(p_doc_id uuid, p_signature_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.signatures (document_id, signed_by, signature_text, workflow_stage)
  VALUES (p_doc_id, auth.uid(), p_signature_text, (SELECT workflow_stage FROM public.documents WHERE id = p_doc_id));

  INSERT INTO public.workflow_history (document_id, action_by, action_type, comment)
  VALUES (p_doc_id, auth.uid(), 'signature', 'Document semnat digital.');
END;
$function$

CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$

CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$

CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$

CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$

CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$

CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$

CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$

CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$

CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$

CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$
