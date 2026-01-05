import { supabase } from '../lib/supabase';

/**
 * SERVICIUL PENTRU ANGAJAȚI
 * Conține logica de Workflow: Aprobare, Respingere, Semnare, Asignare.
 */
export const EmployeeService = {
  
  /**
   * 1. PREIA DOSARUL ("ASSIGN TO ME")
   * ---------------------------------
   * Mută dosarul din "Coadă" în "Dosarele Mele".
   * Nimeni altcineva nu va mai putea lucra pe el.
   */
  async assignToMe(docId) {
    const { error } = await supabase.rpc('assign_to_me', { 
      p_doc_id: docId 
    });
    if (error) throw error;
  },

  /**
   * 2. APROBĂ DOSARUL (STANDARD / MANUAL)
   * -------------------------------------
   * Mută dosarul la pasul următor.
   * * @param {string} docId - ID-ul documentului
   * @param {string|null} targetUserId - (Opțional) 
   * - Dacă e NULL: Dosarul merge în COADĂ (oricine de la pasul următor îl poate lua).
   * - Dacă e ID VALID: Dosarul merge DIRECT la acel coleg (Manual Assign).
   */
  async approve(docId, targetUserId = null) {
    const { error } = await supabase.rpc('process_document', {
      p_doc_id: docId,
      p_action: 'approve',
      p_target_assignee: targetUserId 
    });
    if (error) throw error;
  },

  /**
   * 3. APROBĂ DOSARUL (AUTO-ASSIGN / SMART)
   * ---------------------------------------
   * Caută automat colegul cu cele mai puține dosare și i-l trimite direct.
   * * @param {string} docId - ID-ul documentului
   * @param {string} nextDepartment - Unde merge dosarul? (ex: 'verificare_tehnica')
   */
  async approveAutoAssign(docId, nextDepartment) {
    // A. Găsim colegul cel mai liber
    const { data: bestEmployeeId, error: findError } = await supabase.rpc('get_least_loaded_employee', {
      p_dept: nextDepartment
    });
    
    if (findError) throw findError;
    if (!bestEmployeeId) throw new Error("Nu am găsit niciun angajat disponibil.");

    // B. Aprobăm și îi dăm lui dosarul
    await this.approve(docId, bestEmployeeId);
    
    return bestEmployeeId; // Returnăm ID-ul ca să poți afișa un mesaj de succes
  },

  /**
   * 4. RESPINGE DOSARUL
   * -------------------
   * Trimite dosarul în starea 'rejected' și cere un motiv obligatoriu.
   */
  async reject(docId, reason) {
    if (!reason) throw new Error("Motivul respingerii este obligatoriu.");
    
    const { error } = await supabase.rpc('process_document', {
      p_doc_id: docId,
      p_action: 'reject',
      p_reason: reason
    });
    if (error) throw error;
  },

  /**
   * 5. SEMNEAZĂ DIGITAL
   * -------------------
   * @param {string} signatureText - Textul (ex: "Semnat digital de X")
   * @param {string|null} fileId - (Opțional)
   * - Dacă e specificat: Semnează doar acel fișier (pune bifa verde pe Aviz).
   * - Dacă e NULL: Semnează tot dosarul (Validare generală).
   */
  async signDocument(docId, signatureText, fileId = null) {
    const { error } = await supabase.rpc('sign_document', {
      p_doc_id: docId,
      p_signature_text: signatureText,
      p_file_id: fileId
    });
    if (error) throw error;
  },

  /**
   * 6. STATISTICI COLEGI (PENTRU DROPDOWN)
   * --------------------------------------
   * Returnează lista colegilor dintr-un departament și câte dosare au în lucru.
   * Util pentru a popula dropdown-ul de asignare manuală.
   * * Returnează: [{ id, full_name, active_tasks }, ...]
   */
  async getColleaguesStats(deptName) {
    const { data, error } = await supabase.rpc('get_department_workload', {
      p_dept: deptName
    });
    if (error) throw error;
    return data;
  }
};