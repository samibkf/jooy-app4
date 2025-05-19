
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import { Button } from "@/components/ui/button";

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  
  // Enable initial user interaction to help with autoplay policies
  useEffect(() => {
    const enableMediaPlayback = () => {
      // Create and play a silent audio to enable media playback
      const silentAudio = new Audio();
      silentAudio.play().catch(e => {
        console.log("Silent audio auto-play prevented. User interaction still needed.");
      });
      
      // Remove event listeners after first interaction
      document.removeEventListener('click', enableMediaPlayback);
      document.removeEventListener('touchstart', enableMediaPlayback);
      document.removeEventListener('keypress', enableMediaPlayback);
    };
    
    // Add event listeners for user interaction
    document.addEventListener('click', enableMediaPlayback);
    document.addEventListener('touchstart', enableMediaPlayback);
    document.addEventListener('keypress', enableMediaPlayback);
    
    // Clean up
    return () => {
      document.removeEventListener('click', enableMediaPlayback);
      document.removeEventListener('touchstart', enableMediaPlayback);
      document.removeEventListener('keypress', enableMediaPlayback);
    };
  }, []);
  
  const goBack = () => {
    navigate("/");
  };

  if (!id || !n) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Missing worksheet information
        </h1>
        <Button onClick={goBack} className="bg-blue-500 hover:bg-blue-600">
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
        <Button onClick={goBack} className="bg-blue-500 hover:bg-blue-600">
          Return to Scanner
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h1 className="text-xl font-bold mb-4 text-blue-600">
          Worksheet: {id} - Page {pageIndex}
        </h1>
        
        <WorksheetViewer worksheetId={id} pageIndex={pageIndex} />
      </div>
    </div>
  );
};

export default WorksheetPage;
