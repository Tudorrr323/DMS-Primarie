import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker manually to avoid version conflicts and build issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFPreview({ filePath, fileName, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  
  const [containerWidth, setContainerWidth] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let url = null;
    
    const fetchFile = async () => {
      if (!filePath) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: downloadError } = await supabase.storage
          .from('dms-files')
          .download(filePath);
          
        if (downloadError) throw downloadError;
        
        url = URL.createObjectURL(data);
        setBlobUrl(url);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchFile();

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [filePath]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
  }

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  // If not PDF, don't show preview
  if (!fileName?.toLowerCase().endsWith('.pdf')) return null;

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] w-full border rounded-md bg-slate-100 overflow-hidden shadow-sm mt-4 max-w-full">
        {/* HEADER TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between p-2 bg-white border-b shadow-sm z-10 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px] ml-2">{fileName}</span>
                {numPages && <span className="text-xs text-slate-500 whitespace-nowrap">({pageNumber} / {numPages})</span>}
            </div>
            
            <div className="flex items-center gap-1 ml-auto">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={scale <= 0.6 || loading}>
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono w-8 sm:w-12 text-center hidden xs:block">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={scale >= 3.0 || loading}>
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 sm:h-6 bg-slate-200 mx-1 sm:mx-2"></div>
                <Button variant="outline" size="sm" className="h-8 w-8 px-0" onClick={previousPage} disabled={pageNumber <= 1 || loading}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 px-0" onClick={nextPage} disabled={pageNumber >= numPages || loading}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                {onClose && (
                    <Button variant="ghost" size="icon" className="ml-1 sm:ml-2 h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>
        </div>

        {/* PDF VIEWER BODY */}
        <div className="flex-1 overflow-auto flex justify-center p-2 sm:p-4 bg-slate-200 scrollbar-thin scrollbar-thumb-slate-400" ref={containerRef}>
            {error ? (
                <div className="flex flex-col items-center justify-center h-full text-red-500 p-8 text-center bg-white rounded-lg shadow-sm m-auto max-w-md">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p className="font-semibold text-lg">Eroare la încărcarea PDF-ului</p>
                    <p className="text-sm mt-2 text-slate-600">{error}</p>
                    {onClose && <Button variant="outline" className="mt-6" onClick={onClose}>Închide</Button>}
                </div>
            ) : blobUrl ? (
                <Document
                    file={blobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="text-sm text-slate-500">Se încarcă documentul...</span>
                        </div>
                    }
                    error={
                        <div className="flex flex-col items-center justify-center h-full text-red-500 p-8 text-center bg-white rounded-lg shadow-sm">
                            <p className="font-semibold">Eroare la redarea PDF-ului.</p>
                            <p className="text-sm mt-1">Fișierul ar putea fi corupt sau într-un format neacceptat.</p>
                        </div>
                    }
                    className="shadow-lg max-w-full"
                >
                    <Page 
                        pageNumber={pageNumber} 
                        scale={scale} 
                        width={containerWidth ? Math.min(containerWidth - 32, 800) : null} // Dynamic width, max 800px, padding subtracted
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="bg-white max-w-full"
                        loading={
                            <div className="flex items-center justify-center p-20">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                            </div>
                        }
                    />
                </Document>
            ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">Se descarcă fișierul...</span>
                </div>
            )}
        </div>
    </div>
  );
}
