
import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface WorksheetViewerProps {
  worksheetId: string;
  pageIndex: number;
}

const WorksheetViewer: React.FC<WorksheetViewerProps> = ({ worksheetId, pageIndex }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // PDF Path with query parameter to prevent caching issues
  const pdfPath = `/pdfs/${worksheetId}/${pageIndex}.pdf?v=${retryCount}`;
  
  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log(`Attempting to load PDF from: ${pdfPath}`);
    
    // Show toast when starting to load PDF
    toast({
      title: "Loading PDF",
      description: `Trying to load from ${pdfPath}`,
    });
    
    // Reset retry count when worksheet or page changes
    if (worksheetId || pageIndex) {
      setRetryCount(0);
    }
  }, [worksheetId, pageIndex, pdfPath]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setLoading(true);
    setError(null);
    toast({
      title: "Retrying PDF load",
      description: "Attempting to reload the PDF...",
    });
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log("PDF loaded successfully with", numPages, "pages");
    setNumPages(numPages);
    setLoading(false);
    toast({
      title: "PDF Loaded Successfully",
      description: `${numPages} pages available`,
    });
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("Error loading PDF:", err);
    setError("PDF not found or unable to load");
    setLoading(false);
    toast({
      title: "PDF Load Error",
      description: "Could not load the PDF file",
      variant: "destructive"
    });
  };

  return (
    <div className="worksheet-container">
      {loading && (
        <div className="worksheet-loading">
          <div className="animate-pulse flex justify-center items-center h-full">
            <p className="text-lg text-gray-500">Loading PDF...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="worksheet-error">
          <p className="text-red-500">{error}</p>
          <p className="text-sm text-gray-500 mt-2">
            The worksheet you're looking for might not exist. Please check the QR code and try again.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Looking for: {pdfPath}
          </p>
          <button 
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry Loading PDF
          </button>
        </div>
      )}
      
      <Document
        file={pdfPath}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={null}
      >
        <Page
          pageNumber={1}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="worksheet-page"
          width={window.innerWidth > 768 ? 600 : undefined}
        />
      </Document>
      
      {numPages && numPages > 0 && !error && !loading && (
        <div className="worksheet-info">
          <p className="text-sm text-gray-500 mt-2">
            Page 1 of {numPages}
          </p>
        </div>
      )}
    </div>
  );
};

export default WorksheetViewer;
