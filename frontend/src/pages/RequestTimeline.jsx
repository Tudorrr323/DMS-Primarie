import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { DocumentService } from '../lib/documentService';
import { EmployeeService } from '../lib/employeeService';
import { getWorkflowStageInfo } from '../lib/workflow-utils';
import PDFPreview from '../components/PDFPreview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileText, Download, Send, XCircle, CheckCircle, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RequestTimeline() {
  const { id } = useParams();
  const { user } = useAuthContext();
  const [request, setRequest] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewFileId, setPreviewFileId] = useState(null);
  
  // Actions state
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  
  // Manual Assignment State
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleague, setSelectedColleague] = useState('');

  const nextDept = 'verificare_tehnica'; // Hardcoded flow for now as per Initial Verification logic

  useEffect(() => {
    const fetchFullData = async () => {
      try {
        setLoading(true);
        
        // 1. Get Request Details
        const data = await DocumentService.getById(id);
        setRequest(data);

        // 2. Get User Profile (to check permissions)
        if (user) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(prof);

            // 3. If Employee, fetch colleagues for manual assignment
            if (prof?.role === 'angajat') {
                 const cols = await EmployeeService.getColleaguesByDepartment(nextDept);
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
        if (actionType === 'auto_assign') {
            await EmployeeService.approveAutoAssign(id, user.id, nextDept);
            toast.success("Trimis automat!");
        } else if (actionType === 'manual_assign') {
            if (!selectedColleague) {
                toast.error("Selectează un coleg!");
                return;
            }
            await EmployeeService.approve(id, user.id, selectedColleague);
            toast.success("Alocat manual!");
        } else if (actionType === 'send_to_pool') {
            await EmployeeService.approve(id, user.id, null);
            toast.success("Trimis în coada comună!");
        } else if (actionType === 'reject') {
            if (!rejectReason) {
                toast.error("Motivul este obligatoriu!");
                return;
            }
             await supabase.from('documents').update({
                workflow_stage: 'rejected',
                rejection_reason: rejectReason,
                current_assignee: null
            }).eq('id', id);
             await supabase.from('workflow_history').insert({
                document_id: id, action_by: user.id, action_type: 'rejection',
                from_stage: request.workflow_stage, to_stage: 'rejected', comment: rejectReason
            });
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
  const stageInfo = request ? getWorkflowStageInfo(request.workflow_stage) : {};

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (error) return <div className="p-10 text-red-500">Eroare: {error}</div>;
  if (!request) return <div className="p-10">Cererea nu există.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to={isEmployee ? (profile.department === 'verificare_initiala' ? '/verificare-initiala' : '/') : '/requests'} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Înapoi
      </Link>

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

                            return (
                                <div key={file.id} className="border rounded-md bg-white hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="bg-blue-100 p-2 rounded">
                                                <FileText className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="truncate">
                                                <p className="text-sm font-medium truncate">{file.file_name}</p>
                                                <p className="text-xs text-slate-400">{new Date(file.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
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

      {/* ACTION PANEL (EMPLOYEE ONLY) */}
      {isEmployee && isAssignedToMe && request.workflow_stage !== 'completed' && request.workflow_stage !== 'rejected' && (
          <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                  <CardTitle className="text-lg text-blue-900">Panou Acțiuni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
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
                                           entry.action_type === 'file_upload' ? 'Fișier Încărcat' : 'Acțiune'}
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