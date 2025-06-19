import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const [pageImage, setPageImage] = useState<string | null>(null);
  
  const goBack = () => {
    navigate("/");
  };

  const handlePageRendered = (canvas: HTMLCanvasElement) => {
    try {
      // Convert canvas to base64 image with 80% quality
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setPageImage(imageData);
    } catch (error) {
      console.error('Error capturing page image:', error);
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
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AIChatButton worksheetId={id} pageImage={pageImage} />
      <WorksheetViewer 
        worksheetId={id} 
        pageIndex={pageIndex} 
        onPageRendered={handlePageRendered}
      />
    </div>
  );
};

export default WorksheetPage;