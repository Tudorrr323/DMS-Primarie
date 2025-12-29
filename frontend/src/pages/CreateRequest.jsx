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
import { Loader2, AlertCircle, X } from 'lucide-react'; // Import X icon for removing files

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
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold mb-2">Depune o Cerere Nouă</CardTitle>
          <CardDescription>Completează formularul de mai jos pentru a iniția o nouă cerere și a atașa documentele necesare.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="title">Subiect / Titlu Cerere</Label>
              <Input name="title" type="text" required placeholder="Ex: Autorizație construcție gard" value={formData.title} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Departament Vizat</Label>
              <Select onValueChange={handleSelectChange} defaultValue={formData.category}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Alege o categorie" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (<SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Selectați departamentul corect pentru o procesare rapidă.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descriere Detaliată</Label>
              <Textarea name="description" required rows="5" placeholder="Descrieți solicitarea dumneavoastră..." value={formData.description} onChange={handleChange} />
            </div>
            <div className="grid gap-2 p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <Label htmlFor="files" className="cursor-pointer">Documente Atașate (PDF, DOCX, Imagini, max 10MB)</Label>
              <Input
                id="files"
                type="file"
                multiple
                onChange={handleFileChange}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                ref={fileInputRef} // Attach ref here
              />
              <div className="mt-2 text-sm text-gray-600">
                {formData.files.length > 0 ? (
                  <div className="space-y-1">
                    {formData.files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                        <span className="truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(file)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>Puteți selecta mai multe fișiere</span>
                )}
                {fileError && (
                  <div className="mt-2 text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se procesează...</>) : ('Trimite Solicitarea')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
