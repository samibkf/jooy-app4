import React, { useState, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles } from "lucide-react";
import { supabase } from '../lib/supabaseClient';
import type { WorksheetMetadata, RegionData } from "@/types/worksheet";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Helper function to convert a Base64 string to an ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper function to convert hex string to ArrayBuffer for the encryption key
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

interface WorksheetViewerProps {
  worksheetId: string;
  pageIndex: number;
  userId: string;
}

const WorksheetViewer: React.FC<WorksheetViewerProps> = ({ worksheetId, pageIndex, userId }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [worksheetData, setWorksheetData] = useState<WorksheetMetadata | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  
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

  // Main data fetching effect - now fetches encrypted PDF and metadata
  useEffect(() => {
    const fetchSecureWorksheet = async () => {
      if (!worksheetId || !userId) return;
      
      setIsLoading(true);
      setError(null);
      setWorksheetData(null);
      setPdfData(null);

      try {
        console.log('Fetching secure worksheet for:', { worksheetId, userId });
        
        // 1. Call the secure backend function to get encrypted PDF
        const { data: encryptedData, error: funcError } = await supabase.functions.invoke('get-encrypted-worksheet', {
          body: { worksheetId, userId },
        });
        
        if (funcError) {
          console.error('Supabase function error:', funcError);
          throw funcError;
        }

        console.log('Received encrypted data:', {
          hasEncryptedPdf: !!encryptedData?.encryptedPdf,
          hasIv: !!encryptedData?.iv,
          encryptedPdfLength: encryptedData?.encryptedPdf?.length,
          ivLength: encryptedData?.iv?.length
        });

        // 2. Prepare for decryption
        const keyHex = import.meta.env.VITE_PDF_ENCRYPTION_KEY;
        if (!keyHex) {
          throw new Error("Encryption key not found in environment.");
        }

        console.log('Using encryption key length:', keyHex.length);

        // Convert hex key to ArrayBuffer
        const keyBuffer = hexToArrayBuffer(keyHex);
        console.log('Key buffer length:', keyBuffer.byteLength);

        const cryptoKey = await crypto.subtle.importKey(
          'raw', 
          keyBuffer, 
          { name: 'AES-GCM' }, 
          false, 
          ['decrypt']
        );
        
        console.log('Crypto key imported successfully');
        
        // 3. Decode the data and decrypt it
        const iv = base64ToArrayBuffer(encryptedData.iv);
        const encryptedPdf = base64ToArrayBuffer(encryptedData.encryptedPdf);
        
        console.log('Decryption parameters:', {
          ivLength: iv.byteLength,
          encryptedPdfLength: encryptedPdf.byteLength
        });
        
        const decryptedPdf = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          cryptoKey,
          encryptedPdf
        );
        
        console.log('PDF decrypted successfully, size:', decryptedPdf.byteLength);
        setPdfData(decryptedPdf);

        // 4. Fetch worksheet metadata from database
        console.log('Fetching worksheet metadata...');
        const { data: worksheet, error: worksheetError } = await supabase
          .from('worksheets')
          .select('*')
          .eq('id', worksheetId)
          .single();

        if (worksheetError) {
          console.error('Worksheet metadata error:', worksheetError);
          throw new Error(`Failed to fetch worksheet metadata: ${worksheetError.message}`);
        }

        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('*')
          .eq('worksheet_id', worksheetId)
          .order('page', { ascending: true });

        if (regionsError) {
          console.error('Regions data error:', regionsError);
          throw new Error(`Failed to fetch regions: ${regionsError.message}`);
        }

        const metadata: WorksheetMetadata = {
          documentName: worksheet.document_name,
          documentId: worksheet.document_id,
          drmProtectedPages: worksheet.drm_protected_pages || [],
          drmProtected: worksheet.drm_protected || false,
          regions: regionsData || []
        };

        console.log('Worksheet metadata loaded:', {
          documentName: metadata.documentName,
          regionsCount: metadata.regions.length,
          drmProtected: metadata.drmProtected
        });

        setWorksheetData(metadata);

      } catch (e: any) {
        console.error("Failed to fetch secure worksheet:", e);
        console.error("Error details:", {
          message: e.message,
          stack: e.stack,
          name: e.name
        });
        setError("Could not load the worksheet. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecureWorksheet();
  }, [worksheetId, pageIndex, userId]);

  // Check if current page is DRM protected
  useEffect(() => {
    if (worksheetData) {
      const isDrmProtected = worksheetData.drmProtected || 
        (worksheetData.drmProtectedPages && worksheetData.drmProtectedPages.includes(pageIndex));
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
    setError("PDF not found or unable to load");
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
          <p>Loading secure worksheet...</p>
        </div>
      </div>
    );
  }

  // Show error if worksheet not found
  if (error) {
    return (
      <div className="worksheet-container">
        <div className="worksheet-error">
          <p>{error}</p>
          <Button onClick={() => window.location.href = '/'}>
            Return to Scanner
          </Button>
        </div>
      </div>
    );
  }

  // Show error if no data available
  if (!worksheetData || !pdfData) {
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
          file={pdfData}
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
              file={pdfData}
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