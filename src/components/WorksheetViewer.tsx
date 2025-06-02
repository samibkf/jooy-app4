import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { RegionData, WorksheetMetadata } from "@/types/worksheet";
import { ChevronLeft, Sparkles } from "lucide-react";

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
  
  const pdfPath = `/pdfs/${worksheetId}/${pageIndex}.pdf?v=${retryCount}`;
  
  const [metadata, setMetadata] = useState<WorksheetMetadata | null>(null);
  const [filteredRegions, setFilteredRegions] = useState<RegionData[]>([]);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState(1);
  const [pdfPosition, setPdfPosition] = useState({ top: 0, left: 0 });
  
  const [activeRegion, setActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  
  const [isCurrentPageDrmProtected, setIsCurrentPageDrmProtected] = useState<boolean>(false);
  
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    if (worksheetId || pageIndex) {
      setRetryCount(0);
    }

    setActiveRegion(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    setIsTextMode(false);
    setShowVideo(false);
    setIsAudioPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [worksheetId, pageIndex, pdfPath]);
  
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/data/${worksheetId}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setMetadata(data);
        
        if (data.drmProtectedPages && Array.isArray(data.drmProtectedPages)) {
          setIsCurrentPageDrmProtected(data.drmProtectedPages.includes(pageIndex));
        } else {
          setIsCurrentPageDrmProtected(false);
        }
        
        if (data && data.regions) {
          const regions = data.regions.filter(
            (region: RegionData) => region.page === pageIndex
          );
          setFilteredRegions(regions);
        }
      } catch (err) {
        console.error("Error loading metadata:", err);
      }
    };
    
    if (worksheetId) {
      fetchMetadata();
    }
  }, [worksheetId, pageIndex]);
  
  useEffect(() => {
    const calculatePdfPositionAndScale = () => {
      if (pdfContainerRef.current) {
        const pdfCanvas = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement | null;
        
        if (pdfCanvas && pdfDimensions.width > 0) {
          const containerRect = pdfContainerRef.current.getBoundingClientRect();
          const canvasRect = pdfCanvas.getBoundingClientRect();
          
          const top = canvasRect.top - containerRect.top;
          const left = canvasRect.left - containerRect.left;
          setPdfPosition({ top, left });
          
          const newScaleFactor = canvasRect.width / pdfDimensions.width;
          setScaleFactor(newScaleFactor);
        }
      }
    };
    
    calculatePdfPositionAndScale();
    
    const resizeObserver = new ResizeObserver(() => {
      calculatePdfPositionAndScale();
    });
    
    if (pdfContainerRef.current) {
      resizeObserver.observe(pdfContainerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [pdfDimensions.width, pdfContainerRef.current]);

  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);

  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    const handleAudioPlaying = () => {
      setIsAudioPlaying(true);
      
      if (video.paused) {
        video.currentTime = 10;
        video.play().catch(err => console.error("Error playing video:", err));
      }
    };
    
    const handleAudioPause = () => {
      setIsAudioPlaying(false);
    };
    
    const handleAudioEnded = () => {
      setIsAudioPlaying(false);
    };
    
    const handleVideoTimeUpdate = () => {
      if (video.currentTime >= 20) {
        video.currentTime = 10;
      }
      
      if (video.currentTime >= 9.9 && !isAudioPlaying) {
        video.currentTime = 0;
      }
      
      if (isAudioPlaying && video.currentTime < 10) {
        video.currentTime = 10;
      }
    };
    
    audio.addEventListener('playing', handleAudioPlaying);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    return () => {
      audio.removeEventListener('playing', handleAudioPlaying);
      audio.removeEventListener('pause', handleAudioPause);
      audio.removeEventListener('ended', handleAudioEnded);
      video.removeEventListener('timeupdate', handleVideoTimeUpdate);
    };
  }, [videoRef.current, audioRef.current, isAudioPlaying]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setLoading(true);
    setError(null);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("Error loading PDF:", err);
    setError("PDF not found or unable to load");
    setLoading(false);
  };
  
  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page.originalWidth 
      ? { width: page.originalWidth, height: page.originalHeight }
      : page.getViewport({ scale: 1 });
      
    setPdfDimensions({ width, height });
    
    setTimeout(() => {
      const pdfCanvas = pdfContainerRef.current?.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement | null;
      if (pdfCanvas) {
        const containerRect = pdfContainerRef.current!.getBoundingClientRect();
        const canvasRect = pdfCanvas.getBoundingClientRect();
        
        const top = canvasRect.top - containerRect.top;
        const left = canvasRect.left - containerRect.left;
        setPdfPosition({ top, left });
        
        const newScaleFactor = canvasRect.width / width;
        setScaleFactor(newScaleFactor);
      }
    }, 100);
  };
  
  const playAudioSegment = (regionName: string, stepIndex: number) => {
    if (!audioRef.current) return;
    
    const audioPath = `/audio/${worksheetId}/${regionName}_${stepIndex + 1}.mp3`;
    
    audioRef.current.src = audioPath;
    
    audioRef.current.onerror = () => {
      console.error(`Failed to load audio: ${audioPath}`);
      setIsAudioPlaying(false);
    };
    
    audioRef.current.play().catch(err => {
      console.error("Error playing audio:", err);
      setIsAudioPlaying(false);
    });
  };
  
  const handleRegionClick = (region: RegionData) => {
    setCurrentStepIndex(0);
    
    if (region.description && region.description.length > 0) {
      setDisplayedMessages([region.description[0]]);
      setShowVideo(true);
      
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.error("Error playing video:", err));
      }
      
      setTimeout(() => {
        playAudioSegment(region.name, 0);
      }, 500);
    } else {
      setDisplayedMessages([]);
      setShowVideo(false);
    }
    
    setActiveRegion(region);
    setIsTextMode(true);
  };
  
  const handleNextStep = () => {
    if (activeRegion && activeRegion.description && currentStepIndex < activeRegion.description.length - 1) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        activeRegion.description[nextStepIndex]
      ]);
      
      setTimeout(() => {
        playAudioSegment(activeRegion.name, nextStepIndex);
      }, 500);
    }
  };
  
  const handleDoubleClick = () => {
    if (activeRegion) {
      const newTextMode = !isTextMode;
      setIsTextMode(newTextMode);
      
      if (!newTextMode) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        
        if (videoRef.current) {
          videoRef.current.pause();
        }
        
        setIsAudioPlaying(false);
      } else {
        if (videoRef.current && showVideo) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(err => console.error("Error playing video:", err));
        }
        
        if (activeRegion) {
          setTimeout(() => {
            playAudioSegment(activeRegion.name, currentStepIndex);
          }, 500);
        }
      }
    }
  };

  const handleVideoContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };
  
  const hasNextStep = activeRegion?.description && currentStepIndex < activeRegion.description.length - 1;

  return (
    <div 
      className={`worksheet-container ${isTextMode ? 'text-mode' : ''}`} 
      ref={pdfContainerRef}
      onDoubleClick={handleDoubleClick}
    >
      <audio ref={audioRef} className="hidden" />
      
      {isTextMode && (
        <Button
          onClick={handleDoubleClick}
          className="fixed top-4 left-4 z-70 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-lg"
          size="icon"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      
      <div className={`worksheet-pdf-container ${isTextMode ? 'hidden' : ''} ${isCurrentPageDrmProtected ? 'drm-active' : ''}`}>
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
            className={`worksheet-page ${isCurrentPageDrmProtected ? 'blurred' : ''}`}
            width={window.innerWidth > 768 ? 600 : undefined}
            onLoadSuccess={onPageLoadSuccess}
          />
        </Document>
        
        {isCurrentPageDrmProtected && !isTextMode && !loading && !error && filteredRegions.map((region) => (
          <div
            key={`clear-${region.id}`}
            className="worksheet-clear-region"
            style={{
              position: 'absolute',
              left: `${region.x * scaleFactor + pdfPosition.left}px`,
              top: `${region.y * scaleFactor + pdfPosition.top}px`,
              width: `${region.width * scaleFactor}px`,
              height: `${region.height * scaleFactor}px`,
              overflow: 'hidden',
              zIndex: 5,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          >
            <Document
              file={pdfPath}
              className="clear-document"
            >
              <div
                style={{
                  position: 'absolute',
                  left: `-${region.x * scaleFactor}px`,
                  top: `-${region.y * scaleFactor}px`,
                  width: `${pdfDimensions.width * scaleFactor}px`,
                  height: `${pdfDimensions.height * scaleFactor}px`,
                }}
              >
                <Page
                  pageNumber={1}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={window.innerWidth > 768 ? 600 : undefined}
                  className="clear-page"
                />
              </div>
            </Document>
          </div>
        ))}
        
        {!loading && !error && filteredRegions.map((region) => (
          <div
            key={region.id}
            className="worksheet-region"
            style={{
              position: 'absolute',
              left: `${region.x * scaleFactor + pdfPosition.left}px`,
              top: `${region.y * scaleFactor + pdfPosition.top}px`,
              width: `${region.width * scaleFactor}px`,
              height: `${region.height * scaleFactor}px`,
              zIndex: 10,
            }}
            onClick={() => handleRegionClick(region)}
            title={region.name}
          />
        ))}
      </div>
      
      {activeRegion && (
        <div className={`worksheet-text-display-container ${isTextMode ? 'active' : 'hidden'}`}>
          <video 
            ref={videoRef}
            className={`video-element ${showVideo ? '' : 'hidden'}`}
            src="/video/default.mp4"
            muted
            autoPlay
            playsInline
            preload="auto"
          />
          
          <div 
            className="worksheet-text-display"
            ref={textDisplayRef}
          >
            <h3 className="text-lg font-semibold mb-2">{activeRegion.name}</h3>
            <div className="text-content chat-messages">
              {displayedMessages.map((message, index) => (
                <div key={index} className="chat-message">
                  <p>{message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasNextStep && isTextMode && (
        <Button 
          onClick={handleNextStep} 
          className="next-button"
          variant="default"
        >
          <Sparkles className="!h-8 !w-8" />
        </Button>
      )}
      
      {!isTextMode && numPages && numPages > 0 && !error && !loading && (
        <div className="worksheet-info">
          <p className="text-sm text-gray-500 mt-2">
            Page 1 of {numPages}
          </p>
        </div>
      )}
      
      {isTextMode && (
        <div className="text-mode-instructions">
          <p>Double-click anywhere to return to PDF view</p>
        </div>
      )}
      
      {isCurrentPageDrmProtected && !isTextMode && !loading && !error && (
        <div className="drm-notice">
          <p>This page has content protection enabled</p>
        </div>
      )}
    </div>
  );
};

export default WorksheetViewer;