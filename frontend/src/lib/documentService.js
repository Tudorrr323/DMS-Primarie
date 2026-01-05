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
    // Start Query: Selectăm tot + numele celui care a încărcat
    let query = supabase
      .from('documents')
      .select('*')
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

    // D. FILTRU DATĂ (Interval 24h)
    // Caută orice a fost creat între 00:00 și 23:59 în ziua respectivă
    if (filters.date) {
      query = query
        .gte('created_at', `${filters.date}T00:00:00`)
        .lte('created_at', `${filters.date}T23:59:59`);
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
