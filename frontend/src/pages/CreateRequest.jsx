import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthContext } from '../contexts/AuthContext';
import { Loader2, AlertCircle, X, Upload, FileText } from 'lucide-react';

const CATEGORIES = [
  { value: 'cerere_cetatean', label: 'Cerere Cetățean' },
  { value: 'act_administrativ', label: 'Act Administrativ' },
  { value: 'contract', label: 'Contract' },
  { value: 'raport', label: 'Raport' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

export default function CreateRequest() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: CATEGORIES[0].value,
    files: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSelectChange = (value) => {
    setFormData({ ...formData, category: value });
  };

  const processFiles = (files) => {
    setFileError(null);
    const newlySelectedFiles = Array.from(files);
    let currentValidFiles = [...formData.files];

    const invalidFiles = [];

    newlySelectedFiles.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        invalidFiles.push(`${file.name} (tip neacceptat)`);
      } else if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (> 10 MB)`);
      } else {
        if (!currentValidFiles.some(f => f.name === file.name && f.size === file.size)) {
          currentValidFiles.push(file);
        }
      }
    });

    if (invalidFiles.length > 0) {
      setFileError(`Fișiere invalide: ${invalidFiles.join(', ')}`);
    }
    setFormData(prev => ({ ...prev, files: currentValidFiles }));
  };

  const handleFileChange = (e) => {
    processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (fileToRemove) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter(f => f !== fileToRemove),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.files.length === 0) {
      alert("Atașează măcar un document!");
      return;
    }

    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Sesiune expirată.');

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert([{
          title: formData.title,
          description: formData.description,
          category: formData.category,
          uploaded_by: currentUser.id,
          workflow_stage: 'submitted'
        }])
        .select();

      if (docError) throw docError;
      const newDocId = docData[0].id;

      const uploadPromises = formData.files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('dms-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        return supabase.from('document_files').insert({
          document_id: newDocId,
          file_url: filePath,
          file_name: file.name,
          uploaded_by: currentUser.id
        });
      });

      await Promise.all(uploadPromises);
      alert('Cerere înregistrată!');
      navigate('/requests');
    } catch (error) {
      console.error(error);
      alert('Eroare: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-xl border-0 sm:border animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle className="text-3xl font-bold mb-2 dark:text-white">Depune o Cerere Nouă</CardTitle>
          <CardDescription className="dark:text-slate-400">Completează formularul de mai jos pentru a iniția o nouă cerere.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="title" className="dark:text-slate-200">Subiect / Titlu Cerere</Label>
              <Input name="title" type="text" required placeholder="Ex: Autorizație construcție gard" value={formData.title} onChange={handleChange} className="bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="category" className="dark:text-slate-200">Departament Vizat</Label>
              <Select onValueChange={handleSelectChange} defaultValue={formData.category}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100">
                  <SelectValue placeholder="Alege o categorie" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value} className="dark:text-slate-200 focus:dark:bg-slate-800">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="dark:text-slate-200">Descriere Detaliată</Label>
              <Textarea name="description" required rows="4" placeholder="Descrieți solicitarea dumneavoastră..." value={formData.description} onChange={handleChange} className="bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </div>

            <div className="grid gap-2">
              <Label className="dark:text-slate-200 mb-1">Documente Atașate (PDF, DOCX, Imagini, max 10MB)</Label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`group relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer text-center ${
                  isDragging 
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.01] shadow-inner" 
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 hover:border-blue-400 dark:hover:border-blue-500/50"
                }`}
              >
                <input id="files" type="file" multiple onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className={`p-3 rounded-full transition-all duration-300 ${isDragging ? 'bg-blue-500 text-white scale-110' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:scale-110'}`}>
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold dark:text-slate-200">
                      {isDragging ? "Eliberează pentru a încărca" : "Apasă sau trage fișierele aici"}
                    </p>
                    <p className="text-xs text-slate-500">Puteți selecta mai multe documente</p>
                  </div>
                </div>

                {formData.files.length > 0 && (
                  <div 
                    className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left animate-in fade-in slide-in-from-top-2 duration-300 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formData.files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-medium dark:text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{(file.size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile(file); }}
                          className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {fileError && (
                <div className="mt-2 text-red-600 dark:text-red-400 flex items-center gap-2 bg-red-50 dark:bg-red-900/10 p-2 rounded-md border border-red-100 dark:border-red-900/20">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">{fileError}</span>
                </div>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Se trimite...</> : 'Trimite Solicitarea'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}