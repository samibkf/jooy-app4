import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import type { AutoModeMetadata, AutoModeGuidanceItem, AutoModePageData } from "@/types/worksheet";

interface StoredGuidanceData {
  currentStepIndex: number;
}

interface AutoModeViewerProps {
  worksheetId: string;
  pageIndex: number;
  worksheetMeta: AutoModeMetadata;
  onTextModeChange?: (isTextMode: boolean) => void;
  initialActiveGuidanceItem?: AutoModeGuidanceItem | null;
  initialCurrentStepIndex?: number;
  onGuidanceStateChange?: (guidanceItem: AutoModeGuidanceItem | null, stepIndex: number) => void;
  allGuidanceState?: Record<string, StoredGuidanceData>;
}

const AutoModeViewer: React.FC<AutoModeViewerProps> = ({
  worksheetId,
  pageIndex,
  worksheetMeta,
  onTextModeChange,
  initialActiveGuidanceItem,
  initialCurrentStepIndex = 0,
  onGuidanceStateChange,
  allGuidanceState = {}
}) => {
  const { t } = useTranslation();
  
  const [activeGuidanceItem, setActiveGuidanceItem] = useState<AutoModeGuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [hasRestoredInitialState, setHasRestoredInitialState] = useState<boolean>(false);
  
  const textDisplayRef = useRef<HTMLDivElement>(null);
  
  // Get current page data
  const currentPageData = worksheetMeta.data.find(page => page.page_number === pageIndex);
  
  // Reset component state when worksheet or page changes
  const prevWorksheetIdRef = useRef<string>(worksheetId);
  const prevPageIndexRef = useRef<number>(pageIndex);
  
  useEffect(() => {
    const worksheetChanged = prevWorksheetIdRef.current !== worksheetId;
    const pageChanged = prevPageIndexRef.current !== pageIndex;
    
    if (worksheetChanged || pageChanged) {
      setActiveGuidanceItem(null);
      setCurrentStepIndex(0);
      setDisplayedMessages([]);
      setIsTextMode(false);
      setHasRestoredInitialState(false);
      
      if (onTextModeChange) {
        onTextModeChange(false);
      }
      
      prevWorksheetIdRef.current = worksheetId;
      prevPageIndexRef.current = pageIndex;
    }
  }, [worksheetId, pageIndex, onTextModeChange]);

  // Apply initial state restoration
  useEffect(() => {
    if (initialActiveGuidanceItem && currentPageData && !hasRestoredInitialState) {
      const matchingGuidanceItem = currentPageData.guidance.find(
        item => item.title === initialActiveGuidanceItem.title
      );
      
      if (matchingGuidanceItem) {
        setActiveGuidanceItem(matchingGuidanceItem);
        setCurrentStepIndex(initialCurrentStepIndex);
        setIsTextMode(true);
        
        // Split description into paragraphs and display up to current step
        const paragraphs = matchingGuidanceItem.description
          .split('\n')
          .filter(paragraph => paragraph.trim() !== '');
        
        const messagesToDisplay = paragraphs.slice(0, initialCurrentStepIndex + 1);
        setDisplayedMessages(messagesToDisplay);
        
        if (onTextModeChange) {
          onTextModeChange(true);
        }
        
        setHasRestoredInitialState(true);
      }
    }
  }, [initialActiveGuidanceItem, initialCurrentStepIndex, currentPageData, hasRestoredInitialState, onTextModeChange]);

  // Notify parent when guidance state changes
  useEffect(() => {
    if (onGuidanceStateChange) {
      onGuidanceStateChange(activeGuidanceItem, currentStepIndex);
    }
  }, [activeGuidanceItem, currentStepIndex, onGuidanceStateChange]);

  // Auto-scroll to bottom when new messages are displayed
  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);

  const handleGuidanceItemClick = (guidanceItem: AutoModeGuidanceItem) => {
    console.log('🔍 [DEBUG] Guidance item clicked:', guidanceItem.title);
    
    // Check if this guidance item has saved state
    const guidanceKey = `${pageIndex}_${guidanceItem.title}`;
    const savedGuidanceState = allGuidanceState[guidanceKey];
    const startingStepIndex = savedGuidanceState?.currentStepIndex || 0;
    
    console.log(`🔍 [DEBUG] Guidance item ${guidanceItem.title} clicked. Saved state:`, savedGuidanceState, `Starting at step: ${startingStepIndex}`);
    
    setCurrentStepIndex(startingStepIndex);
    
    // Split description into paragraphs
    const paragraphs = guidanceItem.description
      .split('\n')
      .filter(paragraph => paragraph.trim() !== '');
    
    if (paragraphs.length > 0) {
      // Display messages up to the saved step index
      const messagesToDisplay = paragraphs.slice(0, startingStepIndex + 1);
      setDisplayedMessages(messagesToDisplay);
    } else {
      setDisplayedMessages([]);
    }
    
    setActiveGuidanceItem(guidanceItem);
    setIsTextMode(true);
    
    if (onTextModeChange) {
      onTextModeChange(true);
    }
  };

  const handleNextStep = () => {
    if (!activeGuidanceItem) return;
    
    const paragraphs = activeGuidanceItem.description
      .split('\n')
      .filter(paragraph => paragraph.trim() !== '');
    
    if (currentStepIndex < paragraphs.length - 1) {
      const nextStepIndex = currentStepIndex + 1;
      console.log('🔍 [DEBUG] Advancing to next step:', nextStepIndex, 'for guidance item:', activeGuidanceItem.title);
      
      setCurrentStepIndex(nextStepIndex);
      
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        paragraphs[nextStepIndex]
      ]);
    }
  };

  const handleBackButtonClick = () => {
    setIsTextMode(false);
    
    if (onTextModeChange) {
      onTextModeChange(false);
    }
    
    setActiveGuidanceItem(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
  };

  if (!currentPageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {t('worksheet.invalidPage')}
          </h1>
        </div>
      </div>
    );
  }

  const paragraphs = activeGuidanceItem 
    ? activeGuidanceItem.description.split('\n').filter(p => p.trim() !== '')
    : [];
  const hasNextStep = activeGuidanceItem && currentStepIndex < paragraphs.length - 1;

  return (
    <div className={`worksheet-container ${isTextMode ? 'text-mode' : ''}`}>
      {isTextMode && (
        <Button
          onClick={handleBackButtonClick}
          className="fixed top-4 left-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
          size="icon"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}

      {!isTextMode && (
        <div className="auto-mode-titles-container w-full max-w-4xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-center mb-2" dir={getTextDirection(currentPageData.page_description)}>
              Page {currentPageData.page_number}
            </h1>
            <p className="text-gray-600 text-center" dir={getTextDirection(currentPageData.page_description)}>
              {currentPageData.page_description}
            </p>
          </div>
          
          <div className="space-y-4">
            {currentPageData.guidance.map((guidanceItem, index) => (
              <div
                key={index}
                className="guidance-item-card bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={() => handleGuidanceItemClick(guidanceItem)}
                dir={getTextDirection(guidanceItem.title)}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {guidanceItem.title}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-2">
                  {guidanceItem.description.split('\n')[0]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeGuidanceItem && (
        <div className={`worksheet-text-display-container ${isTextMode ? 'active' : 'hidden'}`}>
          <div 
            className="worksheet-text-display"
            ref={textDisplayRef}
          >
            <div className="text-content chat-messages">
              {displayedMessages.map((message, index) => (
                <div 
                  key={index} 
                  className="chat-message"
                  data-message-index={index}
                  dir={getTextDirection(message)}
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
    </div>
  );
};

export default AutoModeViewer;