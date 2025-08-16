import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import WorksheetViewer from "@/components/WorksheetViewer";
import AutoModeViewer from "@/components/AutoModeViewer";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";
import { useWorksheetData } from "@/hooks/useWorksheetData";
import type { RegionData, AutoModeGuidanceItem, isAutoModeMetadata } from "@/types/worksheet";

interface StoredRegionData {
  currentStepIndex: number;
}

interface StoredGuidanceData {
  currentStepIndex: number;
}

interface SessionPageData {
  lastActiveRegionId: string | null;
  regions: Record<string, StoredRegionData>;
  lastActiveGuidanceKey: string | null;
  guidance: Record<string, StoredGuidanceData>;
}

const WorksheetPage: React.FC = () => {
  const { t } = useTranslation();
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isTextModeActive, setIsTextModeActive] = useState(false);
  const [currentActiveRegion, setCurrentActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [allRegionsState, setAllRegionsState] = useState<Record<string, StoredRegionData>>({});
  const [currentActiveGuidanceItem, setCurrentActiveGuidanceItem] = useState<AutoModeGuidanceItem | null>(null);
  const [allGuidanceState, setAllGuidanceState] = useState<Record<string, StoredGuidanceData>>({});
  const [initialActiveRegion, setInitialActiveRegion] = useState<RegionData | null>(null);
  const [initialCurrentStepIndex, setInitialCurrentStepIndex] = useState<number>(0);
  const [initialActiveGuidanceItem, setInitialActiveGuidanceItem] = useState<AutoModeGuidanceItem | null>(null);
  
  // Get initial state from navigation (when returning from AI chat)
  const locationState = location.state as { 
    initialActiveRegion?: RegionData; 
    initialCurrentStepIndex?: number;
    initialActiveGuidanceItem?: AutoModeGuidanceItem;
  } | null;
  
  // Fetch worksheet data once at the page level
  const { data: worksheetData, isLoading, error } = useWorksheetData(id || '');
  
  // Enable zooming for worksheet page
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      // Store original viewport content
      const originalContent = viewportMeta.content;
      
      // Enable zooming for worksheet page
      viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5.0";
      
      // Cleanup function to restore original viewport when component unmounts
      return () => {
        if (viewportMeta) {
          viewportMeta.content = originalContent;
        }
      };
    }
  }, []);
  
  // Control zooming based on text mode state
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      if (isTextModeActive) {
        // Disable zooming and reset zoom when entering text/audio/video mode
        viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0";
        console.log('Zoom disabled and reset due to text mode activation');
      } else {
        // Re-enable zooming when exiting text/audio/video mode
        viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5.0";
        console.log('Zoom re-enabled due to text mode deactivation');
      }
    }
  }, [isTextModeActive]);
  
  // Load session state when worksheet or page changes
  useEffect(() => {
    if (!id || !n) return;
    
    const sessionKey = `worksheet_page_state_${id}_${n}`;
    console.log('🔍 [DEBUG] Loading session state with key:', sessionKey);
    
    try {
      const storedState = sessionStorage.getItem(sessionKey);
      console.log('🔍 [DEBUG] Raw stored state from sessionStorage:', storedState);
      
      if (storedState) {
        const parsedState = JSON.parse(storedState) as SessionPageData;
        console.log('🔍 [DEBUG] Parsed session state:', parsedState);
        
        // Set all regions state
        setAllRegionsState(parsedState.regions || {});
        setAllGuidanceState(parsedState.guidance || {});
        console.log('🔍 [DEBUG] Set allRegionsState to:', parsedState.regions || {});
        console.log('🔍 [DEBUG] Set allGuidanceState to:', parsedState.guidance || {});
        
        // If we have location state (from AI chat), prioritize that
        if (locationState?.initialActiveRegion) {
          console.log('🔍 [DEBUG] Using location state - initialActiveRegion:', locationState.initialActiveRegion);
          setInitialActiveRegion(locationState.initialActiveRegion);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (locationState?.initialActiveGuidanceItem) {
          console.log('🔍 [DEBUG] Using location state - initialActiveGuidanceItem:', locationState.initialActiveGuidanceItem);
          setInitialActiveGuidanceItem(locationState.initialActiveGuidanceItem);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (parsedState.lastActiveRegionId && worksheetData?.meta?.regions) {
          // Find the last active region from the stored data
          const lastActiveRegion = worksheetData.meta.regions.find(
            region => region.id === parsedState.lastActiveRegionId
          );
          if (lastActiveRegion) {
            const regionState = parsedState.regions[parsedState.lastActiveRegionId];
            console.log('🔍 [DEBUG] Found last active region:', lastActiveRegion.id, 'with state:', regionState);
            setInitialActiveRegion(lastActiveRegion);
            setInitialCurrentStepIndex(regionState?.currentStepIndex || 0);
          }
        } else if (parsedState.lastActiveGuidanceKey && isAutoModeMetadata(worksheetData.meta)) {
          // Find the last active guidance item from the stored data
          const currentPageData = worksheetData.meta.data.find(page => page.page_number === parseInt(n!));
          if (currentPageData) {
            const [, guidanceTitle] = parsedState.lastActiveGuidanceKey.split('_', 2);
            const lastActiveGuidanceItem = currentPageData.guidance.find(
              item => item.title === guidanceTitle
            );
            if (lastActiveGuidanceItem) {
              const guidanceState = parsedState.guidance[parsedState.lastActiveGuidanceKey];
              console.log('🔍 [DEBUG] Found last active guidance item:', lastActiveGuidanceItem.title, 'with state:', guidanceState);
              setInitialActiveGuidanceItem(lastActiveGuidanceItem);
              setInitialCurrentStepIndex(guidanceState?.currentStepIndex || 0);
            }
          }
        }
      } else {
        console.log('🔍 [DEBUG] No session state found for key:', sessionKey);
        setAllRegionsState({});
        setAllGuidanceState({});
        
        // Use location state if available
        if (locationState?.initialActiveRegion) {
          console.log('🔍 [DEBUG] Using location state (no session) - initialActiveRegion:', locationState.initialActiveRegion);
          setInitialActiveRegion(locationState.initialActiveRegion);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (locationState?.initialActiveGuidanceItem) {
          console.log('🔍 [DEBUG] Using location state (no session) - initialActiveGuidanceItem:', locationState.initialActiveGuidanceItem);
          setInitialActiveGuidanceItem(locationState.initialActiveGuidanceItem);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        }
      }
    } catch (error) {
      console.warn('🔍 [DEBUG] Failed to load session state:', error);
      setAllRegionsState({});
      setAllGuidanceState({});
      
      // Use location state if available
      if (locationState?.initialActiveRegion) {
        console.log('🔍 [DEBUG] Using location state (error fallback) - initialActiveRegion:', locationState.initialActiveRegion);
        setInitialActiveRegion(locationState.initialActiveRegion);
        setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
      } else if (locationState?.initialActiveGuidanceItem) {
        console.log('🔍 [DEBUG] Using location state (error fallback) - initialActiveGuidanceItem:', locationState.initialActiveGuidanceItem);
        setInitialActiveGuidanceItem(locationState.initialActiveGuidanceItem);
        setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
      }
    }
  }, [id, n, locationState, worksheetData]);
  
  const goBack = () => {
    navigate("/");
  };

  // Memoize the handleRegionStateChange function to prevent unnecessary re-renders
  const handleRegionStateChange = useCallback((region: RegionData | null, stepIndex: number) => {
    console.log('🔍 [DEBUG] handleRegionStateChange called with region:', region?.id, 'stepIndex:', stepIndex);
    
    // Only update state if there's an actual change
    setCurrentActiveRegion(prevRegion => {
      const regionChanged = prevRegion?.id !== region?.id;
      if (regionChanged) {
        console.log('🔍 [DEBUG] Region changed from', prevRegion?.id, 'to', region?.id);
      }
      return regionChanged ? region : prevRegion;
    });
    
    setCurrentStepIndex(prevStepIndex => {
      const stepChanged = prevStepIndex !== stepIndex;
      if (stepChanged) {
        console.log('🔍 [DEBUG] Step index changed from', prevStepIndex, 'to', stepIndex);
      }
      return stepChanged ? stepIndex : prevStepIndex;
    });
    
    // Update all regions state and save to session storage
    if (id && n) {
      const sessionKey = `worksheet_page_state_${id}_${n}`;
      console.log('🔍 [DEBUG] Using session key for save:', sessionKey);
      
      // Use functional update to ensure we have the latest state
      setAllRegionsState(currentAllRegionsState => {
        console.log('🔍 [DEBUG] Current allRegionsState before update:', currentAllRegionsState);
        
        if (region) {
          // Update the state for this specific region
          const updatedAllRegionsState = {
            ...currentAllRegionsState,
            [region.id]: {
              currentStepIndex: stepIndex
            }
          };
          console.log('🔍 [DEBUG] Updated region state for:', region.id, 'with stepIndex:', stepIndex);
          
          // Get current guidance state to preserve it
          setAllGuidanceState(currentGuidanceState => {
            const stateToSave: SessionPageData = {
              lastActiveRegionId: region.id,
              regions: updatedAllRegionsState,
              lastActiveGuidanceKey: null,
              guidance: currentGuidanceState
            };
            
            console.log('🔍 [DEBUG] About to save state to sessionStorage:', stateToSave);
            
            try {
              sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
              console.log('🔍 [DEBUG] Successfully saved state to sessionStorage with key:', sessionKey);
              
              // Verify the save by immediately reading it back
              const verifyState = sessionStorage.getItem(sessionKey);
              console.log('🔍 [DEBUG] Verification - state read back from sessionStorage:', verifyState);
            } catch (error) {
              console.warn('🔍 [DEBUG] Failed to save page state to session:', error);
            }
            
            return currentGuidanceState;
          });
          
          console.log('🔍 [DEBUG] Returning updated allRegionsState:', updatedAllRegionsState);
          return updatedAllRegionsState;
        } else {
          // When no active region, check if we need to update sessionStorage
          try {
            const currentStoredState = sessionStorage.getItem(sessionKey);
            let currentSessionData: SessionPageData | null = null;
            
            if (currentStoredState) {
              currentSessionData = JSON.parse(currentStoredState);
            }
            
            // Only update sessionStorage if lastActiveRegionId is not already null
            if (currentSessionData?.lastActiveRegionId !== null) {
              setAllGuidanceState(currentGuidanceState => {
                const stateToSave: SessionPageData = {
                  lastActiveRegionId: null,
                  regions: currentAllRegionsState,
                  lastActiveGuidanceKey: currentSessionData?.lastActiveGuidanceKey || null,
                  guidance: currentGuidanceState
                };
                
                console.log('🔍 [DEBUG] About to save state (no active region) to sessionStorage:', stateToSave);
                
                sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
                console.log('🔍 [DEBUG] Successfully updated last active region in session with key:', sessionKey);
                
                // Verify the save by immediately reading it back
                const verifyState = sessionStorage.getItem(sessionKey);
                console.log('🔍 [DEBUG] Verification - state read back from sessionStorage:', verifyState);
                
                return currentGuidanceState;
              });
            } else {
              console.log('🔍 [DEBUG] No sessionStorage update needed - lastActiveRegionId already null');
            }
          } catch (error) {
            console.warn('🔍 [DEBUG] Failed to update session state:', error);
          }
          
          console.log('🔍 [DEBUG] Returning unchanged allRegionsState:', currentAllRegionsState);
          // Return the same object reference to prevent unnecessary re-renders
          return currentAllRegionsState;
        }
      });
    }
  }, [id, n]);

  // Memoize the handleGuidanceStateChange function for Auto Mode
  const handleGuidanceStateChange = useCallback((guidanceItem: AutoModeGuidanceItem | null, stepIndex: number) => {
    console.log('🔍 [DEBUG] handleGuidanceStateChange called with guidance item:', guidanceItem?.title, 'stepIndex:', stepIndex);
    
    setCurrentActiveGuidanceItem(prevGuidanceItem => {
      const guidanceChanged = prevGuidanceItem?.title !== guidanceItem?.title;
      if (guidanceChanged) {
        console.log('🔍 [DEBUG] Guidance item changed from', prevGuidanceItem?.title, 'to', guidanceItem?.title);
      }
      return guidanceChanged ? guidanceItem : prevGuidanceItem;
    });
    
    setCurrentStepIndex(prevStepIndex => {
      const stepChanged = prevStepIndex !== stepIndex;
      if (stepChanged) {
        console.log('🔍 [DEBUG] Step index changed from', prevStepIndex, 'to', stepIndex);
      }
      return stepChanged ? stepIndex : prevStepIndex;
    });
    
    // Update all guidance state and save to session storage
    if (id && n) {
      const sessionKey = `worksheet_page_state_${id}_${n}`;
      console.log('🔍 [DEBUG] Using session key for guidance save:', sessionKey);
      
      setAllGuidanceState(currentAllGuidanceState => {
        console.log('🔍 [DEBUG] Current allGuidanceState before update:', currentAllGuidanceState);
        
        if (guidanceItem) {
          const pageIndex = parseInt(n, 10);
          const guidanceKey = `${pageIndex}_${guidanceItem.title}`;
          const updatedAllGuidanceState = {
            ...currentAllGuidanceState,
            [guidanceKey]: {
              currentStepIndex: stepIndex
            }
          };
          console.log('🔍 [DEBUG] Updated guidance state for:', guidanceKey, 'with stepIndex:', stepIndex);
          
          // Get current regions state to preserve it
          setAllRegionsState(currentRegionsState => {
            const stateToSave: SessionPageData = {
              lastActiveRegionId: null,
              regions: currentRegionsState,
              lastActiveGuidanceKey: guidanceKey,
              guidance: updatedAllGuidanceState
            };
            
            console.log('🔍 [DEBUG] About to save guidance state to sessionStorage:', stateToSave);
            
            try {
              sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
              console.log('🔍 [DEBUG] Successfully saved guidance state to sessionStorage with key:', sessionKey);
            } catch (error) {
              console.warn('🔍 [DEBUG] Failed to save guidance state to session:', error);
            }
            
            return currentRegionsState;
          });
          
          console.log('🔍 [DEBUG] Returning updated allGuidanceState:', updatedAllGuidanceState);
          return updatedAllGuidanceState;
        } else {
          // When no active guidance item, update sessionStorage
          try {
            const currentStoredState = sessionStorage.getItem(sessionKey);
            let currentSessionData: SessionPageData | null = null;
            
            if (currentStoredState) {
              currentSessionData = JSON.parse(currentStoredState);
            }
            
            if (currentSessionData?.lastActiveGuidanceKey !== null) {
              setAllRegionsState(currentRegionsState => {
                const stateToSave: SessionPageData = {
                  lastActiveRegionId: currentSessionData?.lastActiveRegionId || null,
                  regions: currentRegionsState,
                  lastActiveGuidanceKey: null,
                  guidance: currentAllGuidanceState
                };
                
                console.log('🔍 [DEBUG] About to save state (no active guidance) to sessionStorage:', stateToSave);
                
                sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
                console.log('🔍 [DEBUG] Successfully updated last active guidance in session with key:', sessionKey);
                
                return currentRegionsState;
              });
            }
          } catch (error) {
            console.warn('🔍 [DEBUG] Failed to update guidance session state:', error);
          }
          
          return currentAllGuidanceState;
        }
      });
    }
  }, [id, n]);

  if (!id || !n) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('aiChat.missingInfo')}
        </h1>
        <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.returnToScanner')}
        </Button>
      </div>
    );
  }

  const pageIndex = parseInt(n, 10);
  
  if (isNaN(pageIndex)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.invalidPage')}
        </h1>
        <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.returnToScanner')}
        </Button>
      </div>
    );
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <p className="text-lg">{t('worksheet.loading')}</p>
        </div>
      </div>
    );
  }

  // Show error if worksheet not found
  if (error || !worksheetData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {error?.message || t('worksheet.notFound')}
          </h1>
          <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white">
            {t('worksheet.returnToScanner')}
          </Button>
        </div>
      </div>
    );
  }

  // Determine which mode we're in and render accordingly
  const isAutoMode = worksheetData && isAutoModeMetadata(worksheetData.meta);

  return (
    <div className="min-h-screen bg-gray-50">
      {isAutoMode ? (
        <AutoModeViewer
          worksheetId={id}
          pageIndex={pageIndex}
          worksheetMeta={worksheetData.meta}
          onTextModeChange={setIsTextModeActive}
          initialActiveGuidanceItem={initialActiveGuidanceItem}
          initialCurrentStepIndex={initialCurrentStepIndex}
          onGuidanceStateChange={handleGuidanceStateChange}
          allGuidanceState={allGuidanceState}
        />
      ) : (
        <WorksheetViewer 
          worksheetId={id} 
          pageIndex={pageIndex} 
          worksheetMeta={worksheetData.meta as any}
          pdfUrl={worksheetData.pdfUrl}
          onTextModeChange={setIsTextModeActive}
          initialActiveRegion={initialActiveRegion}
          initialCurrentStepIndex={initialCurrentStepIndex}
          onRegionStateChange={handleRegionStateChange}
          allRegionsState={allRegionsState}
        />
      )}
      
      <AIChatButton 
        worksheetId={id} 
        pageNumber={pageIndex} 
        isTextModeActive={isTextModeActive}
        activeRegion={isAutoMode ? null : currentActiveRegion}
        activeGuidanceItem={isAutoMode ? currentActiveGuidanceItem : null}
        currentStepIndex={currentStepIndex}
        pdfUrl={worksheetData.pdfUrl}
        worksheetMeta={worksheetData.meta}
      />
    </div>
  );
};

export default WorksheetPage;