import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";
import { useWorksheetData } from "@/hooks/useWorksheetData";
import type { RegionData } from "@/types/worksheet";

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isTextModeActive, setIsTextModeActive] = useState(false);
  const [currentActiveRegion, setCurrentActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  // Get initial state from navigation (when returning from AI chat)
  const locationState = location.state as { 
    initialActiveRegion?: RegionData; 
    initialCurrentStepIndex?: number; 
  } | null;
  
  // Fetch worksheet data once at the page level
  const { data: worksheetData, isLoading, error } = useWorksheetData(id || '');
  
  const goBack = () => {
    navigate("/");
  };

  const handleRegionStateChange = (region: RegionData | null, stepIndex: number) => {
    setCurrentActiveRegion(region);
    setCurrentStepIndex(stepIndex);
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
        initialActiveRegion={locationState?.initialActiveRegion}
        initialCurrentStepIndex={locationState?.initialCurrentStepIndex}
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