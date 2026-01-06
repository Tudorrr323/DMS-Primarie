import { supabase } from '../lib/supabase';
import { WORKFLOW_STAGES } from './workflow-utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
   * Mută dosarul din "Coadă" în "Dosarele Mele" (review_step1 sau stadiul curent).
   */
  async assignToMe(docId, userId, targetStage = 'review_step1') {
    // 1. Update Document
    const { error } = await supabase
      .from('documents')
      .update({
        current_assignee: userId,
        workflow_stage: targetStage, 
        updated_at: new Date().toISOString()
      })
      .eq('id', docId);

    if (error) throw error;

    const stageLabel = WORKFLOW_STAGES[targetStage]?.label || targetStage;

    // 2. Log History
    await supabase.from('workflow_history').insert({
      document_id: docId,
      action_by: userId,
      action_type: 'stage_change',
      from_stage: 'submitted', // TODO: Aici ar trebui să luăm stadiul anterior din DB, dar simplificăm momentan
      to_stage: targetStage,
      comment: `Preluat manual din coada de așteptare (Etapa: ${stageLabel}).`
    });
  },

  /**
   * 2. APROBĂ DOSARUL (STANDARD / MANUAL)
   * Mută dosarul la pasul următor.
   */
  async approve(docId, currentUserId, targetAssigneeId = null, nextStage = 'review_step2', currentStage = 'review_step1') {
    
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

    const stageLabel = WORKFLOW_STAGES[nextStage]?.label || nextStage;

    // 2. Log History
    await supabase.from('workflow_history').insert({
      document_id: docId,
      action_by: currentUserId,
      action_type: 'stage_change',
      from_stage: currentStage,
      to_stage: nextStage,
      comment: targetAssigneeId 
        ? `Aprobat și alocat manual unui coleg pentru ${stageLabel}.` 
        : `Aprobat și trimis la pasul: ${stageLabel}.`
    });
  },

  /**
   * 3. APROBĂ DOSARUL (AUTO-ASSIGN / SMART)
   * Caută automat colegul cel mai liber din departamentul următor.
   */
  async approveAutoAssign(docId, currentUserId, nextDepartment, nextStage = 'review_step2', currentStage = 'review_step1') {
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
    await this.approve(docId, currentUserId, bestEmployeeId, nextStage, currentStage);
    
    return bestEmployeeId;
  },

  // ==============================================================
  // B. LISTE DE DOSARE (CITIRE)
  // ==============================================================

  async getQueue(stage) {
    const { data, error } = await supabase
      .from('documents')
      .select('*') 
      .eq('workflow_stage', stage) 
      .is('current_assignee', null)      
      .order('created_at', { ascending: true }); 

    if (error) throw error;
    return data;
  },

  async getInitialQueue() {
    return this.getQueue('submitted');
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
  },

  /**
   * ADAUGĂ SEMNĂTURA (Fără să mute dosarul)
   * Se apelează când funcționarul apasă "Semnează".
   */
  async addSignature(docId, currentStage) {
    const { data: { user } } = await supabase.auth.getUser();
    // Generăm un cod unic pentru aspect profesional (ex: SIG-X9A2B...)
    const uniqueCode = 'SIG-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    // 1. Inserăm în tabela SIGNATURES (Arhiva de semnături)
    const { error: sigError } = await supabase
      .from('signatures')
      .insert({
        document_id: docId,
        signed_by: user.id,
        // Textul oficial care apare pe document
        signature_text: `Semnat digital de ${user.email} - ID: ${uniqueCode}`,
        workflow_stage: currentStage // Salvăm la ce pas s-a semnat (ex: review_step2)
      });

    if (sigError) throw sigError;

    // 2. (Opțional) Actualizăm și metadata pe Documentul Principal
    // Ca să știm cine a fost ULTIMUL care a semnat
    await supabase
      .from('documents')
      .update({
        signed_by: user.id, // Ultimul semnatar
        signature_hash: uniqueCode,
        updated_at: new Date()
      })
      .eq('id', docId);

    // 3. Log în Istoric
    await supabase.from('workflow_history').insert({
        document_id: docId,
        action_by: user.id,
        action_type: 'signature',
        from_stage: currentStage, 
        to_stage: currentStage, // Rămâne în același stadiu
        comment: `A aplicat semnătura digitală (ID: ${uniqueCode})`
    });

    return uniqueCode;
  },

  /**
   * ȘTERGE SEMNĂTURA PROPRIE (Unsign)
   * Elimină semnătura din tabelă, din istoric și șterge certificatul generat.
   */
  async removeSignature(docId) {
    // 1. Căutăm și ștergem fișierul fizic (Certificatul)
    try {
        const { data: files } = await supabase
            .from('document_files')
            .select('*')
            .eq('document_id', docId)
            .ilike('file_name', '%Certificat%');

        if (files && files.length > 0) {
            const file = files[0];
            
            // A. Ștergem din Storage
            const { error: storageError } = await supabase.storage
                .from('dms-files')
                .remove([file.file_url]);
            
            if (storageError) {
                console.error("Eroare la ștergerea fișierului din Storage:", storageError);
            } else {
                // B. Ștergem din Baza de Date doar dacă s-a șters din Storage
                await supabase
                    .from('document_files')
                    .delete()
                    .eq('id', file.id);
            }
        }
    } catch (err) {
        console.warn("Nu s-a putut șterge fișierul certificat (posibil inexistent):", err);
    }

    // 2. Apelăm procedura stocată pentru a șterge semnătura și a da revert la status
    const { error } = await supabase.rpc('remove_my_signature', {
      doc_id: docId
    });

    if (error) throw error;
  },

  /**
   * 18. CONTRASEMNEAZĂ UN PDF EXISTENT
   * Adaugă a doua semnătură pe fișierul fizic + updatează DB
   */
  async counterSignPdf(docId) {
    const { data: { user } } = await supabase.auth.getUser();

    // Luăm numele complet al funcționarului Z
    const { data: profileZ } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const signerNameZ = profileZ?.full_name || user.email;

    // A. GĂSIM FIȘIERUL DE TIP CERTIFICAT
    const { data: files } = await supabase
      .from('document_files')
      .select('*')
      .eq('document_id', docId)
      .ilike('file_name', '%Certificat%') 
      .limit(1);

    if (!files || files.length === 0) {
      throw new Error("Nu am găsit certificatul inițial pentru a-l semna!");
    }

    const originalFile = files[0];

    // B. DESCĂRCĂM FIȘIERUL DIN STORAGE
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('dms-files')
      .download(originalFile.file_url);

    if (downloadError) throw downloadError;

    // C. MODIFICĂM PDF-ul
    const pdfBuffer = await fileBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const uniqueCode = 'SIG-Z-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const dateStr = new Date().toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // COORDONATE SIMETRICE (Conversie mm -> points)
    // 1mm = 2.835 pt
    const mmToPt = 2.835;

    // Y (Dreapta): Center=140mm, BoxX=105mm, BoxW=70mm
    // Z (Stânga):  Center=70mm,  BoxX=35mm,  BoxW=70mm
    
    const centerMm = 70;
    const boxXMm = 35;
    const boxWidthMm = 70;
    const boxHeightMm = 30;

    // Y Position from Top (match jsPDF)
    const titleYMm = 150;
    const boxTopYMm = 155;
    const nameYMm = 165;
    const dateYMm = 175;
    const idYMm = 180;

    // Convert to PDF-Lib coordinates (Origin Bottom-Left)
    const centerX = centerMm * mmToPt;
    const boxX = boxXMm * mmToPt;
    const boxWidth = boxWidthMm * mmToPt;
    const boxHeight = boxHeightMm * mmToPt;

    const topY = height - (boxTopYMm * mmToPt); // Bottom-left Y of the box is topY - boxHeight
    const boxY = topY - boxHeight;

    const officialBlue = rgb(0, 0.196, 0.588); // Albastru oficial (#003296)

    // 1. Titlu "AVIZAT," (deasupra chenarului)
    const titleText = "AVIZAT,";
    const titleWidth = timesBold.widthOfTextAtSize(titleText, 14);
    
    // Y pos for title: 150mm from top -> height - 150*pt
    const titleY = height - (titleYMm * mmToPt);

    firstPage.drawText(titleText, {
      x: centerX - (titleWidth / 2),
      y: titleY,
      size: 14,
      font: timesBold,
      color: officialBlue,
    });

    // 2. Chenar
    firstPage.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      borderColor: officialBlue,
      borderWidth: 1,
    });

    // 3. Nume Funcționar Z (în interior)
    const nameWidth = timesItalic.widthOfTextAtSize(signerNameZ, 16);
    // Y pos for name: 165mm from top -> height - 165*pt
    const nameY = height - (nameYMm * mmToPt);

    firstPage.drawText(signerNameZ, {
      x: centerX - (nameWidth / 2), 
      y: nameY, 
      size: 16,
      font: timesItalic,
      color: officialBlue,
    });

    // 4. Detalii (Data și ID)
    const detailDate = `Semnat digital la: ${dateStr}`;
    const detailID = `ID Semnatar: ${user.id.slice(0, 8)}...`;

    const dateWidth = helveticaFont.widthOfTextAtSize(detailDate, 8);
    const dateY = height - (dateYMm * mmToPt);

    firstPage.drawText(detailDate, {
      x: centerX - (dateWidth / 2),
      y: dateY,
      size: 8,
      font: helveticaFont,
      color: officialBlue,
    });

    const idWidth = helveticaFont.widthOfTextAtSize(detailID, 8);
    const idY = height - (idYMm * mmToPt);

    firstPage.drawText(detailID, {
      x: centerX - (idWidth / 2),
      y: idY,
      size: 8,
      font: helveticaFont,
      color: officialBlue,
    });

    // Salvăm PDF-ul modificat
    const pdfBytes = await pdfDoc.save();

    // D. SUPRASCRIEM FIȘIERUL ÎN STORAGE
    const { error: uploadError } = await supabase.storage
      .from('dms-files')
      .upload(originalFile.file_url, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true 
      });

    if (uploadError) throw uploadError;

    // E. ACTUALIZĂM TABELELE SQL
    await supabase.from('signatures').insert({
        document_id: docId,
        signed_by: user.id,
        signature_text: `Aprobare Finală - ${signerNameZ} (ID: ${uniqueCode})`,
        workflow_stage: 'review_step3'
    });

    await supabase.from('workflow_history').insert({
        document_id: docId,
        action_by: user.id,
        action_type: 'signature',
        to_stage: 'completed',
        comment: `A contrasemnat certificatul și a finalizat dosarul. (ID: ${uniqueCode})`
    });
    
     await supabase.from('documents')
      .update({ 
          workflow_stage: 'completed',
          completed_at: new Date()
      })
      .eq('id', docId);
  }
};
