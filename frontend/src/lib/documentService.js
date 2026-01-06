import { supabase } from '../lib/supabase';

/**
 * SERVICIUL PENTRU DOCUMENTE
 * Se ocupă de: Listare, Filtrare, Căutare și Creare cereri.
 * Folosit de: Cetățeni (MyRequests) și Funcționari (Dashboard).
 */
export const DocumentService = {

  /**
   * 1. ADUCE LISTA DE DOCUMENTE (CU FILTRE AVANSATE)
   * ------------------------------------------------
   * @param {Object} filters - Obiect cu filtrele selectate de utilizator
   * @param {string} filters.search - Text pentru căutare (titlu sau descriere)
   * @param {string} filters.category - Categoria (ex: 'cerere_cetatean')
   * @param {string} filters.status - Stadiul (ex: 'review_step1')
   * @param {string} filters.date - Data în format 'YYYY-MM-DD'
   * * NOTĂ: Nu trimitem ID-ul utilizatorului. RLS-ul (Security Policy) din baza de date
   * știe cine e logat și returnează automat doar documentele permise.
   */
  async getAll(filters = {}) {
    // Start Query: Selectăm tot + numele celui care a încărcat + istoric pentru status
    let query = supabase
      .from('documents')
      .select('*, workflow_history(action_type, from_stage)')
      .order('created_at', { ascending: false }); // Cele mai noi primele (Index activat)

    // A. SEARCH BAR (Căutare "Fuzzy")
    // Folosește indexul GIN din spate. Caută termenul și în Titlu și în Descriere.
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // B. FILTRU CATEGORIE
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    // C. FILTRU STATUS (WORKFLOW)
    if (filters.workflow_stage && filters.workflow_stage !== 'all') {
      query = query.eq('workflow_stage', filters.workflow_stage);
    }

    // D. FILTRU DATĂ (Interval)
    if (filters.date) {
      if (filters.date.from) {
         query = query.gte('created_at', `${filters.date.from.toISOString().split('T')[0]}T00:00:00`);
      }
      if (filters.date.to) {
         query = query.lte('created_at', `${filters.date.to.toISOString().split('T')[0]}T23:59:59`);
      }
    }

    // E. FILTRU UPLOADER
    if (filters.uploaded_by) {
        query = query.eq('uploaded_by', filters.uploaded_by);
    }

    // F. FILTRU ASIGNEE
    if (filters.assignee) {
        if (filters.assignee === 'is.null') {
            query = query.is('current_assignee', null);
        } else {
            query = query.eq('current_assignee', filters.assignee);
        }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * 2. ADUCE UN SINGUR DOSAR (PENTRU PAGINA DE DETALII)
   * ---------------------------------------------------
   * Aduce tot: fișiere atașate, istoric (audit) și semnături.
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_files (*),
        workflow_history (
          *,
          action_by_profile:action_by ( full_name, role, department )
        ),
        signatures (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Fetch requester profile manually because strict FK relationship to public.profiles is missing
    // (uploaded_by points to auth.users, not public.profiles directly in schema definition)
    if (data.uploaded_by) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', data.uploaded_by)
            .single();
        
        data.requester_profile = profile;
    }

    return data;
  },

  /**
   * 3. CREAZĂ O CERERE NOUĂ (CETĂȚEAN)
   * ----------------------------------
   */
  async createRequest(payload) {
    if (!payload.title || !payload.category) {
      throw new Error("Titlul și categoria sunt obligatorii.");
    }

    // user_id se ia automat de către Supabase Auth, dar trebuie să fim logați.
    const { data, error } = await supabase
      .from('documents')
      .insert([{
        title: payload.title,
        description: payload.description,
        category: payload.category,
        uploaded_by: (await supabase.auth.getUser()).data.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 4. UPLOAD FIȘIERE (ATAȘAMENTE)
   * ------------------------------
   * Urcă fișierul fizic în Storage și creează referința în tabelul SQL.
   * Triggerul din baza de date va scrie automat în Istoric "S-a încărcat fișierul X".
   */
  async uploadFile(documentId, file) {
    const fileName = `${documentId}/${Date.now()}_${file.name}`;
    
    // 1. Upload fizic (Storage)
    const { error: uploadError } = await supabase.storage
      .from('dms-files')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;

    // 2. Link în Baza de Date
    const { error: dbError } = await supabase
      .from('document_files')
      .insert([{
        document_id: documentId,
        file_name: file.name,
        file_url: fileName,
        uploaded_by: (await supabase.auth.getUser()).data.user.id
      }]);

    if (dbError) throw dbError;
  },

  /**
   * 6. DELETE FIȘIER
   * ----------------
   * Șterge fișierul din Storage și din Baza de Date.
   */
  async deleteFile(fileId, filePath, fileName, documentId) {
    // 1. Delete from Storage
    const { error: storageError } = await supabase.storage
      .from('dms-files')
      .remove([filePath]);
    
    if (storageError) throw storageError;

    // 2. Delete from Database
    const { error: dbError } = await supabase
      .from('document_files')
      .delete()
      .eq('id', fileId);

    if (dbError) throw dbError;

    // 3. Log to History - ELIMINAT pentru a evita duplicarea (Triggerul DB se ocupa de asta sau logica UI)
    // Daca exista trigger pe DELETE document_files, acesta va scrie.
    // Daca nu, userul a cerut sa nu il bagam manual.
  },

  /**
   * 7. ȘTERGE CEREREA (Doar pentru Cetățean)
   * Această funcție șterge înregistrarea din 'documents'.
   * Datorită regulii ON DELETE CASCADE din SQL, se vor șterge automat și:
   * Intrările din document_files
   * Intrările din workflow_history
   */
  async deleteRequest(docId) {
    // 1. (Opțional dar recomandat) Mai întâi curățăm fișierele fizice din Storage
    // Dacă nu faci asta, rămân fișiere "orfane" în bucket, deși dispar din baza de date.
    try {
        const { data: files } = await supabase.from('document_files').select('file_url').eq('document_id', docId);

        if (files && files.length > 0) {
            const paths = files.map(f => f.file_url);
            await supabase.storage.from('dms-files').remove(paths);
        }
    } catch (err) {
        console.warn("Nu s-au putut șterge fișierele fizice (dar continuăm cu ștergerea cererii):", err);
    }

    // 2. Ștergem cererea propriu-zisă
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (error) throw error;
  },

  /**
   * 8. REVOCĂ APROBAREA (UNDO)
   * Șterge semnătura și întoarce dosarul în lucru.
   */
  async revokeApproval(docId) {
    // Încercăm să folosim RPC dacă există, altfel facem logică manuală în JS
    // Având în vedere că vrem să ștergem intrarea de 'signature' din history:
    const { error } = await supabase
      .from('workflow_history')
      .delete()
      .eq('document_id', docId)
      .eq('action_type', 'signature');

    if (error) throw error;
  },

  /**
   * 5. PREIA DOCUMENT (ASIGNARE)
   * ----------------------------
   * Atribuie documentul utilizatorului curent și opțional schimbă stadiul.
   */
  async assignToMe(documentId, userId, newStage = null) {
    const updates = { current_assignee: userId };
    if (newStage) {
      updates.workflow_stage = newStage;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    
    // Logăm acțiunea în istoric (Manual, pentru că triggerul e generic)
    // Deși avem trigger pe update, e bine să avem un mesaj explicit dacă vrem.
    // Dar momentan ne bazăm pe trigger-ul existent sau adăugăm unul manual.
    // Vom adăuga manual o intrare în istoric pentru claritate.
    await supabase.from('workflow_history').insert({
        document_id: documentId,
        action_by: userId,
        action_type: 'comment', // Sau un tip nou 'assignment' daca modificam enum-ul, momentan 'comment' e safe
        comment: `A preluat cererea pentru verificare.${newStage ? ' Status actualizat la: ' + newStage : ''}`
    });

    return data;
  }
};
