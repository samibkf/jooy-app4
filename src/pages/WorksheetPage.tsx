import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";
import { useWorksheetData } from "@/hooks/useWorksheetData";
import type { RegionData } from "@/types/worksheet";

interface StoredRegionData {
  currentStepIndex: number;
}

interface SessionPageData {
  lastActiveRegionId: string | null;
  regions: Record<string, StoredRegionData>;
}

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isTextModeActive, setIsTextModeActive] = useState(false);
  const [currentActiveRegion, setCurrentActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [allRegionsState, setAllRegionsState] = useState<Record<string, StoredRegionData>>({});
  const [initialActiveRegion, setInitialActiveRegion] = useState<RegionData | null>(null);
  const [initialCurrentStepIndex, setInitialCurrentStepIndex] = useState<number>(0);
  
  // Get initial state from navigation (when returning from AI chat)
  const locationState = location.state as { 
    initialActiveRegion?: RegionData; 
    initialCurrentStepIndex?: number; 
  } | null;
  
  // Fetch worksheet data once at the page level
  const { data: worksheetData, isLoading, error } = useWorksheetData(id || '');
  
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
    
    try {
      const storedState = sessionStorage.getItem(sessionKey);
      if (storedState) {
        const parsedState = JSON.parse(storedState) as SessionPageData;
        console.log('Loaded page state from session:', parsedState);
        
        // Set all regions state
        setAllRegionsState(parsedState.regions || {});
        
        // If we have location state (from AI chat), prioritize that
        if (locationState?.initialActiveRegion) {
          setInitialActiveRegion(locationState.initialActiveRegion);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (parsedState.lastActiveRegionId && worksheetData?.meta?.regions) {
          // Find the last active region from the stored data
          const lastActiveRegion = worksheetData.meta.regions.find(
            region => region.id === parsedState.lastActiveRegionId
          );
          if (lastActiveRegion) {
            const regionState = parsedState.regions[parsedState.lastActiveRegionId];
            setInitialActiveRegion(lastActiveRegion);
            setInitialCurrentStepIndex(regionState?.currentStepIndex || 0);
          }
        }
      } else {
        console.log('No session state found for:', sessionKey);
        setAllRegionsState({});
        
        // Use location state if available
        if (locationState?.initialActiveRegion) {
          setInitialActiveRegion(locationState.initialActiveRegion);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        }
      }
    } catch (error) {
      console.warn('Failed to load session state:', error);
      setAllRegionsState({});
      
      // Use location state if available
      if (locationState?.initialActiveRegion) {
        setInitialActiveRegion(locationState.initialActiveRegion);
        setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
      }
    }
  }, [id, n, locationState, worksheetData]);
  
  const goBack = () => {
    navigate("/");
  };

  const handleRegionStateChange = (region: RegionData | null, stepIndex: number) => {
    setCurrentActiveRegion(region);
    setCurrentStepIndex(stepIndex);
    
    // Update all regions state and save to session storage
    if (id && n) {
      const sessionKey = `worksheet_page_state_${id}_${n}`;
      
      let updatedAllRegionsState = { ...allRegionsState };
      
      if (region) {
        // Update the state for this specific region
        updatedAllRegionsState[region.id] = {
          currentStepIndex: stepIndex
        };
        setAllRegionsState(updatedAllRegionsState);
        
        const stateToSave: SessionPageData = {
          lastActiveRegionId: region.id,
          regions: updatedAllRegionsState
        };
        
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
          console.log('Saved page state to session:', stateToSave);
        } catch (error) {
          console.warn('Failed to save page state to session:', error);
        }
      } else {
        // When no active region, just update the lastActiveRegionId but keep all region states
        const stateToSave: SessionPageData = {
          lastActiveRegionId: null,
          regions: updatedAllRegionsState
        };
        
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
          console.log('Updated last active region in session:', stateToSave);
        } catch (error) {
          console.warn('Failed to update session state:', error);
        }
      }
    }
  };

  if (!id || !n) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Missing worksheet information
        </h1>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  const pageIndex = parseInt(n, 10);
  
  if (isNaN(pageIndex)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Invalid page number
        </h1>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading worksheet...</p>
        </div>
      </div>
    );
  }

  // Show error if worksheet not found
  if (error || !worksheetData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {error?.message || "Worksheet not found"}
          </h1>
          <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
            Return to Scanner
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WorksheetViewer 
        worksheetId={id} 
        pageIndex={pageIndex} 
        worksheetMeta={worksheetData.meta}
        pdfUrl={worksheetData.pdfUrl}
        onTextModeChange={setIsTextModeActive}
        initialActiveRegion={initialActiveRegion}
        initialCurrentStepIndex={initialCurrentStepIndex}
        onRegionStateChange={handleRegionStateChange}
        allRegionsState={allRegionsState}
      />
      <AIChatButton 
        worksheetId={id} 
        pageNumber={pageIndex} 
        isTextModeActive={isTextModeActive}
        activeRegion={currentActiveRegion}
        currentStepIndex={currentStepIndex}
        pdfUrl={worksheetData.pdfUrl}
        worksheetMeta={worksheetData.meta}
      />
    </div>
  );
};

export default WorksheetPage;