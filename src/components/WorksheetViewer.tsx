
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  // State management and core refs
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
  
  // State for video display
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  
  // References
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  
  // Current audio source tracking for debugging
  const currentAudioSource = useRef<string>("");

  // 1. Consolidated Step Initiation Logic using useCallback
  const playStep = useCallback((regionName: string, stepIndex: number) => {
    // Safety check
    if (!activeRegion) return;
    
    console.log(`Playing step for region: ${regionName}, step: ${stepIndex + 1}`);
    
    // Update displayed messages based on first step or subsequent steps
    if (stepIndex === 0) {
      // For first step, initialize messages array
      if (activeRegion.description && activeRegion.description.length > 0) {
        setDisplayedMessages([activeRegion.description[0]]);
      } else {
        setDisplayedMessages([]);
      }
    } else {
      // For subsequent steps, append to messages array
      if (activeRegion.description && activeRegion.description[stepIndex]) {
        setDisplayedMessages(prevMessages => [
          ...prevMessages,
          activeRegion.description[stepIndex]
        ]);
      }
    }
    
    // Ensure video is visible if the region has description
    if (activeRegion.description && activeRegion.description.length > 0) {
      setShowVideo(true);
      
      // Ensure video is in idle loop before starting audio
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play()
          .catch(err => console.error("Error playing intro video:", err));
      }
    } else {
      setShowVideo(false);
    }
    
    // Play audio for the step with a delay to allow video to sync
    setTimeout(() => {
      // Check if we're still on the same step (handle rapid clicks)
      if (!audioRef.current) return;
      
      // Construct the audio file path
      const audioPath = `/audio/${worksheetId}/${regionName}_${stepIndex + 1}.mp3`;
      currentAudioSource.current = audioPath; // Track current audio for debugging
      
      // Set up and play audio
      audioRef.current.src = audioPath;
      audioRef.current.load(); // Important: load before playing
      
      // Error handling for audio
      audioRef.current.onerror = () => {
        console.error(`Failed to load audio: ${audioPath}`);
        toast({
          title: "Audio Error",
          description: "Could not load the audio file",
          variant: "destructive"
        });
        setIsAudioPlaying(false);
      };
      
      // Play audio when ready
      const playAudioWhenReady = () => {
        if (audioRef.current && 
            (audioRef.current.readyState >= 3 || // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
             document.visibilityState === 'hidden')) { // Force play if tab not visible
          audioRef.current.play()
            .then(() => {
              console.log("Audio started playing successfully");
            })
            .catch(err => {
              console.error("Error playing audio:", err);
              setIsAudioPlaying(false);
            });
          audioRef.current.removeEventListener('canplaythrough', playAudioWhenReady);
        }
      };
      
      audioRef.current.addEventListener('canplaythrough', playAudioWhenReady);
      
      // Fallback in case canplaythrough doesn't fire
      setTimeout(() => {
        if (audioRef.current && audioRef.current.paused) {
          console.log("Fallback audio play attempt");
          audioRef.current.play()
            .catch(err => {
              console.error("Fallback audio play failed:", err);
              setIsAudioPlaying(false);
            });
        }
      }, 1000);
    }, 500);
    
  }, [worksheetId, activeRegion, setShowVideo, setDisplayedMessages]);

  // Initial setup when page loads
  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log(`Attempting to load PDF from: ${pdfPath}`);
    
    toast({
      title: "Loading PDF",
      description: `Trying to load from ${pdfPath}`,
    });
    
    // Reset retry count when worksheet or page changes
    if (worksheetId || pageIndex) {
      setRetryCount(0);
    }

    // Reset states when worksheet or page changes
    setActiveRegion(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    setIsTextMode(false);
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
  
  // Calculate PDF position and scale factor
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

  // Auto-scroll the text display area
  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);
  
  // 4. Initial Video Playback Logic when showVideo changes
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (showVideo) {
      // Check if video should be in idle mode (not playing audio)
      if (!isAudioPlaying && videoRef.current.paused) {
        console.log("Starting video in idle mode");
        videoRef.current.currentTime = 0;  // Start at beginning of idle loop
        videoRef.current.play()
          .then(() => console.log("Idle video started successfully"))
          .catch(err => console.error("Error starting idle video:", err));
      }
    } else {
      // If video shouldn't be shown, pause it
      videoRef.current.pause();
      console.log("Video hidden, pausing playback");
    }
  }, [showVideo, isAudioPlaying]);

  // 3. Audio and Video Event Handlers
  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    // Event handlers for audio
    const handleAudioPlaying = () => {
      console.log('⏯️ Audio started playing:', currentAudioSource.current);
      setIsAudioPlaying(true);
      
      // ASSERTIVELY transition to talking animation loop
      if (video) {
        video.currentTime = 10; // Start of talking animation
        video.play()
          .then(() => console.log("Video successfully transitioned to talking loop"))
          .catch(err => console.error("Error transitioning video to talking:", err));
      }
    };
    
    const handleAudioPauseOrEnded = () => {
      console.log('⏹️ Audio paused/ended');
      setIsAudioPlaying(false);
      // Video will transition back to idle via the handleVideoTimeUpdate
    };
    
    // Handle video time updates for managing the loop regions
    const handleVideoTimeUpdate = () => {
      if (!video || !audio) return;
      
      // Define loop regions
      const idleLoopEnd = 9.9;  // End of idle animation loop (0-9.9s)
      const talkingLoopStart = 10; // Start of talking animation (10s+)
      
      // Determine proper loop state from audio state
      if (isAudioPlaying && !audio.paused) {
        // Audio IS playing - video should be in TALKING loop
        
        // Check if video is incorrectly in IDLE segment when audio is playing
        if (video.currentTime < idleLoopEnd) {
          console.error("STATE MISMATCH! Video in idle when audio playing. Correcting...");
          video.currentTime = talkingLoopStart; // Force to talking loop
          video.play()
            .then(() => console.log("Corrected video state mismatch"))
            .catch(err => console.error("Error fixing video mismatch:", err));
        }
        
        // If near end of video, loop back to start of talking segment
        else if (video.currentTime >= video.duration - 0.2) {
          console.log("Looping talking animation");
          video.currentTime = talkingLoopStart;
        }
      } 
      else {
        // Audio is NOT playing - video should be in IDLE loop
        
        // If near end of idle segment, loop back to start of idle
        if (video.currentTime >= 9.8 && video.currentTime < talkingLoopStart) {
          console.log("Looping idle animation");
          video.currentTime = 0;
        }
        
        // If in talking segment but audio is not playing, reset to idle
        else if (video.currentTime >= talkingLoopStart) {
          console.log("Resetting to idle loop from talking segment");
          video.currentTime = 0;
        }
        
        // Ensure video is playing if it should be in idle loop but is paused
        if (video.paused && showVideo) {
          console.log("Restarting paused idle video");
          video.play()
            .then(() => console.log("Successfully restarted idle video"))
            .catch(err => console.error("Error restarting idle video:", err));
        }
      }
    };
    
    // Add event listeners
    audio.addEventListener('playing', handleAudioPlaying);
    audio.addEventListener('pause', handleAudioPauseOrEnded);
    audio.addEventListener('ended', handleAudioPauseOrEnded);
    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    // Clean up event listeners
    return () => {
      audio.removeEventListener('playing', handleAudioPlaying);
      audio.removeEventListener('pause', handleAudioPauseOrEnded);
      audio.removeEventListener('ended', handleAudioPauseOrEnded);
      video.removeEventListener('timeupdate', handleVideoTimeUpdate);
    };
  }, [videoRef.current, audioRef.current, isAudioPlaying, showVideo]);

  // Retry handler for PDF loading
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setLoading(true);
    setError(null);
    toast({
      title: "Retrying PDF load",
      description: "Attempting to reload the PDF...",
    });
  };

  // PDF load handlers
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
  
  // 2. Updated Region Click Handler
  const handleRegionClick = (region: RegionData) => {
    console.log(`Region clicked: ${region.name}`);
    
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      console.log("Stopped previous audio playback");
    }
    
    // Set active region and reset step index
    setActiveRegion(region);
    setCurrentStepIndex(0);
    
    // Set to text mode when a region is clicked
    setIsTextMode(true);
    
    // Use the consolidated playStep function
    playStep(region.name, 0);
    
    toast({
      title: "Region Selected",
      description: `You clicked on: ${region.name}`,
    });
  };
  
  // 2. Updated Next Step Handler
  const handleNextStep = () => {
    if (activeRegion && activeRegion.description && currentStepIndex < activeRegion.description.length - 1) {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        console.log("Stopped audio for current step");
      }
      
      // Increment step index
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      
      // Play the next step using consolidated function
      playStep(activeRegion.name, nextStepIndex);
    }
  };
  
  // Toggle text mode on double click
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
            playStep(activeRegion.name, currentStepIndex);
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
          {/* Video element for avatar */}
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
