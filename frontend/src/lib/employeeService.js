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
   * ȘTERGE DOAR CERTIFICATUL DE APROBARE (Undo)
   * Nu afectează alte fișiere semnate manual.
   */
  async removeSignature(docId) {
    // 1. Căutăm fișierul de tip Certificat
    const { data: files } = await supabase
        .from('document_files')
        .select('*')
        .eq('document_id', docId)
        .ilike('file_name', '%Certificat%');

    if (!files || files.length === 0) {
        throw new Error("Nu am găsit niciun certificat de anulat.");
    }

    const certFile = files[0];

    // 2. Ștergem fizic din Storage
    await supabase.storage
        .from('dms-files')
        .remove([certFile.file_url]);

    // 3. Ștergem din Baza de Date (Cascade va șterge semnătura legată strict de acest fișier)
    // NU ștergem alte semnături de pe alte fișiere.
    const { error: dbError } = await supabase
        .from('document_files')
        .delete()
        .eq('id', certFile.id);

    if (dbError) throw dbError;

    // 4. Ștergem intrarea din istoric specifică generării certificatului
    // Căutăm intrări recente de tip 'signature' care menționează 'Certificat' sau 'Aprobare'
    await supabase
        .from('workflow_history')
        .delete()
        .eq('document_id', docId)
        .eq('action_type', 'signature')
        .ilike('comment', '%finalizat dosarul%'); // Sau un text specific din handleGenerateCertificate
        // Nota: handleGenerateCertificate pune doar addSignature care pune un text generic?
        // Nu, addSignature pune "A aplicat semnătura digitală..."
        // handleGenerateCertificate nu pune un comment specific in history decat prin addSignature.
        
        // Daca vrem sa fim precisi, stergem ultima semnatura 'globala'? 
        // addSignature pune: comment: `A aplicat semnătura digitală (ID: ${uniqueCode})`
        
        // Mai bine lăsăm istoricul (audit) sau ștergem doar ultima intrare a utilizatorului.
        // Pentru simplitate și siguranță, nu ștergem istoric generic, doar fișierul.
        // Utilizatorul poate genera un nou certificat.
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

    // D. UPLOAD CA FIȘIER NOU (evităm problemele de permisiuni la suprascriere/upsert)
    // Strategia: Upload Nou -> Insert DB Nou -> Delete DB Vechi -> Delete Storage Vechi
    
    const timestamp = Date.now();
    // Curățăm numele vechi de eventuale prefixe de timestamp
    const cleanFileName = originalFile.file_name.replace(/^\d+_/, '').replace(/^Semnat_/, ''); 
    const newStoragePath = `${docId}/${timestamp}_Semnat_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('dms-files')
      .upload(newStoragePath, pdfBytes, {
        contentType: 'application/pdf'
      });

    if (uploadError) throw uploadError;

    // E. ACTUALIZĂM TABELELE SQL

    // 1. Inserăm noul fișier în document_files
    const { data: newFileRec, error: insertError } = await supabase
        .from('document_files')
        .insert({
            document_id: docId,
            file_name: originalFile.file_name, // Păstrăm numele original pentru display
            file_url: newStoragePath,
            uploaded_by: user.id, // Noul utilizator devine owner
            is_signed: true
        })
        .select()
        .single();
    
    if (insertError) throw insertError;

    // 2. Ștergem înregistrarea veche din document_files
    // (Atenție: dacă există semnături legate prin FK de file_id, ele se vor șterge prin CASCADE. 
    // Dar certificatul generat inițial nu are semnături legate de file_id în mod explicit în codul curent)
    const { error: deleteError } = await supabase
        .from('document_files')
        .delete()
        .eq('id', originalFile.id);

    if (deleteError) throw deleteError;

    // 3. Încercăm să ștergem fișierul fizic vechi (curățenie)
    // Ignorăm eroarea dacă nu avem drepturi (dar ar trebui să avem drept de delete prin RLS pe tabelă, nu neapărat pe storage)
    try {
        await supabase.storage.from('dms-files').remove([originalFile.file_url]);
    } catch (e) {
        console.warn("Nu s-a putut șterge fișierul vechi (posibil restricții RLS):", e);
    }

    // 4. Aflăm stadiul curent (ex: review_step3)
    const { data: docInfo } = await supabase
        .from('documents')
        .select('workflow_stage')
        .eq('id', docId)
        .single();

    const currentStage = docInfo?.workflow_stage || 'review_step3';

    // 2. Inserăm Semnătura
    await supabase.from('signatures').insert({
        document_id: docId,
        signed_by: user.id,
        signature_text: `Aprobare Finală - ${signerNameZ} (ID: ${uniqueCode})`,
        workflow_stage: currentStage // Salvăm stadiul corect
    });

    // 3. Inserăm în Istoric (AICI ERA PROBLEMA)
    await supabase.from('workflow_history').insert({
        document_id: docId,
        action_by: user.id,
        action_type: 'stage_change', // E o schimbare de stadiu (finalizare)
        from_stage: currentStage,    // <--- FIX: Acum trimitem 'review_step3'
        to_stage: 'completed',       // <--- Destinația
        comment: `A contrasemnat certificatul și a finalizat dosarul. (ID: ${uniqueCode})`
    });

    // 4. Marcăm documentul ca finalizat
    await supabase.from('documents')
      .update({ 
          workflow_stage: 'completed',
          completed_at: new Date().toISOString() // E bine să fie ISO string
      })
      .eq('id', docId);
  },

  /**
   * 19. SEMNARE DOCUMENT CU POZIȚIONARE MANUALĂ
   * Primește lista de semnături { page, xRatio, yRatio } și le aplică pe PDF.
   */
  async signDocumentWithCoordinates(docId, fileId, signatures) {
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch profile to get Full Name
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
    
    const signerName = profile?.full_name || user.email;

    // 1. Luăm informațiile fișierului
    const { data: fileData, error: fileError } = await supabase
        .from('document_files')
        .select('*')
        .eq('id', fileId)
        .single();
    
    if (fileError) throw fileError;

    // 2. Descărcăm PDF-ul
    const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('dms-files')
        .download(fileData.file_url);

    if (downloadError) throw downloadError;

    // 3. Încărcăm în PDF-Lib
    const pdfBuffer = await fileBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    // Fonturi
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    const uniqueCode = 'SIG-M-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const dateStr = new Date().toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const sigWidth = 180;
    const sigHeight = 60;
    const officialBlue = rgb(0, 0.196, 0.588);

    // 4. Aplicăm semnăturile
    for (const sig of signatures) {
        // Indexul paginii (UI e 1-based, array e 0-based)
        const pageIndex = sig.page - 1; 
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        const rotation = page.getRotation().angle;

        // Conversie Coordonate cu Rotație
        let x, y;
        
        if (rotation === 0) {
            x = width * sig.xRatio;
            y = height - (height * sig.yRatio);
        } else if (rotation === 90) {
            // La 90 grade, coordonatele sunt rotite
            x = width * sig.yRatio;
            y = height * sig.xRatio;
        } else if (rotation === 180) {
            x = width * (1 - sig.xRatio);
            y = height * sig.yRatio;
        } else if (rotation === 270) {
            x = width * (1 - sig.yRatio);
            y = height * (1 - sig.xRatio);
        } else {
             // Fallback
             x = width * sig.xRatio;
             y = height - (height * sig.yRatio);
        }

        // Desenăm centrând pe punctul click-ului
        const drawX = x - (sigWidth / 2);
        const drawY = y - (sigHeight / 2);

        // Chenar (Roșu pentru vizibilitate maximă temporar, sau Albastru închis oficial)
        // Revenim la Albastru, dar cu background semi-transparent pentru contrast
        page.drawRectangle({
            x: drawX,
            y: drawY,
            width: sigWidth,
            height: sigHeight,
            borderColor: officialBlue,
            borderWidth: 2,
            color: rgb(1, 1, 1), // Fundal alb
            opacity: 0.9, // Opacitate mare să acopere scrisul de dedesubt
        });
        
        // Redesenăm chenarul doar contur peste fundal
        page.drawRectangle({
            x: drawX,
            y: drawY,
            width: sigWidth,
            height: sigHeight,
            borderColor: officialBlue,
            borderWidth: 2,
            opacity: 1,
        });

        // Text
        page.drawText("DOCUMENT VERIFICAT", {
            x: drawX + 10,
            y: drawY + 35,
            size: 10,
            font: timesBold,
            color: officialBlue,
        });

        page.drawText(`Semnat digital: ${signerName}`, {
            x: drawX + 10,
            y: drawY + 20,
            size: 9,
            font: helveticaFont,
            color: officialBlue,
        });

        page.drawText(`Data: ${dateStr} | ID: ${uniqueCode}`, {
            x: drawX + 10,
            y: drawY + 8,
            size: 7,
            font: helveticaFont,
            color: officialBlue,
        });
    }

    // 5. Salvăm PDF-ul Nou
    const pdfBytes = await pdfDoc.save();
    
    // 6. Gestionăm RLS și Cache-ul: Ștergem și Re-inserăm
    // Pas A: Luăm semnăturile vechi ca să nu le pierdem
    const { data: oldSignatures } = await supabase
        .from('signatures')
        .select('*')
        .eq('file_id', fileId);

    // Pas B: Upload fișier nou (Path nou)
    const timestamp = Date.now();
    const originalPath = fileData.file_url;
    const pathParts = originalPath.split('/');
    const folder = pathParts[0];
    const newStoragePath = `${folder}/${timestamp}_signed_${fileData.file_name}`;

    const { error: uploadError } = await supabase.storage
        .from('dms-files')
        .upload(newStoragePath, pdfBytes, { contentType: 'application/pdf' });
    if (uploadError) throw uploadError;

    // Pas C: Ștergem înregistrarea veche din DB (Cascade va șterge semnăturile vechi din tabela signatures)
    // Dar întâi ștergem fișierul fizic vechi
    await supabase.storage.from('dms-files').remove([originalPath]);
    
    const { error: deleteError } = await supabase
        .from('document_files')
        .delete()
        .eq('id', fileId);
    if (deleteError) throw deleteError;

    // Pas D: Inserăm noua înregistrare (Fișierul Semnat)
    // Putem păstra numele original la afișare
    const { data: newFile, error: insertError } = await supabase
        .from('document_files')
        .insert({
            document_id: docId,
            file_name: fileData.file_name, // Păstrăm numele
            file_url: newStoragePath,
            uploaded_by: user.id, // Sau fileData.uploaded_by dacă vrem să păstrăm owner-ul original?
                                  // Dacă user-ul curent e angajat, el devine owner-ul noii versiuni. E ok.
            is_signed: true
        })
        .select()
        .single();
    if (insertError) throw insertError;

    // Pas E: Restaurăm semnăturile vechi (legate de noul ID)
    if (oldSignatures && oldSignatures.length > 0) {
        const signaturesToRestore = oldSignatures.map(sig => ({
            ...sig,
            id: undefined, // Generăm ID nou
            file_id: newFile.id // Legăm de noul fișier
        }));
        await supabase.from('signatures').insert(signaturesToRestore);
    }

    // Get current stage for signature record
    const { data: docInfo } = await supabase
        .from('documents')
        .select('workflow_stage')
        .eq('id', docId)
        .single();

    // Insert into signatures table (Noua semnătură)
    await supabase.from('signatures').insert({
        document_id: docId,
        file_id: newFile.id,
        signed_by: user.id,
        signature_text: `Semnat digital: ${signerName} (ID: ${uniqueCode})`,
        workflow_stage: docInfo?.workflow_stage || 'unknown'
    });

    // 8. Log History
    await supabase.from('workflow_history').insert({
        document_id: docId,
        action_by: user.id,
        action_type: 'signature',
        comment: `A semnat manual documentul: ${fileData.file_name} (ID: ${uniqueCode})`
    });

    return true;
  }
};
