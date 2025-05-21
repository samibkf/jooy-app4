import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { RegionData, WorksheetMetadata } from "@/types/worksheet";
import { ChevronRight } from "lucide-react";

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
  const [pdfPosition, setPdfPosition] = useState({ top: 0, left: 0 });
  
  // State for active region and step index
  const [activeRegion, setActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  // State for UI mode (text mode vs PDF mode)
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  
  // State for displayed messages in chat-style
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  
  // State for DRM protection
  const [isCurrentPageDrmProtected, setIsCurrentPageDrmProtected] = useState<boolean>(false);
  
  // New state for video display
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  
  // Reference to the PDF container and PDF itself for getting rendered dimensions
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLCanvasElement>(null);
  
  // Audio element reference
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Video element reference
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Ref for text display area to enable auto-scrolling
  const textDisplayRef = useRef<HTMLDivElement>(null);
  
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

    // Reset active region when worksheet or page changes
    setActiveRegion(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    
    // Reset text mode when worksheet or page changes
    setIsTextMode(false);
    
    // Reset video display
    setShowVideo(false);
    setIsAudioPlaying(false);
    
    // Stop any playing audio when worksheet or page changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Reset video to intro state
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
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
        
        // Check if current page is DRM protected
        if (data.drmProtectedPages && Array.isArray(data.drmProtectedPages)) {
          setIsCurrentPageDrmProtected(data.drmProtectedPages.includes(pageIndex));
          console.log(`Page ${pageIndex} DRM protected: ${data.drmProtectedPages.includes(pageIndex)}`);
        } else {
          setIsCurrentPageDrmProtected(false);
        }
        
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
  
  // Calculate PDF position and scale factor more accurately
  useEffect(() => {
    const calculatePdfPositionAndScale = () => {
      if (pdfContainerRef.current) {
        const pdfCanvas = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement | null;
        
        if (pdfCanvas && pdfDimensions.width > 0) {
          // Get the bounding rectangles
          const containerRect = pdfContainerRef.current.getBoundingClientRect();
          const canvasRect = pdfCanvas.getBoundingClientRect();
          
          // Calculate the PDF position relative to its container
          const top = canvasRect.top - containerRect.top;
          const left = canvasRect.left - containerRect.left;
          setPdfPosition({ top, left });
          
          // Calculate scale factor based on rendered width vs natural width
          const newScaleFactor = canvasRect.width / pdfDimensions.width;
          setScaleFactor(newScaleFactor);
          
          console.log(`PDF position updated: top=${top}, left=${left}`);
          console.log(`Scale factor updated: ${newScaleFactor} (rendered: ${canvasRect.width}, natural: ${pdfDimensions.width})`);
        }
      }
    };
    
    calculatePdfPositionAndScale();
    
    // Set up ResizeObserver to handle window resize events
    const resizeObserver = new ResizeObserver(() => {
      calculatePdfPositionAndScale();
    });
    
    if (pdfContainerRef.current) {
      resizeObserver.observe(pdfContainerRef.current);
    }
    
    // Clean up observer
    return () => {
      resizeObserver.disconnect();
    };
  }, [pdfDimensions.width, pdfContainerRef.current]);

  // Auto-scroll the text display area to the bottom when displayedMessages changes
  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);

  // Fix issue 2: Modify the video-audio synchronization to prevent auto-progression
  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    // Event handlers for audio
    const handleAudioPlaying = () => {
      console.log('Audio started playing - activating main animation loop');
      setIsAudioPlaying(true);
      
      // Start the main animation loop (seconds 10-20)
      if (video.paused) {
        video.currentTime = 10;
        video.play().catch(err => console.error("Error playing video:", err));
      }
    };
    
    const handleAudioPause = () => {
      console.log('Audio paused - returning to intro/idle loop');
      setIsAudioPlaying(false);
      
      // Video will transition back to intro loop via timeupdate handler
    };
    
    const handleAudioEnded = () => {
      console.log('Audio ended');
      setIsAudioPlaying(false);
    };
    
    // Event handler for video
    const handleVideoTimeUpdate = () => {
      // If the video is in the main animation loop (10-20 seconds)
      if (video.currentTime >= 20) {
        // Loop back to second 10 (start of main animation)
        video.currentTime = 10;
      }
      
      // If the video is in the intro/idle loop (0-10 seconds) and audio is not playing
      if (video.currentTime >= 10 && !isAudioPlaying) {
        // Loop back to second 0 (start of intro/idle animation)
        video.currentTime = 0;
      }
      
      // If audio is playing but video is in intro loop, jump to main loop
      if (isAudioPlaying && video.currentTime < 10) {
        video.currentTime = 10;
      }
    };
    
    // Add event listeners
    audio.addEventListener('playing', handleAudioPlaying);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    return () => {
      // Remove event listeners on cleanup
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
    
    // Trigger position calculation when page loads
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
        
        console.log(`Initial PDF position: top=${top}, left=${left}`);
        console.log(`Initial scale factor: ${newScaleFactor}`);
      }
    }, 100); // Small delay to ensure canvas is rendered
  };
  
  // Function to play audio segment with proper video synchronization
  const playAudioSegment = (regionName: string, stepIndex: number) => {
    if (!audioRef.current) return;
    
    // Construct the audio file path
    const audioPath = `/audio/${worksheetId}/${regionName}_${stepIndex + 1}.mp3`;
    
    // Set the source and load the audio
    audioRef.current.src = audioPath;
    
    // Handle audio loading errors
    audioRef.current.onerror = () => {
      console.error(`Failed to load audio: ${audioPath}`);
      toast({
        title: "Audio Error",
        description: "Could not load the audio file",
        variant: "destructive"
      });
      setIsAudioPlaying(false);
    };
    
    // Play the audio
    audioRef.current.play().catch(err => {
      console.error("Error playing audio:", err);
      setIsAudioPlaying(false);
    });
  };
  
  // Handle region click
  const handleRegionClick = (region: RegionData) => {
    console.log(`Region clicked: ${region.name}`);
    
    // Reset step index whether clicking same or different region
    setCurrentStepIndex(0);
    
    // Initialize displayed messages with just the first message
    if (region.description && region.description.length > 0) {
      setDisplayedMessages([region.description[0]]);
      
      // Show video if region has description (assuming it has audio)
      setShowVideo(true);
      
      // Ensure video is ready and at intro loop
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.error("Error playing video:", err));
      }
      
      // Play audio for the first step with a slight delay
      setTimeout(() => {
        playAudioSegment(region.name, 0);
      }, 500);
    } else {
      setDisplayedMessages([]);
      // Hide video if region has no description
      setShowVideo(false);
    }
    
    // Set active region
    setActiveRegion(region);
    
    // Set to text mode when a region is clicked
    setIsTextMode(true);
    
    toast({
      title: "Region Selected",
      description: `You clicked on: ${region.name}`,
    });
  };
  
  // Handle Next button click - now appends the next message to displayedMessages
  const handleNextStep = () => {
    if (activeRegion && activeRegion.description && currentStepIndex < activeRegion.description.length - 1) {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      
      // Add the next message to displayed messages array
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        activeRegion.description[nextStepIndex]
      ]);
      
      // Play audio for the next step with delay to allow video to sync
      setTimeout(() => {
        playAudioSegment(activeRegion.name, nextStepIndex);
      }, 500);
    }
  };
  
  // Toggle text mode on double click - Modified to stop audio/video when switching to PDF view
  const handleDoubleClick = () => {
    // Only toggle if there's an active region
    if (activeRegion) {
      const newTextMode = !isTextMode;
      setIsTextMode(newTextMode);
      
      // If switching to PDF mode, stop any playing audio and video
      if (!newTextMode) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          console.log("Audio stopped due to switching to PDF view");
        }
        
        if (videoRef.current) {
          videoRef.current.pause();
          console.log("Video stopped due to switching to PDF view");
        }
        
        setIsAudioPlaying(false);
      } else {
        // If switching to text mode, ensure video is in intro state
        if (videoRef.current && showVideo) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(err => console.error("Error playing video:", err));
        }
        
        // If switching to text mode, replay the current step's audio
        if (activeRegion) {
          setTimeout(() => {
            playAudioSegment(activeRegion.name, currentStepIndex);
          }, 500);
        }
      }
    }
  };
  
  // Check if we can go to the next step
  const hasNextStep = activeRegion?.description && currentStepIndex < activeRegion.description.length - 1;

  return (
    <div 
      className={`worksheet-container ${isTextMode ? 'text-mode' : ''}`} 
      ref={pdfContainerRef}
      onDoubleClick={handleDoubleClick}
    >
      {/* Audio element for playback */}
      <audio ref={audioRef} className="hidden" />
      
      {/* PDF Document and regions - hidden in text mode */}
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
        
        {/* Unblurred region overlays for DRM protected pages */}
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
              border: '1px solid rgba(0,0,0,0.1)', // Subtle border for debugging
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
                  width: `${pdfDimensions.width * scaleFactor}px`, // Set full document width
                  height: `${pdfDimensions.height * scaleFactor}px`, // Set full document height
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
        
        {/* Clickable region overlays */}
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
      
      {/* Text display area - Only shown in text mode */}
      {activeRegion && (
        <div className={`worksheet-text-display-container ${isTextMode ? 'active' : 'hidden'}`}>
          {/* Video element for avatar - moved inside text display container */}
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
            {hasNextStep && isTextMode && (
              <Button 
                onClick={handleNextStep} 
                className="next-button mt-3"
                variant="default"
              >
                Next <ChevronRight className="ml-1" />
              </Button>
            )}
          </div>
        </div>
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
