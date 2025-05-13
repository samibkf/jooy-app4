
import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";
import { RegionData, WorksheetMetadata } from "@/types/worksheet";

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
  
  // Metadata and region related states
  const [metadata, setMetadata] = useState<WorksheetMetadata | null>(null);
  const [filteredRegions, setFilteredRegions] = useState<RegionData[]>([]);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState(1);
  
  // Reference to the PDF container for getting rendered dimensions
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Fetch metadata JSON
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/data/${worksheetId}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setMetadata(data);
        console.log("Metadata loaded:", data);
        
        // Filter regions for current page
        if (data && data.regions) {
          const regions = data.regions.filter(
            (region: RegionData) => region.page === pageIndex
          );
          setFilteredRegions(regions);
          console.log(`Found ${regions.length} regions for page ${pageIndex}`);
        }
      } catch (err) {
        console.error("Error loading metadata:", err);
        toast({
          title: "Failed to load worksheet data",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive"
        });
      }
    };
    
    if (worksheetId) {
      fetchMetadata();
    }
  }, [worksheetId, pageIndex]);
  
  // Handle resize for scaling regions correctly
  useEffect(() => {
    const updateScaleFactor = () => {
      if (pdfContainerRef.current && pdfDimensions.width > 0) {
        const renderedWidth = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas')?.clientWidth || 0;
        if (renderedWidth > 0) {
          const newScaleFactor = renderedWidth / pdfDimensions.width;
          setScaleFactor(newScaleFactor);
          console.log(`Scale factor updated: ${newScaleFactor} (rendered: ${renderedWidth}, natural: ${pdfDimensions.width})`);
        }
      }
    };
    
    updateScaleFactor();
    
    // Set up ResizeObserver to handle window resize events
    const resizeObserver = new ResizeObserver(updateScaleFactor);
    if (pdfContainerRef.current) {
      resizeObserver.observe(pdfContainerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [pdfDimensions.width, pdfContainerRef.current]);

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
  
  // Handle page render success to get natural dimensions
  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page.originalWidth 
      ? { width: page.originalWidth, height: page.originalHeight }
      : page.getViewport({ scale: 1 });
      
    setPdfDimensions({ width, height });
    console.log(`PDF natural dimensions: ${width}x${height}`);
  };
  
  // Handle region click
  const handleRegionClick = (region: RegionData) => {
    console.log(`Region clicked: ${region.name}`);
    toast({
      title: "Region Selected",
      description: `You clicked on: ${region.name}`,
    });
  };

  return (
    <div className="worksheet-container" ref={pdfContainerRef}>
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
          onLoadSuccess={onPageLoadSuccess}
        />
      </Document>
      
      {/* Region overlays */}
      {!loading && !error && filteredRegions.map((region) => (
        <div
          key={region.id}
          className="worksheet-region"
          style={{
            position: 'absolute',
            left: `${region.x * scaleFactor}px`,
            top: `${region.y * scaleFactor}px`,
            width: `${region.width * scaleFactor}px`,
            height: `${region.height * scaleFactor}px`,
          }}
          onClick={() => handleRegionClick(region)}
          title={region.name}
        />
      ))}
      
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
