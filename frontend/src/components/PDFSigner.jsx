import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from "@/components/ui/button";
import { Loader2, Save, X, RotateCcw, MousePointerClick, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configure worker using CDN to ensure compatibility and availability
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFSigner({ fileUrl, onSave, onCancel }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [signatures, setSignatures] = useState([]); // Array of { page, xRatio, yRatio, id }
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.0);
  
  const pageRef = useRef(null);

  // Load success
  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  // Handle click on PDF Page
  const handlePageClick = (e) => {
    if (!pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    
    // Calculate click position relative to the element (in pixels)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to percentage (Ratio 0.0 - 1.0)
    // This makes it independent of the current zoom/scale
    const xRatio = x / rect.width;
    const yRatio = y / rect.height;

    const newSignature = {
      id: Math.random().toString(36).substr(2, 9),
      page: pageNumber,
      xRatio,
      yRatio
    };

    setSignatures([...signatures, newSignature]);
  };

  const removeSignature = (id, e) => {
    e.stopPropagation(); // Prevent adding a new signature when clicking delete
    setSignatures(signatures.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (signatures.length === 0) {
        toast.error("Adaugă cel puțin o semnătură pe document!");
        return;
    }
    onSave(signatures);
  };

  const changePage = (offset) => {
    setPageNumber(prevPage => Math.min(Math.max(prevPage + offset, 1), numPages || 1));
  };

  return (
    <div className="flex flex-col h-[85vh] bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-800">
      {/* Header / Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 border-b dark:border-slate-800 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MousePointerClick className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Mod Semnare
            </h3>
            <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
                Pagina {pageNumber} din {numPages || '-'}
            </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 dark:hover:bg-slate-800" onClick={zoomOut} disabled={scale <= 0.5 || loading}>
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono w-12 text-center dark:text-slate-300">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 dark:hover:bg-slate-800" onClick={zoomIn} disabled={scale >= 3.0 || loading}>
                    <ZoomIn className="h-4 w-4" />
                </Button>
            </div>
            
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>

            <Button variant="outline" size="sm" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => changePage(1)} disabled={pageNumber >= numPages}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
            <Button variant="ghost" onClick={() => setSignatures([])} title="Șterge toate" className="dark:hover:bg-slate-800">
                <RotateCcw className="h-4 w-4 text-red-500" />
            </Button>
            <Button variant="secondary" onClick={onCancel} className="dark:bg-slate-800 dark:hover:bg-slate-700">
                <X className="mr-2 h-4 w-4" /> Anulează
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Save className="mr-2 h-4 w-4" /> Salvează și Aplică
            </Button>
        </div>
      </div>

      {/* PDF Viewport */}
      <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-800 flex justify-center p-8 relative scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-600">
        <div className="relative w-fit h-fit shadow-xl pointer-events-auto cursor-crosshair border border-slate-300 dark:border-slate-700 bg-white" 
             onClick={handlePageClick}
             ref={pageRef}
        >
            <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                    <div className="flex items-center justify-center h-96 w-[600px] bg-white dark:bg-slate-900">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                }
                error={<div className="p-10 text-red-500 dark:text-red-400">Eroare la încărcarea PDF-ului.</div>}
            >
                <Page 
                    pageNumber={pageNumber} 
                    scale={scale} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    className="max-w-full"
                />
            </Document>

            {/* Render Markers for Signatures on CURRENT Page */}
            {signatures.filter(s => s.page === pageNumber).map((sig) => (
                <div
                    key={sig.id}
                    className="absolute flex items-center justify-center bg-blue-600/20 border-2 border-blue-600 rounded cursor-pointer group hover:bg-red-500/20 hover:border-red-500 transition-colors"
                    style={{
                        left: `${sig.xRatio * 100}%`,
                        top: `${sig.yRatio * 100}%`,
                        width: '25%', // Proporție fixă din lățimea paginii
                        aspectRatio: '180/80',
                        transform: 'translate(-50%, -50%)', // Centrare pe click
                    }}
                    onClick={(e) => removeSignature(sig.id, e)}
                    title="Click pentru a șterge această semnătură"
                >
                    <div className="font-bold text-blue-800 bg-white/80 rounded shadow-sm group-hover:text-red-600 text-center"
                         style={{ 
                            fontSize: `${scale * 0.65}rem`, 
                            padding: `${scale * 0.25}rem ${scale * 0.5}rem` 
                         }}
                    >
                        SEMNĂTURĂ AICI
                    </div>
                    <X className="absolute bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                       style={{ 
                           top: `-${scale * 0.5}rem`, 
                           right: `-${scale * 0.5}rem`,
                           width: `${scale * 1.25}rem`,
                           height: `${scale * 1.25}rem`,
                           padding: `${scale * 0.2}rem`
                       }}
                    />
                </div>
            ))}
        </div>
      </div>
      
      <div className="p-2 bg-white dark:bg-slate-900 text-xs text-center text-slate-400 dark:text-slate-500 border-t dark:border-slate-800">
          Dă click oriunde pe pagină pentru a plasa semnătura. Poți naviga între pagini și plasa multiple semnături.
      </div>
    </div>
  );
}
