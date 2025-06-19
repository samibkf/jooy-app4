import React, { useState, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useWorksheetData } from '@/hooks/useWorksheetData';
import type { RegionData } from "@/types/worksheet";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface WorksheetViewerProps {
  worksheetId: string;
  pageIndex: number;
}

const WorksheetViewer: React.FC<WorksheetViewerProps> = ({ worksheetId, pageIndex }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState(1);
  const [pdfPosition, setPdfPosition] = useState({ top: 0, left: 0 });
  
  const [activeRegion, setActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  
  const [isCurrentPageDrmProtected, setIsCurrentPageDrmProtected] = useState<boolean>(false);
  
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Use the hook for data fetching
  const { data, isLoading, error } = useWorksheetData(worksheetId);
  const worksheetData = data?.meta;
  const pdfUrl = data?.pdfUrl;

  // Filter regions for current page and ensure description is properly split into paragraphs
  const regions = useMemo(() => {
    if (!worksheetData?.regions) return [];
    return worksheetData.regions
      .filter((region: RegionData) => region.page === pageIndex)
      .map((region: RegionData) => {
        let processedDescription: string[] = [];
        
        if (Array.isArray(region.description)) {
          // If it's already an array, process each item to split by newlines
          processedDescription = region.description.flatMap(item => 
            typeof item === 'string' 
              ? item.split('\n').filter(paragraph => paragraph.trim() !== '')
              : []
          );
        } else if (typeof region.description === 'string') {
          // If it's a string, split by newlines
          processedDescription = region.description
            .split('\n')
            .filter(paragraph => paragraph.trim() !== '');
        }
        
        return {
          ...region,
          description: processedDescription
        };
      });
  }, [worksheetData, pageIndex]);

  // Check if current page is DRM protected
  useEffect(() => {
    if (worksheetData) {
      const isDrmProtected = worksheetData.drmProtected || 
        (Array.isArray(worksheetData.drmProtectedPages) && worksheetData.drmProtectedPages.includes(pageIndex));
      setIsCurrentPageDrmProtected(isDrmProtected);
    }
  }, [worksheetData, pageIndex]);

  // Reset component state when worksheet or page changes
  useEffect(() => {
    setActiveRegion(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    setIsTextMode(false);
    setIsAudioPlaying(false);
    setAudioAvailable(true);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [worksheetId, pageIndex]);

  const handleMessageClick = (index: number) => {
    if (!activeRegion || !audioAvailable) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    playAudioSegment(activeRegion.name, index);
    
    const messageElement = document.querySelector(`[data-message-index="${index}"]`);
    if (messageElement) {
      messageElement.classList.add('message-highlight');
      setTimeout(() => {
        messageElement.classList.remove('message-highlight');
      }, 200);
    }
  };
  
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("Error loading PDF:", err);
    setIsLoading(false);
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
      console.warn(`Audio file not found: ${audioPath}`);
      setIsAudioPlaying(false);
      setAudioAvailable(false);
    };
    
    audioRef.current.play().catch(err => {
      console.warn("Error playing audio:", err);
      setIsAudioPlaying(false);
      setAudioAvailable(false);
    });
  };
  
  const handleRegionClick = (region: RegionData) => {
    // Check if region has no description or empty description
    if (!region.description || region.description.length === 0) {
      return; // Do nothing if no description
    }
    
    setCurrentStepIndex(0);
    
    if (region.description && region.description.length > 0) {
      setDisplayedMessages([region.description[0]]);
      
      if (videoRef.current && audioAvailable) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.error("Error playing video:", err));
      }
      
      // Only try to play audio if it's available
      if (audioAvailable) {
        setTimeout(() => {
          playAudioSegment(region.name, 0);
        }, 500);
      }
    } else {
      setDisplayedMessages([]);
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
      
      // Only try to play audio if it's available
      if (audioAvailable) {
        setTimeout(() => {
          playAudioSegment(activeRegion.name, nextStepIndex);
        }, 500);
      }
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
        if (videoRef.current && audioAvailable) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(err => console.error("Error playing video:", err));
        }
        
        // Only try to play audio if it's available
        if (activeRegion && audioAvailable) {
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

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="worksheet-container">
        <div className="worksheet-loading">
          <p>Loading worksheet...</p>
        </div>
      </div>
    );
  }

  // Show error if worksheet not found
  if (error) {
    return (
      <div className="worksheet-container">
        <div className="worksheet-error">
          <p>Failed to load the interactive worksheet. Please try again.</p>
          <Button onClick={() => window.location.href = '/'}>
            Return to Scanner
          </Button>
        </div>
      </div>
    );
  }

  // Show error if no data available
  if (!worksheetData || !pdfUrl) {
    return (
      <div className="worksheet-container">
        <div className="worksheet-error">
          <p>Worksheet not found</p>
          <Button onClick={() => window.location.href = '/'}>
            Return to Scanner
          </Button>
        </div>
      </div>
    );
  }

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
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          <Page
            pageNumber={pageIndex}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className={`worksheet-page ${isCurrentPageDrmProtected ? 'blurred' : ''}`}
            width={window.innerWidth > 768 ? 600 : undefined}
            onLoadSuccess={onPageLoadSuccess}
          />
        </Document>
        
        {isCurrentPageDrmProtected && !isTextMode && regions.map((region) => (
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
              file={pdfUrl}
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
                  pageNumber={pageIndex}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={window.innerWidth > 768 ? 600 : undefined}
                  className="clear-page"
                />
              </div>
            </Document>
          </div>
        ))}
        
        {regions.map((region) => (
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
          {isTextMode && audioAvailable && (
            <video 
              ref={videoRef}
              className="video-element"
              src="/video/default.mp4"
              muted
              autoPlay
              playsInline
              preload="auto"
              onContextMenu={handleVideoContextMenu}
            />
          )}
          
          <div 
            className="worksheet-text-display"
            ref={textDisplayRef}
          >
            <div className="text-content chat-messages">
              {displayedMessages.map((message, index) => (
                <div 
                  key={index} 
                  className="chat-message"
                  onClick={() => handleMessageClick(index)}
                  data-message-index={index}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleMessageClick(index);
                    }
                  }}
                >
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
          <Sparkles className="!h-6 !w-6" />
        </Button>
      )}
      
      {numPages && numPages > 0 && (
        <div className="worksheet-info">
          <p className="text-sm text-gray-500 mt-2">
            Page {pageIndex} of {numPages}
          </p>
        </div>
      )}
      
      {isCurrentPageDrmProtected && !isTextMode && (
        <div className="drm-notice">
          <p>This page has content protection enabled</p>
        </div>
      )}
    </div>
  );
};

export default WorksheetViewer;