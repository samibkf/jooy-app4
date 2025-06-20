import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";
import { useWorksheetData } from "@/hooks/useWorksheetData";
import type { RegionData } from "@/types/worksheet";

interface SessionRegionState {
  activeRegion: RegionData | null;
  currentStepIndex: number;
}

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isTextModeActive, setIsTextModeActive] = useState(false);
  const [currentActiveRegion, setCurrentActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [initialRegionStateFromSession, setInitialRegionStateFromSession] = useState<SessionRegionState | null>(null);
  
  // Get initial state from navigation (when returning from AI chat)
  const locationState = location.state as { 
    initialActiveRegion?: RegionData; 
    initialCurrentStepIndex?: number; 
  } | null;
  
  // Fetch worksheet data once at the page level
  const { data: worksheetData, isLoading, error } = useWorksheetData(id || '');
  
  // Load session state when worksheet or page changes
  useEffect(() => {
    if (!id || !n) return;
    
    const sessionKey = `worksheet_region_state_${id}_${n}`;
    
    try {
      const storedState = sessionStorage.getItem(sessionKey);
      if (storedState) {
        const parsedState = JSON.parse(storedState) as SessionRegionState;
        console.log('Loaded region state from session:', parsedState);
        setInitialRegionStateFromSession(parsedState);
      } else {
        console.log('No session state found for:', sessionKey);
        setInitialRegionStateFromSession(null);
      }
    } catch (error) {
      console.warn('Failed to load session state:', error);
      setInitialRegionStateFromSession(null);
    }
  }, [id, n]);
  
  const goBack = () => {
    navigate("/");
  };

  const handleRegionStateChange = (region: RegionData | null, stepIndex: number) => {
    setCurrentActiveRegion(region);
    setCurrentStepIndex(stepIndex);
    
    // Save to session storage
    if (id && n) {
      const sessionKey = `worksheet_region_state_${id}_${n}`;
      const stateToSave: SessionRegionState = {
        activeRegion: region,
        currentStepIndex: stepIndex
      };
      
      try {
        if (region) {
          sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
          console.log('Saved region state to session:', stateToSave);
        } else {
          // Remove from session storage when no active region
          sessionStorage.removeItem(sessionKey);
          console.log('Removed region state from session');
        }
      } catch (error) {
        console.warn('Failed to save region state to session:', error);
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

  // Determine initial state with priority: location.state > session storage > defaults
  const getInitialActiveRegion = () => {
    if (locationState?.initialActiveRegion) {
      console.log('Using initial active region from location state');
      return locationState.initialActiveRegion;
    }
    if (initialRegionStateFromSession?.activeRegion) {
      console.log('Using initial active region from session storage');
      return initialRegionStateFromSession.activeRegion;
    }
    console.log('Using default initial active region (null)');
    return null;
  };

  const getInitialCurrentStepIndex = () => {
    if (locationState?.initialCurrentStepIndex !== undefined) {
      console.log('Using initial step index from location state:', locationState.initialCurrentStepIndex);
      return locationState.initialCurrentStepIndex;
    }
    if (initialRegionStateFromSession?.currentStepIndex !== undefined) {
      console.log('Using initial step index from session storage:', initialRegionStateFromSession.currentStepIndex);
      return initialRegionStateFromSession.currentStepIndex;
    }
    console.log('Using default initial step index (0)');
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <WorksheetViewer 
        worksheetId={id} 
        pageIndex={pageIndex} 
        worksheetMeta={worksheetData.meta}
        pdfUrl={worksheetData.pdfUrl}
        onTextModeChange={setIsTextModeActive}
        initialActiveRegion={getInitialActiveRegion()}
        initialCurrentStepIndex={getInitialCurrentStepIndex()}
        onRegionStateChange={handleRegionStateChange}
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