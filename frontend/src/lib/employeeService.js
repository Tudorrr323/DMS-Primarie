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
   * Apelează funcția SQL care mută dosarul și scrie în istoric automat.
   */
  async assignToMe(docId, userId) {
    // Apelăm procedura stocată din baza de date
    const { error } = await supabase.rpc('assign_to_me', {
      p_doc_id: docId
    });

    if (error) throw error;
  },

  /**
   * 2. APROBĂ DOSARUL (STANDARD / MANUAL)
   * Apelează SQL pentru a muta dosarul la pasul următor definit în baza de date.
   */
  async approve(docId, targetAssigneeId = null) {
    // Apelăm procedura stocată 'process_document' cu acțiunea 'approve'
    // Logica de tranziție (ex: step1 -> step2) este exclusiv în SQL
    const { error } = await supabase.rpc('process_document', {
      p_doc_id: docId,
      p_action: 'approve',
      p_target_assignee: targetAssigneeId
    });

    if (error) throw error;
  },

  /**
   * 3. RESPINGE DOSARUL
   * Apelează SQL pentru a marca dosarul ca rejected.
   */
  async reject(docId, reason) {
    const { error } = await supabase.rpc('process_document', {
      p_doc_id: docId,
      p_action: 'reject',
      p_reason: reason
    });

    if (error) throw error;
  },

  /**
   * 3. APROBĂ DOSARUL (AUTO-ASSIGN / SMART)
   * Folosește funcția SQL pentru a găsi instant angajatul cel mai liber.
   */
  async approveAutoAssign(docId, nextDepartment) {
    // A. Apelăm RPC pentru a găsi ID-ul optim
    const { data: bestEmployeeId, error: calcError } = await supabase
        .rpc('get_least_loaded_employee', { p_dept: nextDepartment });

    if (calcError) throw calcError;
    if (!bestEmployeeId) throw new Error(`Nu există angajați disponibili în departamentul ${nextDepartment}`);

    // B. Apelăm funcția standard de approve (care acum folosește RPC-ul process_document)
    await this.approve(docId, bestEmployeeId);
    
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
    // Generăm un cod unic vizual (opțional, pentru că DB-ul are ID-uri, dar bun pentru UI)
    const uniqueCode = 'SIG-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const signatureText = `Semnat digital de ${user.email} - ID: ${uniqueCode}`;

    // Apelează RPC-ul care face Insert în signatures + Insert în workflow_history
    // Trimitem explicit p_file_id: null pentru a evita ambiguitatea cu funcția SQL supraincărcată
    const { error } = await supabase.rpc('sign_document', {
      p_doc_id: docId,
      p_signature_text: signatureText,
      p_file_id: null
    });

    if (error) throw error;

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

    // 2. Inregistram Semnatura prin RPC
    // Aceasta pune si in tabela signatures si in workflow_history (generic)
    await supabase.rpc('sign_document', {
        p_doc_id: docId,
        p_signature_text: `Aprobare Finală - ${signerNameZ} (ID: ${uniqueCode})`,
        p_file_id: newFileRec.id
    });

    // 3. Finalizăm Documentul prin RPC (Trece automat la 'completed')
    // process_document se ocupa de update documents + insert workflow_history (stage change)
    await supabase.rpc('process_document', {
        p_doc_id: docId,
        p_action: 'approve',
        p_target_assignee: null // Nu mai are assignee la final
    });
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

    // Insert into signatures table (Noua semnătură) + History prin RPC
    const signatureText = `Semnat digital: ${signerName} (ID: ${uniqueCode})`;
    
    await supabase.rpc('sign_document', {
        p_doc_id: docId,
        p_signature_text: signatureText,
        p_file_id: newFile.id
    });

    return true;
  }
};
