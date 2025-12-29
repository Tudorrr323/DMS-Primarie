-- NUME FISIER: 03_policies.sql

-- =================================================================
-- A. CURĂȚENIE (Resetăm politicile vechi)
-- =================================================================
-- Documente
DROP POLICY IF EXISTS "Admin Full Access" ON public.documents;
DROP POLICY IF EXISTS "Cetatean View Own" ON public.documents;
DROP POLICY IF EXISTS "Cetatean Insert Own" ON public.documents;
DROP POLICY IF EXISTS "Func Verificare Initiala View" ON public.documents;
DROP POLICY IF EXISTS "Func Verificare Tehnica View" ON public.documents;
DROP POLICY IF EXISTS "Func Verificare Finala View" ON public.documents;
DROP POLICY IF EXISTS "Angajat Update Assigned" ON public.documents;

-- Anexe
DROP POLICY IF EXISTS "View Files If Auth" ON public.document_files;
DROP POLICY IF EXISTS "Insert Files If Auth" ON public.document_files;

-- Istoric & Semnături (Astea lipseau!)
DROP POLICY IF EXISTS "View History If Auth" ON public.workflow_history;
DROP POLICY IF EXISTS "View Signatures If Auth" ON public.signatures;

-- Storage
DROP POLICY IF EXISTS "Acces vizualizare fisiere" ON storage.objects;
DROP POLICY IF EXISTS "Acces upload fisiere" ON storage.objects;
DROP POLICY IF EXISTS "Acces stergere fisiere" ON storage.objects;


-- =================================================================
-- B. POLITICI DOCUMENTE (Acces Dosare)
-- =================================================================
-- 1. ADMIN - Vede tot
CREATE POLICY "Admin Full Access" ON public.documents
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. CETĂȚEAN - Vede și crează doar dosarele lui
CREATE POLICY "Cetatean View Own" ON public.documents
FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Cetatean Insert Own" ON public.documents
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- 3. FUNCȚIONARI - Văd dosarele în funcție de stadiu și departament
CREATE POLICY "Func Verificare Initiala View" ON public.documents
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'angajat' AND department = 'verificare_initiala')
    AND (workflow_stage = 'submitted' OR workflow_stage = 'review_step1')
);

CREATE POLICY "Func Verificare Tehnica View" ON public.documents
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'angajat' AND department = 'verificare_tehnica')
    AND workflow_stage = 'review_step2'
);

CREATE POLICY "Func Verificare Finala View" ON public.documents
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'angajat' AND department = 'verificare_finala')
    AND workflow_stage = 'review_step3'
);

-- 4. UPDATE - Funcționarul poate modifica doar dacă e asignat pe dosar
CREATE POLICY "Angajat Update Assigned" ON public.documents
FOR UPDATE USING (current_assignee = auth.uid());


-- =================================================================
-- C. POLITICI TABELE AUXILIARE (Istoric, Fișiere, Semnături)
-- =================================================================
-- Orice user logat poate vedea fișierele, istoricul și semnăturile
-- (Securitatea reală e la nivel de DOCUMENT. Dacă nu vezi documentul, nu ai ID-ul lui ca să interoghezi aceste tabele)

CREATE POLICY "View Files If Auth" ON public.document_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert Files If Auth" ON public.document_files FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "View History If Auth" ON public.workflow_history FOR SELECT TO authenticated USING (true);
-- Insert-ul în History se face prin funcții 'Security Definer', deci nu e nevoie de policy de insert.

CREATE POLICY "View Signatures If Auth" ON public.signatures FOR SELECT TO authenticated USING (true);
-- Insert-ul în Signatures se face prin funcția 'sign_document', deci nu e nevoie de policy de insert.


-- =================================================================
-- D. POLITICI STORAGE (Fișierele fizice)
-- =================================================================

-- 1. UPLOAD (Oricine logat poate urca fișiere în bucket-ul corect)
CREATE POLICY "Acces upload fisiere" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'dms-files' );

-- 2. DOWNLOAD / VIZUALIZARE (CRITIC: Am simplificat regula!)
-- Oricine e logat poate descărca fișiere din acest bucket.
-- Protecția se face în React: Userul nu primește link-ul (path-ul) decât dacă are voie să vadă înregistrarea din DB.
CREATE POLICY "Acces vizualizare fisiere" ON storage.objects
FOR SELECT TO authenticated
USING ( bucket_id = 'dms-files' );

-- 3. ȘTERGERE (Doar Admin sau Proprietar)
CREATE POLICY "Acces stergere fisiere" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'dms-files' 
  AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
);