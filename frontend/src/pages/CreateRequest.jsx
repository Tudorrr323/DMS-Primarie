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
import { Loader2, AlertCircle, X, Upload, FileText } from 'lucide-react'; // Correct import

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
  const fileInputRef = useRef(null); // Ref to clear file input

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

  const handleFileChange = (e) => {
    setFileError(null);
    const newlySelectedFiles = Array.from(e.target.files);
    let currentValidFiles = [...formData.files]; // Start with existing valid files

    const invalidFiles = [];

    newlySelectedFiles.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        invalidFiles.push(`${file.name} (tip de fișier neacceptat)`);
      } else if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (depășește 10 MB)`);
      } else {
        // Prevent duplicate file names (simple check for now)
        if (!currentValidFiles.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)) {
          currentValidFiles.push(file);
        }
      }
    });

    if (invalidFiles.length > 0) {
      setFileError(`Următoarele fișiere sunt invalide: ${invalidFiles.join(', ')}`);
      // It's tricky to clear only invalid files from the input visually
      // So we'll just keep current files and let user re-select if needed.
    }
    setFormData({ ...formData, files: currentValidFiles });
    // Clear the input value so the same files can be selected again after removal
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileToRemove) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      files: prevFormData.files.filter((file) => file !== fileToRemove),
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.files.length === 0) {
      alert("Te rugăm să atașezi măcar un document valid!");
      return;
    }

    setLoading(true);

    try {
      // Refetch the user to ensure we have the latest session data
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) throw new Error('Sesiune expirată. Te rugăm să te loghezi din nou.');

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert([{
          title: formData.title,
          description: formData.description,
          category: formData.category,
          uploaded_by: currentUser.id, // Use the freshly fetched user ID
          workflow_stage: 'submitted'
        }])
        .select();

      if (docError) throw docError;
      const newDocId = docData[0].id;

      const uploadPromises = formData.files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`; // Use the same fresh user ID

        const { error: uploadError } = await supabase.storage
          .from('dms-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        return supabase.from('document_files').insert({
          document_id: newDocId,
          file_url: filePath,
          file_name: file.name,
          uploaded_by: currentUser.id // And here too
        });
      });

      await Promise.all(uploadPromises);

      alert('Cererea a fost înregistrată cu succes!');
      navigate('/requests');

    } catch (error) {
      console.error('Eroare:', error);
      alert('Eroare la trimitere: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold mb-2 dark:text-slate-100">Depune o Cerere Nouă</CardTitle>
          <CardDescription className="dark:text-slate-400">Completează formularul de mai jos pentru a iniția o nouă cerere și a atașa documentele necesare.</CardDescription>
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
                <SelectTrigger className="w-full bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100"><SelectValue placeholder="Alege o categorie" /></SelectTrigger>
                <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                  {CATEGORIES.map((cat) => (<SelectItem key={cat.value} value={cat.value} className="dark:text-slate-200 focus:dark:bg-slate-800">{cat.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Selectați departamentul corect pentru o procesare rapidă.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="dark:text-slate-200">Descriere Detaliată</Label>
              <Textarea name="description" required rows="5" placeholder="Descrieți solicitarea dumneavoastră..." value={formData.description} onChange={handleChange} className="bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </div>
            <div className="grid gap-2">
              <Label className="dark:text-slate-200 mb-1">Documente Atașate (PDF, DOCX, Imagini, max 10MB)</Label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group relative border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl p-8 bg-gray-50/50 dark:bg-slate-900/30 hover:bg-gray-100 dark:hover:bg-slate-900/50 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all cursor-pointer text-center"
              >
                <Input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium dark:text-slate-200">Apasă pentru a încărca sau trage fișierele aici</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">Puteți selecta mai multe documente simultan</p>
                  </div>
                </div>
              </div>

              {formData.files.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {formData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium dark:text-slate-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(file);
                        }}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {fileError && (
                <div className="mt-2 text-red-600 dark:text-red-400 flex items-center gap-2 bg-red-50 dark:bg-red-900/10 p-2 rounded-md border border-red-100 dark:border-red-900/20">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">{fileError}</span>
                </div>
              )}
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se procesează...</>) : ('Trimite Solicitarea')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
