
import React, { useState } from "react";
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

  const pdfPath = `/pdfs/${worksheetId}/${pageIndex}.pdf`;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
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
