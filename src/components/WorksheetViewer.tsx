
import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";

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
  const [pdfExists, setPdfExists] = useState<boolean>(true);

  // Use a relative path instead of absolute with origin
  const pdfPath = `/pdfs/${worksheetId}/${pageIndex}.pdf`;
  
  useEffect(() => {
    // Check if the PDF exists by making a fetch request
    const checkPdfExists = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(pdfPath);
        if (!response.ok) {
          console.error(`PDF not found at path: ${pdfPath}`);
          setPdfExists(false);
          setError("PDF not found or unable to load");
          setLoading(false);
        } else {
          console.log(`PDF found at path: ${pdfPath}`);
          setPdfExists(true);
        }
      } catch (err) {
        console.error("Error checking PDF:", err);
        setPdfExists(false);
        setError("Error checking PDF availability");
        setLoading(false);
      }
    };
    
    checkPdfExists();
  }, [worksheetId, pageIndex, pdfPath]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log("PDF loaded successfully with", numPages, "pages");
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("Error loading PDF:", err);
    setError("PDF not found or unable to load");
    setLoading(false);
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
        </div>
      )}
      
      {pdfExists && (
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
      )}
      
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
