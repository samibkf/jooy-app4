
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  
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
      <Button 
        onClick={goBack} 
        className="mb-4 bg-blue-500 hover:bg-blue-600"
        variant="outline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scanner
      </Button>
      
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
