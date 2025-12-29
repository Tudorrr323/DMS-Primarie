-- NUME FISIER: 03_policies.sql

-- A. Ștergem tot ce e vechi ca să nu se dubleze
DROP POLICY IF EXISTS "Admin Full Access" ON public.documents;
DROP POLICY IF EXISTS "Cetatean View Own" ON public.documents;
DROP POLICY IF EXISTS "Cetatean Insert Own" ON public.documents;
DROP POLICY IF EXISTS "Func Verificare Initiala View" ON public.documents;
DROP POLICY IF EXISTS "Func Verificare Tehnica View" ON public.documents;
DROP POLICY IF EXISTS "Func Verificare Finala View" ON public.documents;
DROP POLICY IF EXISTS "Angajat Update Assigned" ON public.documents;
-- ...si pentru celelalte tabele...
DROP POLICY IF EXISTS "View Files If Auth" ON public.document_files;
DROP POLICY IF EXISTS "Insert Files If Auth" ON public.document_files;
DROP POLICY IF EXISTS "Acces vizualizare fisiere" ON storage.objects;
DROP POLICY IF EXISTS "Acces upload fisiere" ON storage.objects;

-- B. ADĂUGĂM POLITICILE (DOCUMENTE)
CREATE POLICY "Admin Full Access" ON public.documents FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Cetatean View Own" ON public.documents FOR SELECT USING (auth.uid() = uploaded_by);
CREATE POLICY "Cetatean Insert Own" ON public.documents FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Politici Funcționari (Flux X -> Y -> Z)
CREATE POLICY "Func Verificare Initiala View" ON public.documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'angajat' AND department = 'verificare_initiala')
    AND (workflow_stage = 'submitted' OR workflow_stage = 'review_step1')
);

CREATE POLICY "Func Verificare Tehnica View" ON public.documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'angajat' AND department = 'verificare_tehnica')
    AND workflow_stage = 'review_step2'
);

CREATE POLICY "Func Verificare Finala View" ON public.documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'angajat' AND department = 'verificare_finala')
    AND workflow_stage = 'review_step3'
);

CREATE POLICY "Angajat Update Assigned" ON public.documents FOR UPDATE USING (current_assignee = auth.uid());

-- C. ADĂUGĂM POLITICILE (ANEXE & ISTORIC)
CREATE POLICY "View Files If Auth" ON public.document_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert Files If Auth" ON public.document_files FOR INSERT TO authenticated WITH CHECK (true);

-- D. ADĂUGĂM POLITICILE (STORAGE)
CREATE POLICY "Acces vizualizare fisiere" ON storage.objects FOR SELECT TO authenticated
USING ( bucket_id = 'dms-files' AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('angajat', 'admin'))) );

CREATE POLICY "Acces upload fisiere" ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'dms-files' );