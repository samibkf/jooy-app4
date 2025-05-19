
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
  
  // Media playback states
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoPlaybackMode, setVideoPlaybackMode] = useState<'intro' | 'main'>('intro');
  
  // Define all refs first before using them
  // Reference for PDF container
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  // Animation frame reference for synchronization
  const animationFrameRef = useRef<number | null>(null);
  
  // Media element references
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  // Reference for media loaded states
  const mediaLoaded = useRef({
    audio: false,
    video: false,
  });
  
  // Reference for text display area to enable auto-scrolling
  const textDisplayRef = useRef<HTMLDivElement>(null);
  
  // Ref to track if component is mounted (for cleanup)
  const isMounted = useRef<boolean>(true);
  
  // Ref for user interaction flag (needed for autoplay policy)
  const hasUserInteracted = useRef<boolean>(false);
  
  // Initialize component
  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log(`Attempting to load PDF from: ${pdfPath}`);
    
    // Show toast when starting to load PDF
    toast({
      title: "Loading PDF",
      description: `Trying to load from ${pdfPath}`,
    });
    
    // Reset states when worksheet or page changes
    if (worksheetId || pageIndex) {
      setRetryCount(0);
      setActiveRegion(null);
      setCurrentStepIndex(0);
      setDisplayedMessages([]);
      setIsTextMode(false);
      setShowVideo(false);
      setIsAudioPlaying(false);
      setIsVideoPlaying(false);
      setVideoPlaybackMode('intro');
      
      // Reset media loaded states
      mediaLoaded.current = { audio: false, video: false };
      
      // Cancel any ongoing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    // Stop and reset media playback
    resetMediaPlayback();
    
    // Clean up function
    return () => {
      isMounted.current = false;
      
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Clean up media playback
      resetMediaPlayback();
    };
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

  // Handle user interaction for autoplay policies
  useEffect(() => {
    const handleUserInteraction = () => {
      hasUserInteracted.current = true;
      
      // Try preloading video on first interaction
      if (videoRef.current && !mediaLoaded.current.video) {
        console.log("Preloading video after user interaction");
        videoRef.current.load();
      }
    };
    
    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    
    return () => {
      // Clean up event listeners
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);
  
  // Setup media event listeners and synchronization mechanism
  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    // Video event listeners
    const handleVideoLoadedData = () => {
      console.log("Video loaded and ready to play");
      mediaLoaded.current.video = true;
    };
    
    const handleVideoPlay = () => {
      console.log("Video started playing");
      setIsVideoPlaying(true);
    };
    
    const handleVideoPause = () => {
      console.log("Video paused");
      // Only update state if component is still mounted
      if (isMounted.current) {
        setIsVideoPlaying(false);
      }
    };
    
    const handleVideoError = (e: Event) => {
      console.error("Video error:", e);
      mediaLoaded.current.video = false;
      
      // Show toast for video error
      toast({
        title: "Video Error",
        description: "Could not load the avatar video",
        variant: "destructive"
      });
    };
    
    // Audio event listeners
    const handleAudioLoadedData = () => {
      console.log("Audio loaded and ready to play");
      mediaLoaded.current.audio = true;
    };
    
    const handleAudioPlay = () => {
      console.log("Audio started playing");
      setIsAudioPlaying(true);
      setVideoPlaybackMode('main');
      
      // Ensure video is playing in main loop
      ensureVideoIsPlaying();
      
      // Start monitoring video playback
      startVideoPlaybackMonitoring();
    };
    
    const handleAudioPause = () => {
      console.log("Audio paused (not ended)");
    };
    
    const handleAudioEnded = () => {
      console.log("Audio ended");
      setIsAudioPlaying(false);
      setVideoPlaybackMode('intro');
      
      // Stop monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    
    const handleAudioError = (e: Event) => {
      console.error("Audio error:", e);
      mediaLoaded.current.audio = false;
      setIsAudioPlaying(false);
      
      // Show toast for audio error
      toast({
        title: "Audio Error",
        description: "Could not load the audio file",
        variant: "destructive"
      });
    };
    
    // Add event listeners
    video.addEventListener('loadeddata', handleVideoLoadedData);
    video.addEventListener('play', handleVideoPlay);
    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('error', handleVideoError);
    
    audio.addEventListener('loadeddata', handleAudioLoadedData);
    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('error', handleAudioError);
    
    // Ensure video is loaded
    if (!mediaLoaded.current.video) {
      console.log("Preloading video on mount");
      video.load();
    }
    
    // Cleanup function to remove all event listeners
    return () => {
      video.removeEventListener('loadeddata', handleVideoLoadedData);
      video.removeEventListener('play', handleVideoPlay);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('error', handleVideoError);
      
      audio.removeEventListener('loadeddata', handleAudioLoadedData);
      audio.removeEventListener('play', handleAudioPlay);
      audio.removeEventListener('pause', handleAudioPause);
      audio.removeEventListener('ended', handleAudioEnded);
      audio.removeEventListener('error', handleAudioError);
      
      // Cancel any animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [videoRef.current, audioRef.current]);
  
  // Helper function to ensure video stays in correct loop based on mode
  const maintainVideoLoop = useCallback(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Handle intro loop (0-10 seconds)
    if (videoPlaybackMode === 'intro') {
      if (video.currentTime >= 10) {
        console.log("Maintaining intro loop: resetting to 0");
        video.currentTime = 0;
      }
    } 
    // Handle main animation loop (10-20 seconds)
    else if (videoPlaybackMode === 'main') {
      if (video.currentTime < 10) {
        console.log("Video in intro section but should be in main: jumping to 10");
        video.currentTime = 10;
      } else if (video.currentTime >= 20) {
        console.log("Maintaining main loop: resetting to 10");
        video.currentTime = 10;
      }
    }
  }, [videoPlaybackMode]);
  
  // Start continuous monitoring of video playback
  const startVideoPlaybackMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const monitorVideoPlayback = () => {
      // Check if component is still mounted
      if (!isMounted.current) return;
      
      // Check if video exists
      if (videoRef.current) {
        // Maintain proper loop based on mode
        maintainVideoLoop();
        
        // If audio is playing, ensure video is also playing
        if (isAudioPlaying && !videoRef.current.paused) {
          // Video is already playing, just ensure it's in correct loop
        } else if (isAudioPlaying && videoRef.current.paused) {
          // Video paused but should be playing during audio playback
          console.log("Video paused during audio playback - attempting to resume");
          ensureVideoIsPlaying();
        }
      }
      
      // Continue monitoring loop
      animationFrameRef.current = requestAnimationFrame(monitorVideoPlayback);
    };
    
    // Start the monitoring loop
    animationFrameRef.current = requestAnimationFrame(monitorVideoPlayback);
  }, [isAudioPlaying, maintainVideoLoop]);
  
  // Helper function to ensure video is playing
  const ensureVideoIsPlaying = useCallback(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Reset video to correct position based on mode
    if (videoPlaybackMode === 'intro' && video.currentTime >= 10) {
      video.currentTime = 0;
    } else if (videoPlaybackMode === 'main' && (video.currentTime < 10 || video.currentTime >= 20)) {
      video.currentTime = 10;
    }
    
    // Try to play the video
    if (video.paused) {
      console.log(`Attempting to play video in ${videoPlaybackMode} mode`);
      video.play().catch(err => {
        console.error("Error playing video:", err);
        
        // If we can't play due to autoplay policy, wait for user interaction
        if (err.name === 'NotAllowedError') {
          console.log("Autoplay blocked - waiting for user interaction");
          
          // We'll try again when user interacts with the page
        }
      });
    }
  }, [videoPlaybackMode]);
  
  // Reset all media playback
  const resetMediaPlayback = () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
    }
    
    // Stop any playing video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Cancel any animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset states
    setIsAudioPlaying(false);
    setIsVideoPlaying(false);
    setVideoPlaybackMode('intro');
  };

  // Function to play audio segment with proper video synchronization
  const playAudioSegment = (regionName: string, stepIndex: number) => {
    if (!audioRef.current) return;
    
    // Construct the audio file path
    const audioPath = `/audio/${worksheetId}/${regionName}_${stepIndex + 1}.mp3`;
    console.log(`Attempting to play audio: ${audioPath}`);
    
    // Set the source and load the audio
    audioRef.current.src = audioPath;
    audioRef.current.load();
    
    // Reset audio loaded state
    mediaLoaded.current.audio = false;
    
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
    
    // Ensure video is in the correct mode before playing audio
    setVideoPlaybackMode('main');
    
    // Initialize video if available
    if (videoRef.current && showVideo) {
      // Ensure video is ready to play in main mode (seconds 10-20)
      videoRef.current.currentTime = 10;
      ensureVideoIsPlaying();
    }
    
    // Play the audio after a small delay to allow video to start
    setTimeout(() => {
      if (!audioRef.current) return;
      
      audioRef.current.play().catch(err => {
        console.error("Error playing audio:", err);
        
        // If we can't play due to autoplay policy, wait for user interaction
        if (err.name === 'NotAllowedError') {
          console.log("Audio autoplay blocked - waiting for user interaction");
          toast({
            title: "Audio Blocked",
            description: "Please interact with the page to enable audio",
          });
          setIsAudioPlaying(false);
        }
      });
    }, 100);
  };
  
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
  
  // Handle region click
  const handleRegionClick = (region: RegionData) => {
    console.log(`Region clicked: ${region.name}`);
    
    // Set user interaction flag
    hasUserInteracted.current = true;
    
    // Reset step index whether clicking same or different region
    setCurrentStepIndex(0);
    
    // Initialize displayed messages with just the first message
    if (region.description && region.description.length > 0) {
      setDisplayedMessages([region.description[0]]);
      
      // Show video if region has description (assuming it has audio)
      setShowVideo(true);
      
      // Reset video to intro state
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        setVideoPlaybackMode('intro');
        ensureVideoIsPlaying();
      }
      
      // Play audio for the first step after a brief delay
      setTimeout(() => {
        playAudioSegment(region.name, 0);
      }, 300);
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
      // Set user interaction flag
      hasUserInteracted.current = true;
      
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      }
      
      // Cancel any ongoing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      
      // Add the next message to displayed messages array
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        activeRegion.description[nextStepIndex]
      ]);
      
      // Play audio for the next step after a brief delay
      setTimeout(() => {
        playAudioSegment(activeRegion.name, nextStepIndex);
      }, 300);
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
        resetMediaPlayback();
      } else {
        // If switching to text mode, ensure video is in intro state
        if (videoRef.current && showVideo) {
          videoRef.current.currentTime = 0;
          setVideoPlaybackMode('intro');
          ensureVideoIsPlaying();
        }
        
        // If switching to text mode, replay the current step's audio
        if (activeRegion) {
          setTimeout(() => {
            playAudioSegment(activeRegion.name, currentStepIndex);
          }, 300);
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
      <audio 
        ref={audioRef} 
        className="hidden" 
        preload="auto" 
        crossOrigin="anonymous" 
      />
      
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
          <div 
            ref={videoContainerRef}
            className={`video-container ${showVideo ? '' : 'hidden'}`}
          >
            <video 
              ref={videoRef}
              className="video-element"
              src="/video/default.mp4"
              muted
              playsInline
              preload="auto"
              loop={false} // We'll handle looping manually
              crossOrigin="anonymous"
            />
          </div>
          
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

