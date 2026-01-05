import { supabase } from '../lib/supabase';

/**
 * SERVICIUL PENTRU ANGAJAȚI (CLIENT-SIDE LOGIC)
 * Implementează logica de business direct în frontend pentru a evita 
 * dependența de RPC-uri care nu există sau sunt incompatibile.
 */
export const EmployeeService = {

  // ==============================================================
  // A. ACȚIUNI DE PRELUARE ȘI PROCESARE
  // ==============================================================

  /**
   * 1. PREIA DOSARUL ("ASSIGN TO ME")
   * Mută dosarul din "Coadă" în "Dosarele Mele" (review_step1).
   */
  async assignToMe(docId, userId) {
    // 1. Update Document
    const { error } = await supabase
      .from('documents')
      .update({
        current_assignee: userId,
        workflow_stage: 'review_step1', // Asumăm că preluarea din queue îl duce în step1
        updated_at: new Date().toISOString()
      })
      .eq('id', docId);

    if (error) throw error;

    // 2. Log History
    await supabase.from('workflow_history').insert({
      document_id: docId,
      action_by: userId,
      action_type: 'stage_change',
      from_stage: 'submitted',
      to_stage: 'review_step1',
      comment: 'Preluat manual din coada de așteptare.'
    });
  },

  /**
   * 2. APROBĂ DOSARUL (STANDARD / MANUAL)
   * Mută dosarul la pasul următor (review_step2 - Tehnic).
   */
  async approve(docId, currentUserId, targetAssigneeId = null) {
    const nextStage = 'review_step2';

    // 1. Update Document
    const { error } = await supabase
      .from('documents')
      .update({
        workflow_stage: nextStage,
        current_assignee: targetAssigneeId, // Poate fi NULL (Pool) sau ID (Manual)
        updated_at: new Date().toISOString()
      })
      .eq('id', docId);

    if (error) throw error;

    // 2. Log History
    await supabase.from('workflow_history').insert({
      document_id: docId,
      action_by: currentUserId,
      action_type: 'stage_change',
      from_stage: 'review_step1',
      to_stage: nextStage,
      comment: targetAssigneeId 
        ? 'Aprobat și alocat manual unui coleg.' 
        : 'Aprobat și trimis în coada comună a departamentului tehnic.'
    });
  },

  /**
   * 3. APROBĂ DOSARUL (AUTO-ASSIGN / SMART)
   * Caută automat colegul cel mai liber din departamentul următor.
   */
  async approveAutoAssign(docId, currentUserId, nextDepartment) {
    // A. Găsim toți angajații din departamentul țintă
    const { data: employees, error: empError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'angajat')
        .eq('department', nextDepartment);

    if (empError) throw empError;
    if (!employees || employees.length === 0) throw new Error("Nu există angajați în departamentul " + nextDepartment);

    // B. Pentru fiecare, numărăm task-urile active
    const employeeIds = employees.map(e => e.id);
    
    // Fetch active documents for these employees
    const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('current_assignee')
        .in('current_assignee', employeeIds)
        .not('workflow_stage', 'in', '("completed","rejected")'); // Pseudo-code filter logic, fixed below

    if (docError) throw docError;

    // Count workload
    const workload = {};
    employeeIds.forEach(id => workload[id] = 0);
    docs.forEach(d => {
        if (workload[d.current_assignee] !== undefined) {
            workload[d.current_assignee]++;
        }
    });

    // Find min
    let bestEmployeeId = employeeIds[0];
    let minTasks = workload[bestEmployeeId];

    for (const id of employeeIds) {
        if (workload[id] < minTasks) {
            minTasks = workload[id];
            bestEmployeeId = id;
        }
    }

    // C. Apelăm funcția standard de approve cu ID-ul găsit
    await this.approve(docId, currentUserId, bestEmployeeId);
    
    return bestEmployeeId;
  },

  // ==============================================================
  // B. LISTE DE DOSARE (CITIRE)
  // ==============================================================

  async getInitialQueue() {
    const { data, error } = await supabase
      .from('documents')
      .select('*') 
      .eq('workflow_stage', 'submitted') 
      .is('current_assignee', null)      
      .order('created_at', { ascending: true }); 

    if (error) throw error;
    return data;
  },

  async getMyTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('current_assignee', user.id)
      .neq('workflow_stage', 'completed')
      .neq('workflow_stage', 'rejected')
      .order('updated_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getMyProcessedHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get IDs from history
    const { data: history, error: histError } = await supabase
        .from('workflow_history')
        .select('document_id, created_at')
        .eq('action_by', user.id)
        .order('created_at', { ascending: false });

    if (histError) throw histError;

    if (!history.length) return [];

    const docIds = [...new Set(history.map(h => h.document_id))];

    const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('*')
        .in('id', docIds);

    if (docError) throw docError;
    return docs;
  },

  async getColleaguesByDepartment(deptName) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'angajat')
      .eq('department', deptName);

    if (error) throw error;
    return data;
  }
};
