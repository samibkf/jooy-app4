
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScanBarcode } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const QRScannerButton: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/");
    toast({
      title: "QR Scanner Activated",
      description: "Position the QR code within the frame to scan",
    });
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed top-4 right-4 z-50 bg-blue-500 hover:bg-blue-600 rounded-full p-2 shadow-lg"
      size="icon"
      aria-label="Scan QR Code"
    >
      <ScanBarcode className="h-5 w-5" />
    </Button>
  );
};

export default QRScannerButton;
