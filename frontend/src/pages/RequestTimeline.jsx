import jsPDF from 'jspdf';
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { DocumentService } from '../lib/documentService';
import { EmployeeService } from '../lib/employeeService';
import { getWorkflowStageInfo } from '../lib/workflow-utils';
import PDFPreview from '../components/PDFPreview';
import PDFSigner from '../components/PDFSigner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileText, Download, Send, XCircle, CheckCircle, UserPlus, Users, Upload, Trash2, PenTool, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RequestTimeline() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [request, setRequest] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewFileId, setPreviewFileId] = useState(null);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  
  // Signing State
  const [signingFile, setSigningFile] = useState(null); // The file object info
  const [signingFileUrl, setSigningFileUrl] = useState(null); // The actual Blob URL
  
  // Actions state
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  
  // Manual Assignment State
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleague, setSelectedColleague] = useState('');
  const [nextDept, setNextDept] = useState(null); // Dynamic next department
  
  const fileInputRef = useRef(null);

  const renderTimelineItems = () => (
      <div className="relative border-l border-slate-200 ml-3 space-y-8 pb-4">
          {request.workflow_history && request.workflow_history.length > 0 ? (
              request.workflow_history.map((entry, i) => (
                  <div key={entry.id} className="ml-6 relative">
                      <div className="absolute -left-[31px] mt-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 ring-4 ring-white"></div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                          <div>
                              <p className="text-sm font-medium text-slate-900">
                                  {entry.action_type === 'stage_change' ? 'Schimbare Status' : 
                                   entry.action_type === 'comment' ? 'Notă Internă' : 
                                   entry.action_type === 'rejection' ? 'Cerere Respinsă' : 
                                   entry.action_type === 'file_upload' ? 'Fișier Încărcat' : 
                                   entry.action_type === 'file_delete' ? 'Ștergere Fișier' : 
                                   entry.action_type === 'signature' ? 'Dosar Semnat' : 'Acțiune'}
                              </p>
                              <p className="text-sm text-slate-500 mt-1">{entry.comment || "Fără comentarii."}</p>
                              {entry.action_by_profile && (
                                  <p className="text-xs text-blue-600 mt-1 font-medium">
                                      De: {entry.action_by_profile.full_name || "Utilizator"} ({entry.action_by_profile.role})
                                  </p>
                              )}
                          </div>
                          <time className="text-xs text-slate-400 whitespace-nowrap mt-1 sm:mt-0">
                              {new Date(entry.created_at).toLocaleString('ro-RO')}
                          </time>
                      </div>
                  </div>
              ))
          ) : (
              <p className="ml-6 text-sm text-slate-400">Nu există istoric disponibil.</p>
          )}
      </div>
  );

  const handleOpenSigner = async (file) => {
      try {
          toast.info("Se descarcă documentul pentru semnare...");
          
          const { data, error } = await supabase.storage
            .from('dms-files')
            .download(file.file_url);
            
          if (error) throw error;

          const url = URL.createObjectURL(data);
          setSigningFileUrl(url);
          setSigningFile(file);
      } catch (err) {
          toast.error("Nu s-a putut deschide fișierul: " + err.message);
      }
  };

  const handleSaveSignature = async (signatures) => {
      try {
          toast.info("Se aplică semnăturile...");
          await EmployeeService.signDocumentWithCoordinates(request.id, signingFile.id, signatures);
          toast.success("Document semnat cu succes!");
          
          // Cleanup
          if (signingFileUrl) URL.revokeObjectURL(signingFileUrl);
          setSigningFile(null);
          setSigningFileUrl(null);
          
          window.location.reload();
      } catch (err) {
          console.error(err);
          toast.error("Eroare la semnare: " + err.message);
      }
  };

  const handleCancelSigner = () => {
      if (signingFileUrl) URL.revokeObjectURL(signingFileUrl);
      setSigningFile(null);
      setSigningFileUrl(null);
  };

  const handleGenerateCertificate = async () => {
    try {
      toast.info("Se generează și se semnează certificatul...");
      
      const doc = new jsPDF();
      
      // Funcție utilitară pentru a elimina diacriticele (pentru compatibilitate PDF standard)
      const removeDiacritics = (str) => {
          if (!str) return "";
          return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      };

      // --- ANTET ---
      doc.setFont("times", "bold"); 
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 40);
      doc.text("PRIMARIA MUNICIPIULUI", 105, 20, null, null, "center");
      
      doc.setFontSize(16);
      doc.text("CERTIFICAT DE APROBARE", 105, 30, null, null, "center");
      
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // --- DETALII ---
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      const requesterName = removeDiacritics(request.requester_profile?.full_name || 'Solicitant');
      doc.text(`Catre: ${requesterName}`, 20, 50);
      doc.text(`Nr. Inregistrare: #${request.id.slice(0, 8)}`, 20, 60);
      doc.text(`Data: ${new Date().toLocaleDateString('ro-RO')}`, 20, 70);
      
      // --- CORP TEXT ---
      doc.setFontSize(12);
      // Text fără diacritice pentru a evita spațiile goale
      const titleClean = removeDiacritics(request.title);
      const dateClean = new Date(request.created_at).toLocaleDateString('ro-RO');
      
      const text = `      Urmare a cererii dumneavoastra "${titleClean}", inregistrata la data de ${dateClean}, va comunicam ca documentatia a fost verificata si VALIDATA de catre departamentele noastre.`;
      
      const splitText = doc.splitTextToSize(text, 160);
      doc.text(splitText, 20, 90);

      doc.text("Prezentul document tine loc de aviz favorabil.", 20, 120);

      // --- SEMNĂTURĂ ---
      const signerName = removeDiacritics(profile?.full_name || user?.email || "Director General");
      
      doc.setTextColor(0, 50, 150);
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      doc.text("SE APROBA,", 140, 150, null, null, "center");
      
      doc.setFont("times", "italic");
      doc.setFontSize(16);
      doc.text(signerName, 140, 165, null, null, "center");
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Semnat digital la: ${new Date().toLocaleString('ro-RO')}`, 140, 175, null, null, "center");
      
      const shortId = user.id ? user.id.slice(0, 8) : 'unknown';
      doc.text(`ID Semnatar: ${shortId}...`, 140, 180, null, null, "center");
      
      // Chenar semnătură
      doc.setDrawColor(0, 50, 150);
      doc.rect(105, 155, 70, 30); 

      // --- OUTPUT ---
      const pdfBlob = doc.output('blob');
      const fileName = `Certificat_Aprobare_${request.id.slice(0, 6)}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      await DocumentService.uploadFile(id, file);

      // 7. Notăm semnarea prin serviciul specializat
      await EmployeeService.addSignature(id, request.workflow_stage);

      toast.success("Certificat generat și semnat cu succes!");
      window.location.reload();

    } catch (err) {
      console.error(err);
      toast.error("Eroare la generare/semnare: " + err.message);
    }
  };
  const handleDeleteFile = async (fileId, filePath, fileName) => {
      if (!confirm(`Ești sigur că vrei să ștergi fișierul "${fileName}"?`)) return;

      try {
          // Pass request.id (documentId) and fileName to the service
          await DocumentService.deleteFile(fileId, filePath, fileName, request.id);
          toast.success("Fișier șters cu succes!");
          window.location.reload();
      } catch (err) {
          toast.error("Eroare la ștergere: " + err.message);
      }
  };

  const handleDeleteRequest = async () => {
    if (!confirm("Ești sigur că vrei să ștergi ACEASTĂ CERERE DEFINITIV? Această acțiune nu poate fi anulată!")) return;
    
    try {
        setLoading(true);
        await DocumentService.deleteRequest(id);
        toast.success("Cererea a fost ștearsă!");
        // Redirect to requests list
        window.location.href = '/requests';
    } catch (err) {
        toast.error("Eroare la ștergerea cererii: " + err.message);
        setLoading(false);
    }
  };

  const handleAssignToMe = async () => {
      try {
          await EmployeeService.assignToMe(id);
          toast.success("Dosar preluat cu succes!");
          window.location.reload();
      } catch (err) {
          toast.error("Eroare la preluare: " + err.message);
      }
  };

  const handleRevokeSignature = async () => {
      if (!confirm("Ești sigur că vrei să anulezi semnătura? Acest lucru va permite generarea unui nou certificat.")) return;
      try {
          await EmployeeService.removeSignature(id);
          toast.success("Semnătura a fost revocată!");
          window.location.reload();
      } catch (err) {
          toast.error("Eroare la revocare: " + err.message);
      }
  };

  const handleCounterSign = async () => {
      try {
          toast.info("Se contrasemnează documentul...");
          await EmployeeService.counterSignPdf(id);
          toast.success("Document contrasemnat și finalizat!");
          window.location.reload();
      } catch (err) {
          toast.error("Eroare la contrasemnare: " + err.message);
      }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        toast.info("Se încarcă fișierul...");
        await DocumentService.uploadFile(id, file);
        
        toast.success("Fișier încărcat cu succes!");
        window.location.reload();
    } catch (err) {
        toast.error("Eroare la încărcare: " + err.message);
    }
  };

  useEffect(() => {
    const fetchFullData = async () => {
      try {
        setLoading(true);
        
        // 1. Get Request Details
        const data = await DocumentService.getById(id);
        setRequest(data);

        // Determine Next Department based on current stage
        let targetDept = null;
        if (data.workflow_stage === 'review_step1' || data.workflow_stage === 'submitted') {
            targetDept = 'verificare_tehnica';
        } else if (data.workflow_stage === 'review_step2') {
            targetDept = 'verificare_finala';
        } else if (data.workflow_stage === 'review_step3') {
            targetDept = null; // Final stage, no next department
        }
        setNextDept(targetDept);

        // 2. Get User Profile (to check permissions)
        if (user) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(prof);

            // 3. If Employee and there is a next dept, fetch colleagues
            if (prof?.role === 'angajat' && targetDept) {
                 const cols = await EmployeeService.getColleaguesByDepartment(targetDept);
                 setColleagues(cols);
            }
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFullData();
  }, [id, user]);

  const handleDownload = async (path, originalName) => {
    try {
        const { data, error } = await supabase.storage
            .from('dms-files')
            .download(path);
        
        if (error) throw error;

        // Create blob link to download
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', originalName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        toast.error("Eroare download: " + err.message);
    }
  };

  const handleAction = async (actionType) => {
    try {
        if (actionType === 'finalize') {
             // Aprobare finală (fără assignee)
             await EmployeeService.approve(id, null);
             toast.success("Dosar finalizat!");
        } else if (actionType === 'auto_assign') {
            await EmployeeService.approveAutoAssign(id, nextDept);
            toast.success("Trimis automat!");
        } else if (actionType === 'manual_assign') {
            if (!selectedColleague) {
                toast.error("Selectează un coleg!");
                return;
            }
            await EmployeeService.approve(id, selectedColleague);
            toast.success("Alocat manual!");
        } else if (actionType === 'send_to_pool') {
            await EmployeeService.approve(id, null);
            toast.success("Trimis în coada comună!");
        } else if (actionType === 'reject') {
            if (!rejectReason) {
                toast.error("Motivul este obligatoriu!");
                return;
            }
            // Folosim noua metodă din service care apelează RPC-ul
            await EmployeeService.reject(id, rejectReason);
            toast.error("Cerere Refuzată.");
        }
        
        // Refresh page
        window.location.reload();
    } catch (err) {
        toast.error("Eroare: " + err.message);
    }
  };

  const isEmployee = profile?.role === 'angajat';
  const isAssignedToMe = request?.current_assignee === user?.id;
  const currentStage = request?.workflow_stage;
  const myDept = profile?.department;

  const canProcess = isEmployee && (
      (currentStage === 'submitted' && myDept === 'verificare_initiala') ||
      (currentStage === 'review_step1' && myDept === 'verificare_initiala') ||
      (currentStage === 'review_step2' && myDept === 'verificare_tehnica') ||
      (currentStage === 'review_step3' && myDept === 'verificare_finala')
  );
  const isUnassigned = !request?.current_assignee;

  const stageInfo = request ? getWorkflowStageInfo(request.workflow_stage) : {};
  const isMyRequest = user && request && request.uploaded_by === user.id;
  // Cererea poate fi ștearsă doar dacă e a mea, nu sunt angajat, și nu a fost încă preluată/procesată
  const canDeleteRequest = isMyRequest && !isEmployee && request?.workflow_stage === 'submitted' && !request?.current_assignee;

  // Verificăm dacă documentul a fost deja semnat (pentru etapa tehnică)
  const isSigned = request?.workflow_history?.some(entry => entry.action_type === 'signature');
  
  // Verificăm dacă există deja un Certificat generat
  const hasCertificate = request?.document_files?.some(f => f.file_name.includes('Certificat_Aprobare'));

  // Butoanele de trimitere apar imediat (dacă nu suntem la tehnic) SAU după semnare (dacă suntem la tehnic)
  // Pentru etapa tehnică, fluxul este: Semnează/Verifică documente -> Generează Certificat -> Trimite
  // Deci permitem trimiterea dacă avem certificat.
  const showSendButtons = currentStage !== 'review_step2' || hasCertificate;

  const getBackLink = () => {
    if (!isEmployee) return '/requests';
    switch (profile?.department) {
      case 'verificare_initiala': return '/verificare-initiala';
      case 'verificare_tehnica': return '/verificare-tehnica';
      case 'verificare_finala': return '/verificare-finala';
      default: return '/';
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (error) return <div className="p-10 text-red-500">Eroare: {error}</div>;
  if (!request) return <div className="p-10">Cererea nu există.</div>;

  if (signingFile && signingFileUrl) {
      return (
          <div className="p-4 h-screen bg-slate-50">
              <PDFSigner 
                fileUrl={signingFileUrl} 
                onSave={handleSaveSignature}
                onCancel={handleCancelSigner}
              />
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 px-0 hover:bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Înapoi
        </Button>
        {canDeleteRequest && (
            <Button variant="destructive" size="sm" onClick={handleDeleteRequest}>
                <Trash2 className="mr-2 h-4 w-4" /> Șterge Cererea
            </Button>
        )}
      </div>

      {/* HEADER */}
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl mb-2">{request.title}</CardTitle>
                    <CardDescription>
                        Categorie: <span className="font-medium capitalize">{request.category.replace('_', ' ')}</span>
                    </CardDescription>
                </div>
                <Badge className={`${stageInfo.bgColor} ${stageInfo.badgeTextColor} border-0`}>
                    {stageInfo.label}
                </Badge>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Descriere</h3>
                <p className="text-slate-900 bg-slate-50 p-3 rounded-md">{request.description || "Fără descriere."}</p>
            </div>

            {/* FILES SECTION */}
            <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Fișiere Atașate</h3>
                {request.document_files && request.document_files.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {request.document_files.map(file => {
                            const isPdf = file.file_name.toLowerCase().endsWith('.pdf');
                            const isPreviewing = previewFileId === file.id;
                            const canDelete = isEmployee || (user && file.uploaded_by === user.id);
                            
                            // Verificăm dacă fișierul are o semnătură de la UTILIZATORUL CURENT
                            const signedByMe = request.signatures?.some(sig => sig.file_id === file.id && sig.signed_by === user?.id);
                            // Verificăm dacă are orice semnătură (pentru badge)
                            const isSigned = request.signatures?.some(sig => sig.file_id === file.id);

                            // Logică pentru butonul de semnare
                            const isCertificate = file.file_name.includes('Certificat_Aprobare');
                            const canSign = isEmployee && isAssignedToMe && isPdf && 
                                            (currentStage === 'review_step2' || currentStage === 'review_step3') &&
                                            !signedByMe && !isCertificate;

                            return (
                                <div key={file.id} className="border rounded-md bg-white hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="bg-blue-100 p-2 rounded">
                                                <FileText className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="truncate">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                                                    {isSigned && <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-green-100 text-green-700">Semnat</Badge>}
                                                </div>
                                                <p className="text-xs text-slate-400">{new Date(file.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {canSign && (
                                                <Button 
                                                    size="sm" 
                                                    className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs gap-1"
                                                    onClick={() => handleOpenSigner(file)}
                                                    title="Aplică semnătura manual"
                                                >
                                                    <PenTool className="h-3 w-3" />
                                                    Semnează
                                                </Button>
                                            )}
                                            {isPdf && (
                                                <Button 
                                                    variant={isPreviewing ? "secondary" : "outline"} 
                                                    size="sm" 
                                                    onClick={() => setPreviewFileId(isPreviewing ? null : file.id)}
                                                    className="gap-2"
                                                >
                                                    {isPreviewing ? 'Ascunde' : 'Previzualizare'}
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => handleDownload(file.file_url, file.file_name)}>
                                                <Download className="h-4 w-4 text-slate-600" />
                                            </Button>
                                            {canDelete && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteFile(file.id, file.file_url, file.file_name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {isPreviewing && (
                                        <div className="p-3 border-t bg-slate-50 animate-in slide-in-from-top-2 duration-200">
                                            <PDFPreview 
                                                filePath={file.file_url} 
                                                fileName={file.file_name} 
                                                onClose={() => setPreviewFileId(null)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">Niciun fișier atașat.</p>
                )}
            </div>
        </CardContent>
      </Card>

      {/* UNASSIGNED TASK PANEL */}
      {canProcess && isUnassigned && request.workflow_stage !== 'completed' && request.workflow_stage !== 'rejected' && (
          <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-6 flex items-center justify-between">
                  <div>
                      <h3 className="font-medium text-blue-900">Acest dosar așteaptă preluarea.</h3>
                      <p className="text-sm text-blue-700">Ești în departamentul potrivit pentru a procesa această cerere.</p>
                  </div>
                  <Button onClick={handleAssignToMe} className="bg-blue-600 hover:bg-blue-700">
                      Preia Dosarul
                  </Button>
              </CardContent>
          </Card>
      )}

      {/* ACTION PANEL (EMPLOYEE ONLY) */}
      {isEmployee && isAssignedToMe && request.workflow_stage !== 'completed' && request.workflow_stage !== 'rejected' && (
          <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                  <CardTitle className="text-lg text-blue-900">Panou Acțiuni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileUpload} 
                      />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" /> Încarcă Document
                      </Button>

                      {nextDept ? (
                          <>
                              {showSendButtons && (
                                  <>
                                      <Button onClick={() => handleAction('auto_assign')} className="bg-emerald-600 hover:bg-emerald-700">
                                          <Send className="mr-2 h-4 w-4" /> Auto-Trimite
                                      </Button>

                                      <div className="flex items-center gap-2 border rounded-md p-1 bg-white border-blue-200">
                                           <Select value={selectedColleague} onValueChange={setSelectedColleague}>
                                                <SelectTrigger className="h-9 w-[200px]">
                                                    <SelectValue placeholder="Alocă unui coleg..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {colleagues.map(col => (
                                                        <SelectItem key={col.id} value={col.id}>{col.full_name || col.email}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button size="sm" variant="ghost" onClick={() => handleAction('manual_assign')}>
                                                <UserPlus className="h-4 w-4" />
                                            </Button>
                                      </div>

                                      <Button variant="secondary" onClick={() => handleAction('send_to_pool')}>
                                            <Users className="mr-2 h-4 w-4" /> La Comun
                                      </Button>

                                      {request.workflow_stage === 'review_step2' && (
                                          <Button variant="outline" onClick={handleRevokeSignature} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                                <XCircle className="mr-2 h-4 w-4" /> Anulează Semnătura
                                          </Button>
                                      )}
                                  </>
                              )}

                              {/* Buton Semnare (Doar pentru Verificare Tehnică și doar dacă nu e semnat deja) */}
                              {request.workflow_stage === 'review_step2' && !hasCertificate && (
                                  <Button onClick={handleGenerateCertificate} className="bg-blue-700 hover:bg-blue-800" title="Generează și semnează certificatul înainte de trimitere">
                                      <PenTool className="mr-2 h-4 w-4" /> Generează Certificat
                                  </Button>
                              )}
                          </>
                      ) : (
                          <Button onClick={handleCounterSign} className="bg-purple-700 hover:bg-purple-800">
                              <PenTool className="mr-2 h-4 w-4" /> Contrasemnează și Finalizează
                          </Button>
                      )}
                      
                      {!showRejectInput && (
                          <Button variant="destructive" onClick={() => setShowRejectInput(true)}>
                              <XCircle className="mr-2 h-4 w-4" /> Respinge
                          </Button>
                      )}
                  </div>

                  {showRejectInput && (
                      <div className="p-4 border border-red-200 bg-red-50 rounded-md space-y-3 animate-in fade-in zoom-in-95 duration-200">
                          <label className="text-sm font-medium text-red-900">Motivul Respingerii (Obligatoriu):</label>
                          <Textarea 
                              placeholder="Explicați de ce respingeți cererea..." 
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              className="bg-white"
                          />
                          <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setShowRejectInput(false)}>Anulează</Button>
                              <Button variant="destructive" size="sm" onClick={() => handleAction('reject')}>Confirmă Respingerea</Button>
                          </div>
                      </div>
                  )}
              </CardContent>
          </Card>
      )}

      {/* TIMELINE HISTORY */}
      <Card>
          <CardHeader>
              <CardTitle className="text-lg">Istoric Procesare</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="relative border-l border-slate-200 ml-3 space-y-8 pb-4">
                  {request.workflow_history && request.workflow_history.length > 0 ? (
                      request.workflow_history.map((entry, i) => (
                          <div key={entry.id} className="ml-6 relative">
                              <div className="absolute -left-[31px] mt-1.5 h-3 w-3 rounded-full border border-white bg-slate-300 ring-4 ring-white"></div>
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                  <div>
                                      <p className="text-sm font-medium text-slate-900">
                                          {entry.action_type === 'stage_change' ? 'Schimbare Status' : 
                                           entry.action_type === 'comment' ? 'Notă Internă' : 
                                           entry.action_type === 'rejection' ? 'Cerere Respinsă' : 
                                           entry.action_type === 'file_upload' ? 'Fișier Încărcat' : 
                                           entry.action_type === 'file_delete' ? 'Ștergere Fișier' : 
                                           entry.action_type === 'signature' ? 'Dosar Semnat' : 'Acțiune'}
                                      </p>
                                      <p className="text-sm text-slate-500 mt-1">{entry.comment || "Fără comentarii."}</p>
                                      {entry.action_by_profile && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                              De: {entry.action_by_profile.full_name || "Utilizator"} ({entry.action_by_profile.role})
                                          </p>
                                      )}
                                  </div>
                                  <time className="text-xs text-slate-400 whitespace-nowrap mt-1 sm:mt-0">
                                      {new Date(entry.created_at).toLocaleString('ro-RO')}
                                  </time>
                              </div>
                          </div>
                      ))
                  ) : (
                      <p className="ml-6 text-sm text-slate-400">Nu există istoric disponibil.</p>
                  )}
              </div>
          </CardContent>
      </Card>
    </div>
  );
}