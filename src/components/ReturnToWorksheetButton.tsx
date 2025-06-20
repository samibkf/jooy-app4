import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface ReturnToWorksheetButtonProps {
  worksheetId: string;
  pageNumber: number;
}

const ReturnToWorksheetButton: React.FC<ReturnToWorksheetButtonProps> = ({ 
  worksheetId, 
  pageNumber 
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/worksheet/${worksheetId}/${pageNumber}`);
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-4 left-4 z-50 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-lg"
      size="icon"
      aria-label="Return to Worksheet"
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  );
};

export default ReturnToWorksheetButton;